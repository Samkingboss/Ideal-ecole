-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIERE — depots du responsable administratif
-- ═══════════════════════════════════════════════════════════════════════
--
-- ⚠ Meme voie : tableau de bord. `storage.objects` n est pas administrable
--   depuis le SQL Editor de ce projet.
--
-- A n executer que si l un des trois depots ouvre plus que prevu.
--
--   Storage → Policies → bucket `inscriptions`
--     depot_photo_direction              → ⋯ → Delete
--     depot_documents_direction          → ⋯ → Delete
--     depot_signature_parent_direction   → ⋯ → Delete
--
-- Ne PAS supprimer `depot_signature_direction` : elle sert la validation
-- d un dossier par la direction, un autre parcours, deja en service.
--
-- Consequence assumee du retour arriere : le responsable administratif ne
-- peut plus creer de dossier. Le formulaire redevient utilisable par les
-- parents non connectes seulement.

-- ATTENDU apres retour arriere : depots_direction = 1
select count(*) filter (where cmd = 'INSERT' and roles::text like '%authenticated%'
                          and coalesce(with_check,'') like '%ideal_est_direction%') as depots_direction
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects';
