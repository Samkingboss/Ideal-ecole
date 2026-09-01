-- ═══════════════════════════════════════════════════════════════════════
-- S0 · DIAGNOSTIC — pourquoi `anon` atteint-il public.eleves ?
--
-- LECTURE SEULE. AUCUNE donnée métier, AUCUNE ligne d'élève, AUCUNE image :
-- uniquement des métadonnées PostgreSQL.
--
-- À exécuter dans le SQL Editor, et à me renvoyer les quatre résultats.
--
-- ── Ce que la mesure extérieure a déjà établi ──────────────────────────
--
--   eleves        26 lignes rendues à anon, toutes colonnes projetables
--   classes        8 lignes rendues à anon
--   users          0 ligne     ← RLS filtre
--   inscriptions   0 ligne     ← RLS filtre
--   responsables   0 ligne     ← RLS filtre
--   disciplines    0 ligne     ← RLS filtre
--
--   INSERT eleves  → 23502 (« null value in column prenom »)
--                    le PRIVILÈGE est passé ; seule la contrainte a arrêté.
--   UPDATE/DELETE  → 204, filtre ne matchant aucune ligne
--   INSERT inscriptions → 42501, témoin d'une table correctement fermée
--
-- Ce diagnostic dit ce que la mesure extérieure ne peut pas distinguer :
-- RLS absente, ou RLS présente avec une policy permissive.
-- ═══════════════════════════════════════════════════════════════════════

-- ── A · RLS activée ? forcée ? ────────────────────────────────────────
select c.relname                as table_,
       c.relrowsecurity         as rls_activee,
       c.relforcerowsecurity    as rls_forcee,
       c.relacl is null         as acl_par_defaut
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('eleves', 'classes',
                     'users', 'inscriptions', 'responsables', 'disciplines')
 order by c.relname;
-- Attendu pour les quatre témoins : rls_activee = true.
-- Si eleves et classes sont à false, la cause est là.

-- ── B · policies présentes ────────────────────────────────────────────
select tablename, policyname, cmd, roles, permissive, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('eleves', 'classes',
                     'users', 'inscriptions', 'responsables', 'disciplines')
 order by tablename, cmd, policyname;
-- On cherche : une policy `to anon`, ou `using (true)`, sur eleves/classes.
-- Et l'absence totale de policy si la RLS est activée sans règle.

-- ── C, D, E · privilèges de TABLE, PUBLIC compris ─────────────────────
--
-- Le point décisif : PostgreSQL n'accorde rien à PUBLIC par défaut sur une
-- table, MAIS Supabase accorde `all` à anon et authenticated sur toute
-- nouvelle table du schéma public. `relacl is null` (colonne A) signifierait
-- qu'aucun GRANT explicite n'a jamais été passé — les droits seraient alors
-- ceux du propriétaire seul.
--
-- `aclexplode` matérialise le défaut au lieu de le laisser passer pour une
-- absence : c'est la leçon de la Phase 1 sur les fonctions.
select c.relname as table_,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as beneficiaire,
       a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
 where n.nspname = 'public'
   and c.relname in ('eleves', 'classes', 'inscriptions')
   and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
 order by c.relname,
          case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
          a.privilege_type;

-- ── Privilèges de COLONNE, s'il en existe ─────────────────────────────
--
-- Un droit accordé colonne par colonne ne se voit pas dans `relacl`. S'il y
-- en a, une révocation de table seule ne suffirait pas.
select table_name, column_name, grantee, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name in ('eleves', 'classes')
   and grantee in ('PUBLIC', 'anon', 'authenticated')
 order by table_name, column_name, grantee;
-- Résultat vide attendu : aucun droit de colonne, tout passe par la table.
