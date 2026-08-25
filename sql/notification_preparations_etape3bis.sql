-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 BIS — CORRECTIF DE CONTRAT : `cree` TOUJOURS BOOLÉEN
-- ═══════════════════════════════════════════════════════════════════════
--
-- L'étape 3 a donné 5/6. L'idempotence était juste — aucune boîte servie
-- une seconde fois, les deux destinataires reconnus comme déjà notifiés,
-- même identifiant logique, aucun doublon — mais `cree` valait `null` au
-- lieu de `false`.
--
-- Cause exacte : `array_length(t, 1)` rend NULL sur un tableau VIDE, et non
-- 0. Au second appel, `v_ecrites` est vide, donc `array_length(v_ecrites,1)`
-- vaut NULL, donc `NULL > 0` vaut NULL. C'est cette valeur qui sortait.
--
-- La même expression servait plus haut à décider du Web Push. Là, le `if`
-- traite NULL comme faux : le comportement était juste, mais par accident.
-- Les deux occurrences passent à `cardinality()`, qui rend 0 sur un tableau
-- vide et garde donc la comparaison booléenne.
--
-- Rien d'autre ne bouge : ni l'idempotence, ni l'identifiant déterministe,
-- ni le ciblage serveur, ni les policies, ni les GRANT. Le `revoke` et le
-- `grant` sont rejoués à l'identique, la fonction étant remplacée.

