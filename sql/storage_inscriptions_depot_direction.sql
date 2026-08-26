-- ═══════════════════════════════════════════════════════════════════════
-- BUCKET `inscriptions` — LE RESPONSABLE ADMINISTRATIF DOIT POUVOIR DEPOSER
-- ═══════════════════════════════════════════════════════════════════════
--
-- ⚠ AUCUNE MODIFICATION EXECUTABLE ICI. `storage.objects` n est pas
--   administrable depuis le SQL Editor de ce projet -- mesure deux fois :
--
--     alter table storage.objects enable row level security
--       -> 42501 must be owner of table objects
--     set local role supabase_storage_admin
--       -> 42501 permission denied to set role
--
--   Les gestes se font au tableau de bord. Seuls les CONTROLES en fin de
--   fichier se collent dans le SQL Editor : ils sont en lecture seule.
--
-- ── LA CAUSE, tracee ───────────────────────────────────────────────────
--
--   DirecteurApp.jsx:875     le RA ouvre /inscription.html pour creer un
--                            dossier -- c est SON parcours, pas seulement
--                            celui du parent
--   inscription.html:899     storageKey: 'ideal-auth' -- le formulaire
--                            partage la session du portail
--   -> un RA connecte y arrive donc avec un jeton `authenticated`
--
--   upload_inscriptions      INSERT · TO anon
--
-- Une policy `to anon` ne s applique JAMAIS au role `authenticated`. Le
-- premier depot du parcours -- la photo de l eleve -- est donc refuse :
-- « new row violates row-level security policy ».
--
-- Ce n est pas la fermeture des lectures anonymes qui a casse ce parcours :
-- c est la fusion des sessions, anterieure. Le meme mecanisme casse deja
-- `joindreJustificatif` dans comptabilite.html, hors de ce perimetre.
--
-- ── LE PARCOURS REEL, cartographie ─────────────────────────────────────
--
--   inscription.html:1364   photos/<ref>.jpg              upload   INSERT
--   inscription.html:1396   documents/<ref>/<piece>.<ext> upload   INSERT
--   inscription.html:1433   signatures/<ref>.png          upload   INSERT
--   inscription.html:1473   rpc creer_inscription                  --
--
-- AUCUN upsert, AUCUN remove(), AUCUN update() sur ce bucket dans ce
-- parcours. Il n existe pas non plus de chemin de modification d un dossier
-- deja depose. Donc : INSERT seul, sur trois prefixes. Ni UPDATE, ni
-- DELETE, ni SELECT supplementaire.
--
-- ── CE QU ON N AJOUTE PAS, ET POURQUOI ────────────────────────────────
--
--   UPDATE   le code ne remplace jamais une piece. L ajouter serait ouvrir
--            un droit que rien n exerce.
--   DELETE   aucun rollback par remove() sur ces prefixes. Decision deja
--            prise et tenue : un orphelin rare vaut mieux qu un droit de
--            suppression sur tout un prefixe.
--   SELECT   `lecture_inscriptions_direction` couvre deja la lecture, et
--            elle est prouvee : direction PASS, RA PASS, enseignante refusee.
--
-- ── LES TROIS GESTES ───────────────────────────────────────────────────
--
--   Storage → Policies → bucket `inscriptions` → New policy
--                      → For full customization
--
--   Pour chacune : Allowed operation = INSERT (cette case seule)
--                  Target roles      = authenticated (cette seule ; le
--                                      champ vide vaudrait « tous les roles »)
--
--   1. depot_photo_direction
--      WITH CHECK
--        bucket_id = 'inscriptions'
--        and (storage.foldername(name))[1] = 'photos'
--        and public.ideal_est_direction()
--
--   2. depot_documents_direction
--      WITH CHECK
--        bucket_id = 'inscriptions'
--        and (storage.foldername(name))[1] = 'documents'
--        and public.ideal_est_direction()
--
--   3. depot_signature_parent_direction
--      WITH CHECK
--        bucket_id = 'inscriptions'
--        and (storage.foldername(name))[1] = 'signatures'
--        and public.ideal_est_direction()
--
-- `documents/` porte un sous-dossier -- documents/<ref>/<piece>.ext -- mais
-- `foldername(name)[1]` rend bien « documents » : c est le PREMIER segment.
--
-- `ideal_est_direction()` est reutilisee, pas redoublee : elle rend
-- ideal_est(array['directeur','responsable_administratif']), donc elle
-- couvre exactement le RA et le directeur. Verifie dans
-- sql/rls_finances_et_dossiers.sql:55-63.
--
-- Trois policies plutot qu une seule a trois branches : chacune se lit, se
-- retire et se teste seule. Une policy unique melangeant les prefixes se
-- serait elargie a la premiere retouche.


-- ═══════════════════════════════════════════════════════════════════════
-- CONTROLES — lecture seule
-- ═══════════════════════════════════════════════════════════════════════

-- S1 · l inventaire complet du bucket.
--      ATTENDU : sept lignes
--        depot_photo_direction              INSERT  {authenticated}
--        depot_documents_direction          INSERT  {authenticated}
--        depot_signature_parent_direction   INSERT  {authenticated}
--        depot_signature_direction          INSERT  {authenticated}
--        upload_inscriptions                INSERT  {anon}
--        upload_justificatifs               INSERT  {anon}
--        maj_justificatifs                  UPDATE  {anon}
--        lecture_inscriptions_direction     SELECT  {authenticated}
--      et AUCUNE ligne SELECT ou ALL visant anon.
select policyname, cmd, roles::text, qual::text, with_check::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by cmd, policyname;

-- S2 · verdict chiffre, pour ne pas juger a l oeil sur S1.
select
  count(*) filter (where cmd in ('SELECT','ALL') and roles::text like '%anon%'
                     and coalesce(qual,'') like '%inscriptions%')      as lecture_anon,          -- 0
  count(*) filter (where policyname = 'lecture_inscriptions_direction') as lecture_direction,    -- 1
  count(*) filter (where cmd = 'INSERT' and roles::text like '%authenticated%'
                     and coalesce(with_check,'') like '%ideal_est_direction%') as depots_direction, -- 4
  count(*) filter (where cmd = 'INSERT' and roles::text like '%authenticated%'
                     and coalesce(with_check,'') not like '%foldername%')      as insert_trop_large, -- 0
  count(*) filter (where cmd = 'DELETE')                                as delete_toutes,        -- 0
  count(*) filter (where roles::text = '{public}')                      as policies_public       -- 0
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects';

-- S3 · aucun doublon de policy sur un meme couple (operation, prefixe).
select cmd, roles::text, count(*)
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 group by cmd, roles::text
 order by cmd;

-- S4 · le bucket n est pas devenu public.
--      ATTENDU : public = false
select name, public from storage.buckets where name = 'inscriptions';
