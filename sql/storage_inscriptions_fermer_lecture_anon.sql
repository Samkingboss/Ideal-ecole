-- ═══════════════════════════════════════════════════════════════════════
-- BUCKET `inscriptions` — RETIRER LA LECTURE ANONYME
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── La politique en cause, relevée au catalogue ────────────────────────
--
--   lecture_inscriptions_storage · SELECT · {anon}
--   qual : bucket_id = 'inscriptions'
--
-- Elle donne à la clé publiable la lecture de TOUS les objets du bucket.
-- Mesuré :
--   GET /object/inscriptions/photos/26-27 A002.jpg          → 200 ·  34 241 o
--   GET /object/inscriptions/documents/…/acte_naissance.png → 200 · 420 881 o
--
-- ── Pourquoi ce script fait DEUX choses, et non une ────────────────────
--
-- Les quatre politiques du bucket sont : cette lecture anonyme, deux
-- `INSERT {anon}` et un `UPDATE {anon}`. AUCUNE ne donne la lecture à
-- `authenticated`.
--
-- Retirer la seule lecture existante fermerait donc le bucket À TOUT LE
-- MONDE, direction comprise. `InscriptionsValidation` appelle
-- `createSignedUrl()` sur la signature du parent : sans droit de lecture,
-- l'appel échoue et l'écran de validation perd la signature.
--
-- Le contrôle 8 de la recette — « accès authenticated Direction/RA aux
-- documents → PASS » — serait alors rouge, et il aurait raison.
--
-- On retire donc la lecture anonyme ET on ouvre la lecture à la direction.
-- C'est le minimum qui laisse le système fonctionnel ; en faire moins
-- casserait un écran.
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
-- ⚠ DROIT REQUIS. `drop policy` sur `storage.objects` demande d'être
--   propriétaire de la table — c'est ce qui a fait échouer
--   `alter table … enable row level security`. Le `set local role`
--   ci-dessous essaie d'emprunter le rôle propriétaire. S'il échoue, la
--   suppression se fait sans SQL, par le tableau de bord :
--   Storage → Policies → `lecture_inscriptions_storage` → Delete.
--
-- IDEMPOTENT : rejouable. RÉVERSIBLE : bloc séparé en fin de fichier.
-- Aucune donnée, aucun fichier touché.

begin;

-- Emprunt du rôle propriétaire du stockage. Sans lui, `drop policy` est
-- refusé avec « must be owner of table objects ».
set local role supabase_storage_admin;

drop policy if exists lecture_inscriptions_storage on storage.objects;

-- La lecture revient à la direction — même périmètre que le dossier
-- d'inscription lui-même, déjà réservé à `ideal_est_direction()`.
drop policy if exists lecture_inscriptions_direction on storage.objects;
create policy lecture_inscriptions_direction
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'inscriptions' and public.ideal_est_direction());

reset role;

-- ── Contrôle DANS la transaction ──────────────────────────────────────
do $$
declare n integer;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and cmd in ('SELECT', 'ALL')
     and roles::text like '%anon%'
     and coalesce(qual, '') like '%inscriptions%';
  if n > 0 then
    raise exception 'FERMETURE INCOMPLÈTE : % politique(s) laissent anon lire ce bucket', n;
  end if;

  select count(*) into n
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'lecture_inscriptions_direction';
  if n <> 1 then
    raise exception 'LECTURE DIRECTION ABSENTE : la direction ne pourrait plus ouvrir un document';
  end if;
end
$$;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- S1 — les politiques du bucket, après correction.
--      ATTENDU : quatre lignes
--        lecture_inscriptions_direction  SELECT  {authenticated}
--        upload_inscriptions             INSERT  {anon}
--        upload_justificatifs            INSERT  {anon}
--        maj_justificatifs               UPDATE  {anon}
--      et AUCUNE ligne SELECT visant anon.
select policyname, cmd, roles::text, qual::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by cmd, policyname;

-- S2 — `lecture_inscriptions_storage` a bien disparu.
--      ATTENDU : 0
select count(*) as ancienne_lecture_anon
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'lecture_inscriptions_storage';

-- S3 — le bucket n'est pas devenu public au passage.
--      ATTENDU : public = false
select name, public from storage.buckets where name = 'inscriptions';
