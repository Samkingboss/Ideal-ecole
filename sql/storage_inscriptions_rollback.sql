-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE — bucket `inscriptions`
-- ═══════════════════════════════════════════════════════════════════════
--
-- À n'exécuter que si la fermeture casse un usage légitime non prévu.
-- Rétablit exactement la politique retirée, avec son nom et son expression
-- d'origine, et retire celle que la fermeture avait ajoutée.

begin;

set local role supabase_storage_admin;

drop policy if exists lecture_inscriptions_direction on storage.objects;

drop policy if exists lecture_inscriptions_storage on storage.objects;
create policy lecture_inscriptions_storage
  on storage.objects
  for select
  to anon
  using (bucket_id = 'inscriptions');

reset role;

commit;

-- Contrôle : la politique d'origine est de retour.
-- ATTENDU : 1 ligne, SELECT, {anon}, bucket_id = 'inscriptions'
select policyname, cmd, roles::text, qual::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'lecture_inscriptions_storage';
