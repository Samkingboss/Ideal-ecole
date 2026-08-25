-- ═══════════════════════════════════════════════════════════════════════
-- LA DIRECTION DOIT POUVOIR LIRE SA PROPRE BOÎTE
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── L'anomalie, tracée jusqu'à la donnée ───────────────────────────────
--
-- Ornella soumet une préparation. La Direction ne reçoit rien.
--
-- Or la notification EXISTE. Relevée dans `app_state`, boîte
-- `notifs_directeur` :
--
--   « 📚 Nouvelle préparation soumise »
--   ref  = ac30a4c2-35dd-4b60-81e1-a9e645954af5
--   date = 2026-08-25T17:34:43
--
-- Elle a été écrite par `notifier_preparation`, SECURITY DEFINER, qui
-- s'exécute avec les droits du propriétaire et ne dépend donc d'aucune
-- politique. L'écriture a parfaitement fonctionné.
--
-- C'est la LECTURE qui échoue.
--
-- ── La cause, la même que celle du 42501 ───────────────────────────────
--
-- Les trois politiques de `app_state` visent le seul rôle `anon` :
--
--   app_state_read    SELECT  {anon}  using (true)
--   app_state_write   INSERT  {anon}  with check (true)
--   app_state_update  UPDATE  {anon}  using (true)
--
-- RLS est active. Un rôle sans politique permissive est refusé — et une
-- session de direction est `authenticated`, pas `anon`. Elle lit donc
-- ZÉRO ligne de sa propre boîte de notifications.
--
-- La cloche n'est pas cassée : elle regarde une boîte que le serveur lui
-- présente vide.
--
-- Ce défaut touche TOUT utilisateur connecté depuis la phase 3.1 : aucune
-- notification n'a jamais pu être lue par un compte authentifié.
--
-- ── Ce que ce script fait, et ne fait pas ──────────────────────────────
--
-- Il ajoute UNE politique de LECTURE pour le personnel connecté. Rien
-- d'autre.
--
-- Il ne touche pas aux politiques `anon` existantes : le formulaire public
-- d'inscription écrit encore dans `app_state` pour prévenir la direction
-- d'un nouveau dossier, et le plan de fermeture
-- (`docs/constitution/fermeture-app-state.md`) prévoit de migrer ces
-- dix-sept écritures avant de les retirer. Les retirer ici casserait le
-- dépôt public.
--
-- Il n'accorde AUCUNE écriture à `authenticated` : c'est précisément ce
-- que la direction a interdit, et ce que `notifier_preparation` rend
-- inutile.
--
-- NON DESTRUCTIF. IDEMPOTENT.

begin;

drop policy if exists app_state_lecture_personnel on public.app_state;
-- SUPERSÉDÉ PAR rls_correctif_predicat_personnel.sql — prédicat composite corrigé.
create policy app_state_lecture_personnel
  on public.app_state
  for select
  to authenticated
  using (public.ideal_profil() is not null);

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- X1 — les politiques de `app_state`. La nouvelle s'ajoute aux trois
--      existantes ; aucune n'est retirée, aucune écriture n'est ouverte à
--      `authenticated`.
--      ATTENDU : 4 lignes
--        app_state_lecture_personnel  SELECT  {authenticated}
--        app_state_read               SELECT  {anon}
--        app_state_update             UPDATE  {anon}
--        app_state_write              INSERT  {anon}
select policyname, cmd, roles::text
  from pg_policies
 where schemaname = 'public' and tablename = 'app_state'
 order by cmd, policyname;

-- X2 — aucune politique d'ÉCRITURE pour `authenticated`.
--      ATTENDU : 0
select count(*) as ecritures_authenticated
  from pg_policies
 where schemaname = 'public' and tablename = 'app_state'
   and roles::text like '%authenticated%'
   and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');

-- X3 — la notification de la préparation d'Ornella est bien là.
--      ATTENDU : au moins une ligne, titre « 📚 Nouvelle préparation soumise »
select n ->> 'titre' as titre,
       n ->> 'ref'   as reference,
       n ->> 'date'  as date_notification
  from public.app_state a,
       jsonb_array_elements(a.value) n
 where a.app = 'notifications' and a.key = 'notifs_directeur'
   and n ->> 'type' = 'preparation'
 order by n ->> 'date' desc
 limit 5;


-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- begin;
-- drop policy if exists app_state_lecture_personnel on public.app_state;
-- commit;
