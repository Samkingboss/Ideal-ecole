-- ═══════════════════════════════════════════════════════════════════════
-- NOTIFIER LA DIRECTION D'UN DÉPÔT OU D'UNE RESOUMISSION DE PRÉPARATION
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Le symptôme ────────────────────────────────────────────────────────
--
-- Ornella corrige une préparation après une demande de correction, la
-- resoumet, et lit :
--
--   « Votre préparation est enregistrée. En revanche la direction n'a pas
--     été prévenue : votre session n'a pas le droit d'écrire cette
--     notification (enregistrement · 42501). »
--
-- La préparation EST enregistrée — la sauvegarde principale n'a jamais été
-- touchée. Seule la notification est refusée.
--
-- ── Ce que le client faisait ───────────────────────────────────────────
--
-- `pushNotification()` écrit la notification en clair dans `app_state`,
-- ligne (app = 'notifications', key = 'notifs_directeur'), par un UPSERT
-- qui REMPLACE toute la liste. Mesuré depuis la clé publique : la lecture
-- répond 200 et l'écriture 201. La table est donc ouverte à `anon`.
--
-- La session d'une enseignante connectée n'est pas `anon` : depuis la phase
-- 3.1, elle est `authenticated`. 42501 est `insufficient_privilege` : le
-- rôle qui écrit n'a pas de politique permissive pour cette écriture.
--
-- ── CAUSE CONFIRMÉE PAR L'ÉTAPE 1 ─────────────────────────────────────
--
-- Le diagnostic a tranché, et il a corrigé l'hypothèse de départ.
--
-- 1.c — LES PRIVILÈGES NE SONT PAS EN CAUSE. Les trois rôles portent
--       exactement les mêmes :
--         anon           DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--         authenticated  DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--         service_role   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
-- 1.b — RLS est ACTIVE sur la table (rls_active = true, forcée = false).
--
-- 1.a — Les trois politiques existantes s'appliquent AU SEUL RÔLE `anon` :
--         app_state_read    SELECT  {anon}  using (true)
--         app_state_write   INSERT  {anon}  with check (true)
--         app_state_update  UPDATE  {anon}  using (true)
--
-- Sous RLS, un rôle sans politique permissive applicable est refusé, quels
-- que soient ses privilèges de table. `authenticated` a donc le DROIT
-- d'écrire et n'a AUCUNE POLITIQUE qui le lui permette : chaque INSERT part
-- en 42501.
--
-- C'est aussi pourquoi la clé publique écrit sans peine (elle est `anon`,
-- couverte par `app_state_write`) alors qu'une enseignante connectée échoue.
--
-- Conséquence pour la fermeture à venir : fermer `app_state` à `anon` sera
-- un RETRAIT DE POLITIQUES, pas une révocation de privilèges. Les GRANT sont
-- identiques pour les trois rôles ; ce sont les politiques qui décident.
--
-- ── Ce que l'on ne fait PAS ────────────────────────────────────────────
--
-- On n'accorde pas un INSERT général sur `app_state` à `authenticated`.
-- Cela donnerait à toute enseignante le droit d'écrire n'importe quelle
-- notification, vers n'importe qui, de n'importe quel type — et, l'écriture
-- étant un remplacement de liste, celui d'EFFACER la boîte du directeur.
--
-- ── Ce que l'on fait ───────────────────────────────────────────────────
--
-- Une surface étroite : le client ne transmet que l'identifiant de la
-- préparation. Le serveur détermine seul l'auteur (auth.uid()), la
-- propriété de la préparation, le destinataire, le type, le libellé et la
-- référence. Aucune de ces valeurs n'est choisie par le client.
--
-- NON DESTRUCTIF : aucune ligne modifiée, aucune politique existante
-- touchée. Rejouable.

begin;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · DIAGNOSTIC — la cause racine, écrite
-- ═══════════════════════════════════════════════════════════════════════
-- Ces trois requêtes n'écrivent rien.

-- 1.a — Les politiques de `app_state` et les rôles auxquels elles
--       s'appliquent. Une ligne dont `roles` ne contient ni
--       `authenticated` ni `public` n'autorise pas une enseignante
--       connectée.
select policyname, cmd, roles::text, qual::text, with_check::text
  from pg_policies
 where schemaname = 'public' and tablename = 'app_state'
 order by cmd, policyname;

