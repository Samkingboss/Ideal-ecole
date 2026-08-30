-- ═══════════════════════════════════════════════════════════════════════════
-- P0 · FERMETURE DE `public.app_state` AU RÔLE `anon`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- NE PAS EXÉCUTER AVANT QUE LE CODE SOIT DÉPLOYÉ ET VÉRIFIÉ EN LIGNE.
-- Ordre imposé : code → build → gardes → commit → push → Vercel → vérification
-- du déployé → CE SCRIPT → recette live.
--
-- Écrit d'après le diagnostic réel du 30/08/2026, pas d'après des noms devinés.
--
-- ── État constaté ─────────────────────────────────────────────────────────
--
--   relrowsecurity = true, relforcerowsecurity = false
--
--   app_state_write               INSERT  {anon}           with check (true)
--   app_state_read                SELECT  {anon}           using (true)
--   app_state_update              UPDATE  {anon}           using (true)
--   app_state_lecture_personnel   SELECT  {authenticated}  using (ideal_role() is not null)
--
-- ── Ce que ce diagnostic révèle, et qu'il faut dire ───────────────────────
--
-- AUCUNE policy INSERT ni UPDATE ne couvre `authenticated`. Or le portail se
-- connecte réellement par Supabase Auth (`signInWithPassword`,
-- `src/pages/LoginPage.jsx:80`) : tout le personnel connecté parle donc en
-- `authenticated`, et ses écritures dans `app_state` sont refusées AUJOURD'HUI
-- par RLS. C'est ce que constatait déjà le commentaire de
-- `src/lib/notifications.js` : « une session authentifiée n'a pas ce droit :
-- la resoumission d'une préparation corrigée échouait en 42501 ».
--
-- Les lignes présentes dans la table ont donc été écrites par des chemins
-- ANONYMES — le formulaire public, `rapports.html`, l'archive — c'est-à-dire
-- précisément ceux que ce chantier vient de fermer côté code.
--
-- Conséquence à ne pas manquer : ce script ne se contente pas de retirer des
-- droits. En créant les deux policies `authenticated` demandées, il RÉPARE des
-- écritures qui échouaient en silence. Sans elles, retirer les droits `anon`
-- rendrait `app_state` inscriptible par personne.
--
-- ── Ce que ce script ne touche pas ────────────────────────────────────────
--
-- `service_role`, le propriétaire de la table, `app_state_lecture_personnel`,
-- les fonctions `security definer` (elles s'exécutent comme leur propriétaire
-- et contournent RLS), `fiche.html`, le QR de la carte scolaire, et les neuf
-- lignes de sonde — qui se nettoient séparément, jamais dans cette migration.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 0 · PRÉ-REQUIS · refuser de s'exécuter dans un état inattendu
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_manquantes text;
  v_src        text;
begin
  -- 0.1 · Les trois policies à retirer existent-elles bien, sous ces noms ?
  --
  -- `drop policy if exists` sur un nom inexistant est un NO-OP SILENCIEUX :
  -- sans ce contrôle, un renommage en amont laisserait la table grande
  -- ouverte pendant que le script annoncerait un succès.
  select string_agg(n, ', ') into v_manquantes
    from unnest(array['app_state_write', 'app_state_read', 'app_state_update']) n
   where not exists (
     select 1 from pg_policies
      where schemaname = 'public' and tablename = 'app_state' and policyname = n);
  if v_manquantes is not null then
    raise exception 'POLICIES INTROUVABLES SOUS CES NOMS : % — etat different du diagnostic, ne rien retirer a l aveugle', v_manquantes;
  end if;

  -- 0.2 · La policy de lecture du personnel doit être là : c'est elle qu'on
  --       conserve, et sans elle plus personne ne lirait rien.
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'app_state'
       and policyname = 'app_state_lecture_personnel') then
    raise exception 'app_state_lecture_personnel ABSENTE — la lecture du personnel serait perdue';
  end if;

  -- 0.3 · `ideal_role()` doit exister : les trois policies en dépendent.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'ideal_role') then
    raise exception 'public.ideal_role() ABSENTE — les policies seraient inapplicables';
  end if;

  -- 0.4 · La notification d'inscription doit DÉJÀ être passée côté serveur.
  --
  -- Sinon ce script coupe la seule voie qui prévenait la direction d'un
  -- dépôt, et les inscriptions arriveraient sans que personne le sache.
  -- C'est la seule partie de l'ordre de déploiement que le SQL peut vérifier
  -- lui-même ; que le FRONT soit déployé reste à confirmer par l'opérateur.
  select p.prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'creer_inscription_avec_suivi';
  if v_src is null then
    raise exception 'creer_inscription_avec_suivi ABSENTE — le depot public serait casse';
  end if;
  if strpos(v_src, 'pg_advisory_xact_lock') = 0 then
    raise exception 'sql/inscription_notification_serveur.sql N A PAS ETE EXECUTE — fermer maintenant priverait la direction de toute notification de depot';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · POLICIES · retirer les trois surfaces `anon`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Les noms proviennent du diagnostic et viennent d'être vérifiés ci-dessus.
