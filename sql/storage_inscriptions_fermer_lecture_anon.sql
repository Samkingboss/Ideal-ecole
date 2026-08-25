-- ═══════════════════════════════════════════════════════════════════════
-- BUCKET `inscriptions` — RETIRER LA LECTURE ANONYME
-- ═══════════════════════════════════════════════════════════════════════
--
-- ⚠ CE FICHIER NE CONTIENT AUCUNE MODIFICATION EXÉCUTABLE.
--   Les deux gestes se font au tableau de bord. Seuls les CONTRÔLES
--   ci-dessous se collent dans le SQL Editor : ils sont en lecture seule.
--
-- ── Pourquoi pas de SQL ────────────────────────────────────────────────
--
-- `drop policy` et `create policy` sur `storage.objects` exigent d'être
-- propriétaire de la table. Le propriétaire est `supabase_storage_admin`,
-- et le rôle du SQL Editor n'en est pas membre. Mesuré, deux fois :
--
--   alter table storage.objects enable row level security
--     → 42501 : must be owner of table objects
--   set local role supabase_storage_admin
--     → 42501 : permission denied to set role "supabase_storage_admin"
--
-- Il ne s'agit donc pas d'une syntaxe à corriger : la table n'est pas
-- administrable depuis l'éditeur SQL de ce projet. L'interface Storage →
-- Policies, elle, passe par le rôle propriétaire.
--
-- ── La politique en cause ──────────────────────────────────────────────
--
--   lecture_inscriptions_storage · SELECT · {anon}
--   qual : bucket_id = 'inscriptions'
--
-- Elle donne à la clé publiable la lecture de TOUS les objets du bucket.
-- Mesuré :
--   GET /object/inscriptions/photos/26-27 A002.jpg          → 200 ·  34 241 o
--   GET /object/inscriptions/documents/…/acte_naissance.png → 200 · 420 881 o
--
-- ── Pourquoi DEUX gestes, et non un ────────────────────────────────────
--
-- Les quatre politiques du bucket sont cette lecture anonyme, deux
-- `INSERT {anon}` et un `UPDATE {anon}`. AUCUNE ne donne la lecture à
-- `authenticated` : la lecture anonyme est la SEULE lecture du bucket,
-- celle par laquelle passe aussi la direction.
--
-- `InscriptionsValidation` appelle `createSignedUrl()` sur la signature du
-- parent ; un lien signé exige le droit de lecture sous-jacent. Retirer la
-- lecture anonyme sans rien mettre à la place ferme le bucket à tout le
-- monde et fait tomber l'écran de validation.
--
-- ── Ce qui n'est PAS touché ────────────────────────────────────────────
--
--   upload_inscriptions   INSERT {anon}   conservé
--   upload_justificatifs  INSERT {anon}   conservé
--   maj_justificatifs     UPDATE {anon}   conservé
--   le bucket `devoirs`                   pas touché — il est PUBLIC, ce
--                                         qui est un autre mécanisme, à
--                                         traiter après la bascule de
--                                         `getPublicUrl()` vers des URL
--                                         signées.
--
-- ═══════════════════════════════════════════════════════════════════════
-- GESTE 1 — CRÉER LA LECTURE DIRECTION   (à faire EN PREMIER)
-- ═══════════════════════════════════════════════════════════════════════
--
-- On ouvre avant de fermer : à aucun instant le bucket n'est illisible
-- pour la direction, et si le geste 2 devait attendre, rien n'est cassé.
--
--   Storage → Policies → bucket `inscriptions` → New policy
--                      → For full customization
--
--     Policy name        lecture_inscriptions_direction
--     Allowed operation  SELECT   (cette case seule)
--     Target roles       authenticated   (cette seule ; pas `anon`,
--                                         et surtout pas le champ vide,
--                                         qui vaudrait « tous les rôles »)
--     USING expression   bucket_id = 'inscriptions' and public.ideal_est_direction()
--
-- `public.ideal_est_direction()` est SECURITY DEFINER, lit `auth.uid()`
-- et jamais une valeur du client ; `execute` est déjà accordé à
-- `authenticated` (sql/rls_finances_et_dossiers.sql).
--
-- ═══════════════════════════════════════════════════════════════════════
-- GESTE 2 — SUPPRIMER LA LECTURE ANONYME
-- ═══════════════════════════════════════════════════════════════════════
--
--   Storage → Policies → bucket `inscriptions`
--                      → lecture_inscriptions_storage → ⋯ → Delete
--
-- Ne supprimer QUE celle-là. Les trois politiques d'écriture restent.


-- ═══════════════════════════════════════════════════════════════════════
-- CONTRÔLES — lecture seule, à coller dans le SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- S1 — les politiques du bucket, après les deux gestes.
--      ATTENDU : quatre lignes
--        lecture_inscriptions_direction  SELECT  {authenticated}
--        upload_inscriptions             INSERT  {anon}
--        upload_justificatifs            INSERT  {anon}
--        maj_justificatifs               UPDATE  {anon}
--      et AUCUNE ligne SELECT ou ALL visant anon.
select policyname, cmd, roles::text, qual::text, with_check::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by cmd, policyname;

-- S2 — verdict chiffré, pour ne pas juger à l'œil sur S1.
--      ATTENDU : lecture_anon_restante = 0  et  lecture_direction = 1
select
  count(*) filter (
    where cmd in ('SELECT', 'ALL')
      and roles::text like '%anon%'
      and coalesce(qual, '') like '%inscriptions%'
  ) as lecture_anon_restante,
  count(*) filter (
    where policyname = 'lecture_inscriptions_direction'
  ) as lecture_direction,
  count(*) filter (
    where policyname in ('upload_inscriptions', 'upload_justificatifs', 'maj_justificatifs')
  ) as ecritures_conservees   -- ATTENDU : 3
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects';

-- S3 — le bucket n'est pas devenu public au passage.
--      ATTENDU : public = false
select name, public from storage.buckets where name = 'inscriptions';
