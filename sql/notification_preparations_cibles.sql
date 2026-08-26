-- ═══════════════════════════════════════════════════════════════════════
-- NOTIFICATION DES PREPARATIONS — RETIRER LE COMPTE ADMINISTRATIF
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Ce qui se passait ─────────────────────────────────────────────────
--
--   v_cles := array['directeur', 'responsable_administratif']
--
-- Cette variable sert DEUX choses : le depot dans la boite de la cloche, et
-- l appel a `emettre_notification_push`. Le responsable administratif
-- recevait donc, pour chaque depot de preparation, une entree dans sa cloche
-- ET une notification sur son telephone.
--
-- Or la notification porte `tabTarget = 'pedagogie'`, et l interface du
-- responsable administratif n a que trois sessions : eleves, RH,
-- comptabilite. Le message ouvrait chez lui un onglet qui n existe pas.
--
-- ── Ce que ce script fait, et rien d autre ────────────────────────────
--
-- Il remplace la fonction avec `v_cles := array['directeur']`. Aucune autre
-- ligne du corps ne change. Les policies, les droits et les autres canaux ne
-- sont pas touches.
--
-- Le correctif COTE ECRAN est deja en place et complementaire : le centre de
-- notifications faisait lire `notifs_directeur` au responsable administratif
-- en plus de la sienne. Fermer l ecriture sans fermer ce relais n aurait
-- rien change -- il aurait continue de tout voir.
--
-- TRANSACTIONNEL · IDEMPOTENT (create or replace) · REVERSIBLE
-- (sql/notification_preparations_cibles_rollback.sql). Aucune donnee touchee.

begin;

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
  -- Le seul destinataire d'une notification PEDAGOGIQUE.
  --
  -- Le responsable administratif y figurait. Or son interface n'a que trois
  -- sessions -- eleves, RH, comptabilite -- et cette notification porte
  -- tabTarget = 'pedagogie' : elle ouvrait chez lui un onglet inexistant.
  -- Il recevait en outre le Web Push, `v_cles` servant aussi a
  -- `emettre_notification_push` : son telephone sonnait pour chaque depot de
  -- preparation.
  --
  -- Regle metier : le pedagogique ne passe pas par le compte administratif.
  v_cles       text[] := array['directeur'];
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

-- ── Controle AVANT commit ─────────────────────────────────────────────
do $verif$
declare n integer;
begin
  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'notifier_preparation'
     -- On cherche la CHAINE LITTERALE du tableau de cibles, pas une
     -- occurrence quelconque : dans un LIKE, « _ » est un joker, et le
     -- commentaire « responsable administratif », ecrit avec une espace,
     -- suffisait a declencher une fausse alerte. L'underscore est echappe.
     -- `strpos` et non `like` : dans un LIKE, « _ » est un joker, et le
     -- commentaire « responsable administratif », ecrit avec une espace,
     -- suffisait a declencher une fausse alerte. Ici la recherche est
     -- litterale, sans aucune semantique de motif.
     and strpos(p.prosrc, $q$'responsable_administratif'$q$) > 0;
  if n > 0 then
    raise exception 'LE COMPTE ADMINISTRATIF EST ENCORE CIBLE par la notification pedagogique';
  end if;

  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'notifier_preparation'
     and strpos(p.prosrc, $q$array['directeur']$q$) > 0;
  if n <> 1 then
    raise exception 'CIBLE INATTENDUE : le directeur n est pas le seul destinataire';
  end if;
end
$verif$;

commit;


-- ── Verification apres commit ─────────────────────────────────────────
-- ATTENDU : administratif_cible = false, directeur_seul = true
select
  exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname='public' and p.proname='notifier_preparation'
             and strpos(p.prosrc, $q$'responsable_administratif'$q$) > 0) as administratif_cible,
  exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname='public' and p.proname='notifier_preparation'
             and strpos(p.prosrc, $q$array['directeur']$q$) > 0)   as directeur_seul;

-- La boite deja remplie n est PAS purgee : les notifications passees
-- restent lisibles la ou elles ont ete deposees. Ce script change ce qui
-- sera ecrit, pas ce qui l a ete.
-- ATTENDU : la cle du responsable administratif peut encore exister et
-- porter d anciennes entrees. Elle cessera simplement de grossir.
select key, jsonb_array_length(value) as entrees, updated_at
  from public.app_state
 where app = 'notifications'
   and key in ('notifs_directeur', 'notifs_responsable_administratif');