create or replace function public.notifier_preparation(p_preparation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi        public.users;
  v_prep       public.preparations;
  v_cycles     integer;
  v_retour     boolean;
  v_id         text;
  v_titre      text;
  v_message    text;
  v_notif      jsonb;
  v_liste      jsonb;
  v_cible      text;
  v_cles       text[] := array['directeur', 'responsable_administratif'];
  v_ecrites    text[] := array[]::text[];
  v_deja       text[] := array[]::text[];
begin
  -- 2.1 · Qui parle. Lu dans le jeton, jamais reçu du client.
  select u.* into v_moi
    from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true
   limit 1;

  if v_moi.id is null then
    raise exception 'session_non_authentifiee'
      using errcode = '28000',
            hint = 'Cette action exige une session Auth active.';
  end if;

  -- 2.2 · De quelle préparation parle-t-on.
  select p.* into v_prep
    from public.preparations p
   where p.id = p_preparation_id;

  if v_prep.id is null then
    raise exception 'preparation_introuvable'
      using errcode = 'P0002';
  end if;

  -- 2.3 · Lui appartient-elle RÉELLEMENT ? C'est ici que se joue la
  --       sécurité : sans ce contrôle, la surface étroite ne vaudrait pas
  --       mieux qu'un INSERT général.
  if v_prep.user_id <> v_moi.id then
    raise exception 'preparation_d_un_autre_enseignant'
      using errcode = '42501',
            hint = 'On ne notifie que ses propres préparations.';
  end if;

  -- 2.4 · Premier dépôt, ou retour après correction ?
  select count(*)::integer into v_cycles
    from jsonb_array_elements(coalesce(v_prep.historique_statuts, '[]'::jsonb)) e
   where e->>'action' = 'correction_demandee';

  v_retour := v_cycles > 0;
  v_id     := 'prep-' || p_preparation_id::text || '-' || v_cycles::text;

  v_titre := case when v_retour
    then '📚 Préparation corrigée et resoumise'
    else '📚 Nouvelle préparation soumise' end;

  v_message := trim(coalesce(v_moi.prenom, '') || ' ' || coalesce(v_moi.nom, ''))
    || ' · ' || coalesce(v_prep.matiere, 'matière non précisée')
    || ' · ' || coalesce(v_prep.groupe, '')
    || ' · cours du ' || coalesce(to_char(v_prep.date_cours, 'DD/MM/YYYY'), '?')
    || case when v_retour
         then ' — corrigée après votre demande'
              || case when v_cycles > 1
                   then ' (' || v_cycles::text || 'e demande)' else '' end
         else '' end;

  v_notif := jsonb_build_object(
    'id',        v_id,
    'titre',     v_titre,
    'message',   v_message,
    'date',      to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lu',        false,
    'type',      'preparation',
    'tabTarget', 'pedagogie',
    'ref',       p_preparation_id::text,
    'evenement', case when v_retour then 'resoumission' else 'depot' end,
    'cycle',     v_cycles
  );

  -- 2.5 · Dépôt dans la boîte de la direction. Les destinataires sont
  --       fixés ici : le client n'a aucun moyen de les désigner.
  foreach v_cible in array v_cles loop
    perform pg_advisory_xact_lock(hashtext('notifs_' || v_cible));

    select a.value into v_liste
      from public.app_state a
     where a.app = 'notifications' and a.key = 'notifs_' || v_cible;

    v_liste := coalesce(v_liste, '[]'::jsonb);
    if jsonb_typeof(v_liste) <> 'array' then
      v_liste := '[]'::jsonb;
    end if;

    -- Déjà notifiée pour ce cycle : on ne touche à rien.
    if exists (select 1 from jsonb_array_elements(v_liste) n
                where n->>'id' = v_id) then
      v_deja := v_deja || v_cible;
      continue;
    end if;

    v_liste := jsonb_build_array(v_notif) || v_liste;

    if jsonb_array_length(v_liste) > 50 then
      v_liste := (
        select coalesce(jsonb_agg(t.e order by t.i), '[]'::jsonb)
          from (select e, i from jsonb_array_elements(v_liste)
                  with ordinality as x(e, i)
                 order by i limit 50) t
      );
    end if;

    insert into public.app_state (app, key, value, updated_at)
    values ('notifications', 'notifs_' || v_cible, v_liste, now())
        on conflict (app, key)
        do update set value = excluded.value, updated_at = excluded.updated_at;

    v_ecrites := v_ecrites || v_cible;
  end loop;

  -- 2.6 · Web Push, uniquement si quelque chose a réellement été créé —
  --       un renvoi ne doit pas refaire sonner le téléphone. Son échec ne
  --       doit jamais annuler la notification déjà déposée : la cloche
  --       l'affichera à la prochaine ouverture.
  -- `cardinality` et non `array_length` : sur un tableau VIDE,
  -- `array_length(t, 1)` rend NULL et non 0. La comparaison devenait NULL,
  -- que le `if` traite comme faux — le comportement était juste ici, mais
  -- par accident. `cardinality` rend 0, et la condition reste booléenne.
  if cardinality(v_ecrites) > 0 then
    begin
      perform public.emettre_notification_push(
        p_cibles  => v_cles,
        p_titre   => v_titre,
        p_message => v_message,
        p_url     => '/?notificationTab=pedagogie&notificationRef='
                     || p_preparation_id::text,
        p_tag     => 'ideal-preparation-' || v_id
      );
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    -- Là, le NULL sortait. Le contrat de la fonction est que `cree` soit
    -- TOUJOURS un booléen : un appelant qui teste `cree === false` doit
    -- pouvoir s'y fier, et `null` n'est ni vrai ni faux.
    'cree',        cardinality(v_ecrites) > 0,
    'evenement',   case when v_retour then 'resoumission' else 'depot' end,
    'cycle',       v_cycles,
    'notification', v_id,
    'deposee_chez', to_jsonb(v_ecrites),
    'deja_notifiee', to_jsonb(v_deja)
  );
end
$function$;

comment on function public.notifier_preparation(uuid) is
  'Previent la direction du depot ou de la resoumission d''une preparation. '
  'Le client ne transmet que l''identifiant de la preparation : auteur, '
  'propriete, destinataire, type, libelle et reference sont determines par '
  'le serveur. Identifiant de notification deterministe — un double clic ou '
  'un renvoi ne cree pas de doublon.';

-- Une enseignante connectée, et elle seule. `anon` n'y a pas accès : une
-- notification à la direction suppose une session.
revoke all on function public.notifier_preparation(uuid) from public, anon;
grant execute on function public.notifier_preparation(uuid) to authenticated;
