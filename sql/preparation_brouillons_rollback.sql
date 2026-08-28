-- Retour arriere complet de l'autosave serveur.
-- Les preparations officiellement soumises ne sont jamais touchees.

begin;

drop function if exists public.supprimer_brouillon_preparation(date, text);
drop function if exists public.sauver_brouillon_preparation(date, text, jsonb, bigint);
drop function if exists public.lire_brouillon_preparation(date, text);
drop table if exists public.preparation_brouillons;

commit;
