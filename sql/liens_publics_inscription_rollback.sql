-- ROLLBACK LOOP 2 · Ne supprime aucune inscription ni aucun objet Storage.

begin;

revoke all on function public.lire_suivi_inscription(text) from public, anon, authenticated;
revoke all on function public.creer_inscription_avec_suivi(jsonb) from public, anon, authenticated;

drop function if exists public.lire_suivi_inscription(text);
drop function if exists public.creer_inscription_avec_suivi(jsonb);
drop table if exists public.liens_publics_inscription;

commit;
