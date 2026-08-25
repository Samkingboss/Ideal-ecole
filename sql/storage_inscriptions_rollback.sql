-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE — bucket `inscriptions`
-- ═══════════════════════════════════════════════════════════════════════
--
-- ⚠ AUCUNE MODIFICATION EXÉCUTABLE ICI NON PLUS. `storage.objects` n'est
--   pas administrable depuis le SQL Editor de ce projet (42501, le rôle
--   n'est pas propriétaire et ne peut pas emprunter le propriétaire).
--   Les gestes se font au tableau de bord.
--
-- À n'exécuter que si la fermeture casse un usage légitime non prévu.
--
-- ── GESTE A — rétablir la lecture anonyme telle qu'elle était ──────────
--
--   Storage → Policies → bucket `inscriptions` → New policy
--                      → For full customization
--
--     Policy name        lecture_inscriptions_storage
--     Allowed operation  SELECT
--     Target roles       anon
--     USING expression   bucket_id = 'inscriptions'
--
-- ── GESTE B — retirer la politique ajoutée par la fermeture ───────────
--
--   Storage → Policies → lecture_inscriptions_direction → ⋯ → Delete
--
-- Le geste B est facultatif : la garder ne rouvre rien, elle ne concerne
-- que la direction authentifiée. Ne la retirer que pour revenir à l'état
-- exactement antérieur.


-- Contrôle : l'état d'origine est rétabli.
-- ATTENDU : une ligne, SELECT, {anon}, bucket_id = 'inscriptions'
select policyname, cmd, roles::text, qual::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'lecture_inscriptions_storage';