drop policy app_state_write  on public.app_state;   -- INSERT {anon} with check (true)
drop policy app_state_read   on public.app_state;   -- SELECT {anon} using (true)
drop policy app_state_update on public.app_state;   -- UPDATE {anon} using (true)

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · POLICIES · l'écriture devient l'affaire du personnel connecté
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Même prédicat que la lecture déjà en place : `ideal_role()` ne rend un rôle
-- que pour un compte ACTIF ; un compte désactivé cesse donc d'écrire au même
-- instant qu'il cesse de lire.
--
-- Aucune policy DELETE : le code livré n'en fait aucun usage, et la
-- suppression restera refusée à tout le monde sauf au propriétaire.
-- Aucune policy `TO public` : elle couvrirait `anon` par la bande.
create policy app_state_ecriture_personnel
  on public.app_state
  for insert
  to authenticated
  with check (public.ideal_role() is not null);

create policy app_state_maj_personnel
  on public.app_state
  for update
  to authenticated
  using (public.ideal_role() is not null)
  with check (public.ideal_role() is not null);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · PRIVILÈGES · `anon` n'atteint plus la table du tout
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une policy retirée suffit à refuser, mais le privilège retiré refuse PLUS
-- TÔT — avant même l'évaluation des lignes — et le refus devient un 42501
-- lisible au lieu d'une liste vide indistinguable d'une absence de données.
-- C'est ce qui rend la recette capable de conclure.
revoke all privileges on table public.app_state from anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · PRIVILÈGES · `authenticated` garde ce qu'il utilise, et rien de plus
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Recherche menée sur tout le code livré (`src/` et `public/`) au 30/08/2026 :
--
--   SELECT      · 18 lectures                         → CONSERVÉ
--   INSERT      · `etatPartage.js` (création de ligne) → CONSERVÉ
--                 + 7 `upsert`, qui exigent INSERT
--   UPDATE      · `etatPartage.js` (écriture conditionnelle) → CONSERVÉ
--                 + les mêmes 7 `upsert`, qui exigent UPDATE
--   DELETE      · aucun appel                          → RETIRÉ
--   TRUNCATE    · aucun appel                          → RETIRÉ
--   TRIGGER     · aucun trigger défini sur la table    → RETIRÉ
--   REFERENCES  · aucune clé étrangère vers app_state  → RETIRÉ
revoke delete, truncate, trigger, references on table public.app_state from authenticated;

grant select, insert, update on table public.app_state to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · CONTRÔLES · avant de valider
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_anon_policies  integer;
  v_public_policies integer;
  v_delete_policies integer;
  v_anon_grants    integer;
  v_auth_grants    text;
  v_attendues      integer;
begin
  -- 5.1 · Plus une seule policy ne mentionne `anon`.
  select count(*) into v_anon_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'app_state' and 'anon' = any(roles);
  if v_anon_policies <> 0 then
    raise exception 'IL RESTE % POLICY(IES) POUR anon', v_anon_policies;
  end if;

  -- 5.2 · Aucune policy `TO public` : elle rouvrirait la porte à `anon`.
  select count(*) into v_public_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'app_state' and 'public' = any(roles);
  if v_public_policies <> 0 then
    raise exception 'UNE POLICY TO PUBLIC SUBSISTE — anon repasserait par la';
  end if;

  -- 5.3 · Aucune policy DELETE n'a été créée.
  select count(*) into v_delete_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'app_state' and cmd = 'DELETE';
  if v_delete_policies <> 0 then
    raise exception 'UNE POLICY DELETE A ETE CREEE — elle n a aucun usage';
  end if;

  -- 5.4 · Les trois policies attendues, et elles seules.
  select count(*) into v_attendues
    from pg_policies
   where schemaname = 'public' and tablename = 'app_state'
     and policyname in ('app_state_lecture_personnel',
                        'app_state_ecriture_personnel',
                        'app_state_maj_personnel');
  if v_attendues <> 3 then
    raise exception 'LES TROIS POLICIES ATTENDUES NE SONT PAS TOUTES LA : % sur 3', v_attendues;
  end if;
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'app_state') <> 3 then
    raise exception 'UNE POLICY INATTENDUE SUBSISTE SUR app_state';
  end if;

  -- 5.5 · `anon` n'a plus aucun privilège de table.
  select count(*) into v_anon_grants
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'app_state' and grantee = 'anon';
  if v_anon_grants <> 0 then
    raise exception 'anon CONSERVE % PRIVILEGE(S)', v_anon_grants;
  end if;

  -- 5.6 · `authenticated` a exactement SELECT, INSERT, UPDATE.
  select string_agg(privilege_type, ',' order by privilege_type) into v_auth_grants
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'app_state' and grantee = 'authenticated';
  if v_auth_grants is distinct from 'INSERT,SELECT,UPDATE' then
    raise exception 'PRIVILEGES authenticated INATTENDUS : %', coalesce(v_auth_grants, '(aucun)');
  end if;
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- ÉTAT ATTENDU APRÈS EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- select policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname='public' and tablename='app_state'
--  order by cmd, policyname;
--
--   app_state_ecriture_personnel  INSERT  {authenticated}  qual NULL
--                                 with_check (ideal_role() IS NOT NULL)
--   app_state_lecture_personnel   SELECT  {authenticated}  qual (ideal_role() IS NOT NULL)
--   app_state_maj_personnel       UPDATE  {authenticated}  qual (ideal_role() IS NOT NULL)
--                                 with_check (ideal_role() IS NOT NULL)
--
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema='public' and table_name='app_state' order by 1,2;
--
--   anon           → AUCUNE LIGNE
--   authenticated  → INSERT, SELECT, UPDATE
--   service_role   → inchangé
--   (propriétaire) → inchangé
--
-- Puis, immédiatement :
--   node scripts/gardes/recette-fermeture-app-state.mjs
