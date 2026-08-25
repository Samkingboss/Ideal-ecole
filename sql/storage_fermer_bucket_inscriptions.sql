-- ═══════════════════════════════════════════════════════════════════════
-- LES DOCUMENTS DES ENFANTS NE SONT PAS PUBLICS
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Ce qui est atteignable aujourd'hui ─────────────────────────────────
--
-- Le bucket `inscriptions` n'est « privé » qu'au sens où la route
-- `/object/public/` répond 400. La CLÉ PUBLIABLE, elle, y a un accès
-- complet en lecture. Mesuré :
--
--   list  inscriptions/          → documents, photos, signatures
--   list  inscriptions/photos    → « 26-27 A002.jpg », « 30f5a6ca….jpg », …
--   GET   photos/26-27 A002.jpg  → 200 ·  34 241 o · JPEG image data
--   GET   signatures/….png       → 200 ·  55 696 o · PNG 900×660
--   GET   documents/…/acte_naissance.png → 200 · 420 881 o · PNG 1170×2532
--   POST  /object/sign/…         → une URL signée est délivrée
--
-- La photo d'un enfant, la signature manuscrite de son parent et son acte
-- de naissance sont téléchargeables avec la clé qu'embarque le navigateur
-- de tout visiteur. Les noms de fichiers portent le matricule, et la liste
-- les donne tous.
--
-- Fermer `documents_inscription` a retiré les métadonnées. Les FICHIERS
-- sont restés.
--
-- L'écriture est déjà refusée à `anon` (403 · new row violates…). Seule la
-- lecture est à fermer.
--
-- ── Lecteurs tracés ────────────────────────────────────────────────────
--
--   InscriptionsValidation.jsx  createSignedUrl, upload, remove — portail
--                               authentifié
--   inscription.html            upload — page réservée au personnel, session
--                               du portail partagée
--   comptabilite.html           upload, getPublicUrl — idem
--   fiche.html                  NE LIT PLUS le stockage depuis la fermeture
--                               de la carte scolaire
--
-- Aucune surface anonyme ne lit ce bucket. Le dépôt d'un dossier par un
-- parent passe par `creer_inscription`, qui n'écrit pas de fichier : les
-- pièces sont téléversées par le secrétariat, authentifié.
--
-- ⚠ NE PAS EXÉCUTER LA SECTION 2 AVANT D'AVOIR LU LA SECTION 1.
--   Les politiques de `storage.objects` valent pour TOUS les buckets. En
--   retirer une au jugé couperait `devoirs` ou `documents` du même coup.
--   Aucun nom n'est deviné ici — c'est ce qui a fait échouer une migration
--   précédente.

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · DIAGNOSTIC — strictement en lecture
-- ═══════════════════════════════════════════════════════════════════════

-- 1.a — toutes les politiques du stockage, avec les buckets qu'elles visent.
select policyname, cmd, roles::text, qual::text, with_check::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by cmd, policyname;

-- 1.b — les buckets déclarés, et lesquels sont marqués publics.
select id, name, public, created_at
  from storage.buckets
 order by name;

-- 1.c — RLS est-elle seulement active sur les objets ?
select relname, relrowsecurity as rls_active
  from pg_class where oid = 'storage.objects'::regclass;


-- ═══════════════════════════════════════════════════════════════════════
-- 2 · FERMETURE — à n'exécuter qu'après lecture de la section 1
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ne retire QUE les politiques de lecture qui ouvrent `anon` sur le bucket
-- `inscriptions`, par leur nom réel lu dans le catalogue. Les politiques
-- qui ne mentionnent pas ce bucket ne sont pas touchées : `devoirs` et
-- `documents` continuent de fonctionner comme aujourd'hui.

begin;

alter table storage.objects enable row level security;

do $$
declare p record; n integer := 0;
begin
  for p in
    select policyname
      from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and cmd in ('SELECT', 'ALL')
       and roles::text like '%anon%'
       -- soit la politique cite explicitement ce bucket, soit elle ouvre
       -- TOUS les buckets — les deux doivent partir.
       and (coalesce(qual, '') like '%inscriptions%'
            or coalesce(qual, '') !~ 'bucket_id')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
    raise notice 'politique de stockage retirée : %', p.policyname;
    n := n + 1;
  end loop;
  raise notice '% politique(s) retirée(s)', n;
end
$$;

-- La lecture du bucket revient à la direction. Les pièces d'un dossier
-- d'inscription relèvent du même périmètre que le dossier lui-même.
drop policy if exists inscriptions_lecture_direction on storage.objects;
create policy inscriptions_lecture_direction
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'inscriptions' and public.ideal_est_direction());

-- Contrôle DANS la transaction : plus aucune lecture anonyme sur ce bucket.
do $$
declare n integer;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and cmd in ('SELECT', 'ALL')
     and roles::text like '%anon%'
     and (coalesce(qual, '') like '%inscriptions%'
          or coalesce(qual, '') !~ 'bucket_id');
  if n > 0 then
    raise exception 'FERMETURE INCOMPLÈTE : % politique(s) laissent anon lire ce bucket', n;
  end if;
end
$$;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- V1 — les politiques restantes sur le stockage.
--      ATTENDU : `inscriptions_lecture_direction` SELECT {authenticated},
--                et aucune politique SELECT/ALL visant anon sur ce bucket.
select policyname, cmd, roles::text, qual::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by cmd, policyname;

-- V2 — le bucket n'est pas marqué public.
--      ATTENDU : public = false
select name, public from storage.buckets where name = 'inscriptions';

-- V3 — les autres buckets n'ont pas perdu leurs politiques.
--      ATTENDU : à comparer avec la sortie 1.a
select count(*) as politiques_storage
  from pg_policies where schemaname = 'storage' and tablename = 'objects';


-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- La section 1.a donne les définitions exactes à rétablir. Au minimum :
--
-- begin;
-- drop policy if exists inscriptions_lecture_direction on storage.objects;
-- create policy inscriptions_lecture_anon on storage.objects
--   for select to anon using (bucket_id = 'inscriptions');
-- commit;