-- 1.b — RLS est-elle seulement active sur la table ?
select relname, relrowsecurity as rls_active, relforcerowsecurity as rls_forcee
  from pg_class where oid = 'public.app_state'::regclass;

-- 1.c — Les privilèges de table. Si `authenticated` n'apparaît pas avec
--       INSERT et UPDATE, la cause est le GRANT et non la politique.
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as droits
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'app_state'
   and grantee in ('anon', 'authenticated', 'service_role')
 group by grantee order by grantee;


-- ═══════════════════════════════════════════════════════════════════════
-- 2 · LA SURFACE MÉTIER
-- ═══════════════════════════════════════════════════════════════════════
--
-- Un seul paramètre : la préparation. Tout le reste est déterminé par le
-- serveur à partir de `auth.uid()` et de la ligne elle-même.
--
-- ── Première soumission ou resoumission ? ──────────────────────────────
--
-- Le serveur compte les demandes de correction déjà inscrites dans
-- `historique_statuts`. Zéro : première soumission. Une ou plus : retour
-- après correction. Le nombre sert aussi de compteur de cycle.
--
-- ── Idempotence ────────────────────────────────────────────────────────
--
-- L'identifiant de la notification est déterministe :
--   'prep-' || id_préparation || '-' || nombre_de_cycles
--
-- Un double clic, ou un renvoi après une réponse perdue, retombe sur le
-- MÊME identifiant : la notification existe déjà, rien n'est ajouté. Un
-- second cycle de correction légitime porte un compteur différent et
-- produit bien une nouvelle notification.
--
-- Un verrou consultatif sérialise deux appels simultanés sur la même
-- boîte : sans lui, deux lectures concurrentes de la liste s'écraseraient.

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
  if array_length(v_ecrites, 1) > 0 then
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
    'cree',        array_length(v_ecrites, 1) > 0,
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

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- V1 — La fonction existe, avec UN seul paramètre. C'est la preuve
--      structurelle qu'aucun destinataire, type ou message ne peut être
--      choisi par le client.
--      attendu : notifier_preparation | 1 | p_preparation_id uuid | definer
select p.proname,
       p.pronargs,
       pg_get_function_arguments(p.oid) as parametres,
       case when p.prosecdef then 'definer' else 'invoker' end as securite
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'notifier_preparation';

-- V2 — Qui peut l'exécuter. `anon` ne doit PAS y figurer.
--      attendu : authenticated uniquement
select grantee, privilege_type
  from information_schema.role_routine_grants
 where routine_schema = 'public' and routine_name = 'notifier_preparation'
 order by grantee;

-- V3 — Aucune politique de `app_state` n'a été élargie par ce script.
--      À comparer, à l'identique, avec la sortie de l'étape 1.a.
select policyname, cmd, roles::text
  from pg_policies
 where schemaname = 'public' and tablename = 'app_state'
 order by cmd, policyname;


-- ═══════════════════════════════════════════════════════════════════════
-- 3 · TESTS DE SÉCURITÉ ET D'IDEMPOTENCE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Tout ce bloc s'exécute entre `begin` et `rollback` : RIEN n'est écrit.
-- Il prouve le comportement de la fonction, pas le workflow — celui-ci se
-- prouve depuis l'application, par Ornella puis par vous.
--
-- Le rôle et l'identité sont endossés comme le fait PostgREST : `role` +
-- `request.jwt.claims`. C'est exactement ce que voit la fonction quand une
-- enseignante connectée l'appelle. Aucun code d'accès n'est nécessaire, et
-- aucun n'apparaît ici.
--
-- Exécuter ce bloc D'UN SEUL TENANT.

begin;

-- ── TEST A · première soumission, préparation d'Ornella ────────────────
-- Préparation 9a0dae7e (Lecture, 24/08) : aucun cycle de correction.
set local role authenticated;
set local request.jwt.claims to '{"sub":"e9ce36c7-4fce-41e1-8dac-29234253fdb9"}';
select 'TEST A' as test,
       public.notifier_preparation('9a0dae7e-048b-41e0-b620-228371c3cd50') as resultat;
-- ATTENDU : cree = true, evenement = "depot", cycle = 0,
--           notification = "prep-9a0dae7e-...-0",
--           deposee_chez = ["directeur","responsable_administratif"]
-- ARRÊT SI DIFFÉRENT — en particulier si evenement vaut "resoumission".

