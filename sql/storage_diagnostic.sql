-- ═══════════════════════════════════════════════════════════════════════
-- STOCKAGE — DIAGNOSTIC SEUL, EN LECTURE PURE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ce fichier ne contient AUCUN `alter`, AUCUN `create`, AUCUN `drop`.
-- Rien à annuler, rien à surveiller.
--
-- L'erreur « must be owner of table objects » venait de l'instruction
--   alter table storage.objects enable row level security
-- qui se trouvait dans la SECTION 2 du fichier précédent. Un rôle de tableau
-- de bord n'est pas propriétaire du schéma `storage` — c'est normal, et il
-- n'y a pas à changer ce propriétaire.
--
-- ── Ce que j'ai déjà établi sans SQL, par comportement ─────────────────
--
-- 1 · CE N'EST PAS UN BUCKET PUBLIC.
--     `GET /storage/v1/bucket/inscriptions` avec la clé publiable répond
--     404 « Bucket not found » : `storage.buckets` est fermée à `anon`.
--     La route `/object/public/…` répond 400 pour la même raison — elle
--     doit lire le drapeau `public` du bucket, et ne peut pas.
--
-- 2 · RLS EST BIEN ACTIVE SUR `storage.objects`.
--     Un dépôt anonyme est refusé avec « new row violates row-level
--     security policy ». Ce message ne peut venir que d'une politique en
--     vigueur : si RLS était désactivée, l'écriture passerait.
--
-- 3 · UNE POLITIQUE DE LECTURE OUVRE `anon`, SUR AU MOINS DEUX BUCKETS.
--     GET inscriptions/photos/26-27 A002.jpg          → 200 ·  34 241 o
--     GET inscriptions/documents/…/acte_naissance.png → 200 · 420 881 o
--     GET devoirs/migration/1783032894322_01.jpg      → 200 · 172 381 o
--
-- La cause est donc une POLITIQUE `SELECT` permissive sur
-- `storage.objects`, et non un bucket marqué public.
--
-- Les trois requêtes ci-dessous confirment ce que votre rôle peut voir. Si
-- l'une échoue par manque de droit, ce n'est pas grave : la conclusion
-- ci-dessus tient déjà par la mesure.

-- ── 1 · Les buckets et leur drapeau `public` ──────────────────────────
-- ATTENDU : `inscriptions` et `devoirs` avec public = false.
-- Si l'un est à true, la fermeture passe par le tableau de bord Storage,
-- pas par du SQL.
select id, name, public, file_size_limit, created_at
  from storage.buckets
 order by name;

-- ── 2 · Les politiques du stockage ────────────────────────────────────
-- `pg_policies` est une vue système : la lire ne demande pas d'être
-- propriétaire. Si elle répond, c'est la liste exacte des noms — que je ne
-- devinerai pas.
-- ATTENDU : au moins une ligne cmd = SELECT dont `roles` contient `anon`.
select policyname, cmd, roles::text, qual::text, with_check::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by cmd, policyname;

-- ── 3 · RLS est-elle active, et forcée ? ──────────────────────────────
-- ATTENDU : rls_active = true. Le comportement le prouve déjà ; ceci le
-- confirme au catalogue.
select relname, relrowsecurity as rls_active, relforcerowsecurity as rls_forcee
  from pg_class
 where relnamespace = 'storage'::regnamespace and relname in ('objects', 'buckets')
 order by relname;


-- ═══════════════════════════════════════════════════════════════════════
-- SI LA REQUÊTE 2 ÉCHOUE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Le tableau de bord Supabase donne la même information sans SQL :
--
--   Storage → Policies
--
-- Relevez, pour chaque politique de `objects` : son NOM EXACT, la commande
-- (SELECT / INSERT / UPDATE / DELETE), les rôles visés, et l'expression.
-- C'est cette liste qu'il me faut — je ne proposerai aucun `drop` sur un
-- nom supposé.