-- ── TEST C · resoumission après correction ────────────────────────────
-- Préparation f4fb857f : une correction demandée, une modification déposée.
select 'TEST C' as test,
       public.notifier_preparation('f4fb857f-f33b-49fa-b55e-8c330d8058ed') as resultat;
-- ATTENDU : cree = true, evenement = "resoumission", cycle = 1,
--           notification = "prep-f4fb857f-...-1"
-- ARRÊT SI DIFFÉRENT — c'est le cas qui produisait 42501. Aucune erreur
-- ne doit apparaître.

-- ── TEST E · double clic, ou renvoi après réponse perdue ──────────────
select 'TEST E' as test,
       public.notifier_preparation('f4fb857f-f33b-49fa-b55e-8c330d8058ed') as resultat;
-- ATTENDU : cree = false, deposee_chez = [],
--           deja_notifiee = ["directeur","responsable_administratif"]
-- ARRÊT SI DIFFÉRENT — un `cree = true` signifierait un doublon.

-- ── Contrôle du dépôt réel dans la boîte de la direction ──────────────
select key,
       jsonb_array_length(value)          as entrees,
       value->0->>'titre'                 as derniere,
       value->0->>'ref'                   as reference
  from public.app_state
 where app = 'notifications'
   and key in ('notifs_directeur', 'notifs_responsable_administratif');
-- ATTENDU : deux lignes, `derniere` = "📚 Préparation corrigée et resoumise",
--           `reference` = f4fb857f-f33b-49fa-b55e-8c330d8058ed
-- ARRÊT SI DIFFÉRENT.

-- ── TEST F · la préparation d'une autre enseignante ───────────────────
-- Bintou NABO tente de notifier une préparation de Juliette N'GONE.
set local request.jwt.claims to '{"sub":"4825b2a2-3f4b-4aab-aa66-b356285cff99"}';
do $$
begin
  perform public.notifier_preparation('9a2ab973-11bf-439d-96d5-9bea0f5b7c88');
  raise exception 'TEST F ÉCHOUÉ — la notification a été acceptée';
exception
  when insufficient_privilege then
    raise notice 'TEST F OK — refus serveur : %', sqlerrm;
end
$$;
-- ATTENDU : NOTICE « TEST F OK — refus serveur :
--           preparation_d_un_autre_enseignant »
-- ARRÊT SI DIFFÉRENT — surtout si l'exception « TEST F ÉCHOUÉ » apparaît.

-- ── TEST G · notification arbitraire vers un autre utilisateur ────────
-- Il n'existe aucun paramètre de destinataire, de titre ou de message : la
-- tentative ne peut même pas s'écrire. La preuve est que l'appel est
-- rejeté par PostgreSQL avant toute exécution.
do $$
begin
  execute 'select public.notifier_preparation('
       || quote_literal('9a0dae7e-048b-41e0-b620-228371c3cd50')
       || ', ' || quote_literal('directeur') || ')';
  raise exception 'TEST G ÉCHOUÉ — une cible a pu être transmise';
exception
  when undefined_function then
    raise notice 'TEST G OK — aucun destinataire ne peut être transmis';
end
$$;
-- ATTENDU : NOTICE « TEST G OK — aucun destinataire ne peut être transmis »
-- ARRÊT SI DIFFÉRENT.

-- ── Session non authentifiée ──────────────────────────────────────────
-- `reset role` d'abord : une fois endossé, `authenticated` n'a pas le droit
-- de basculer vers `anon`. On repasse par le rôle de session.
reset role;
set local role anon;
do $$
begin
  perform public.notifier_preparation('9a0dae7e-048b-41e0-b620-228371c3cd50');
  raise exception 'ÉCHEC — anon a pu notifier';
exception
  when insufficient_privilege or invalid_authorization_specification then
    raise notice 'OK — anon refusé : %', sqlerrm;
end
$$;
-- ATTENDU : NOTICE « OK — anon refusé : … »
-- ARRÊT SI DIFFÉRENT.

rollback;

-- ── Contrôle d'innocuité ───────────────────────────────────────────────
-- Après le rollback, la boîte de la direction doit être EXACTEMENT dans
-- l'état d'avant les tests.
select key, jsonb_array_length(value) as entrees, updated_at
  from public.app_state
 where app = 'notifications'
   and key in ('notifs_directeur', 'notifs_responsable_administratif');
-- ATTENDU : notifs_directeur = 19 entrées, `updated_at` inchangé.
-- ARRÊT SI DIFFÉRENT — un test aurait écrit hors transaction.
