-- Retour arrière de l'espace Relations familles & Vie scolaire.
-- ATTENTION : ce rollback supprime les prospects, relances, suivis
-- d'anniversaire et visites saisis depuis l'installation de la migration.
begin;

revoke all on function public.traiter_rappels_anniversaires() from authenticated;
revoke all on function public.sauver_suivi_anniversaire(uuid,text,text,text) from authenticated;
revoke all on function public.lire_suivis_anniversaires(text) from authenticated;
revoke all on function public.clore_visite_accueil(uuid,timestamptz,text) from authenticated;
revoke all on function public.enregistrer_visite_accueil(text,text,text,uuid,text,text,timestamptz,text) from authenticated;
revoke all on function public.lire_visites_accueil(timestamptz,timestamptz) from authenticated;
revoke all on function public.enregistrer_relance_famille(uuid,uuid,text,text,timestamptz,text,text,text,text,date) from authenticated;
revoke all on function public.lire_relances_familles() from authenticated;
revoke all on function public.sauver_prospect_famille(uuid,text,text,integer,uuid[],text,text,date,text) from authenticated;
revoke all on function public.lire_prospects_familles() from authenticated;

drop function if exists public.traiter_rappels_anniversaires();
drop function if exists public.sauver_suivi_anniversaire(uuid,text,text,text);
drop function if exists public.lire_suivis_anniversaires(text);
drop function if exists public.clore_visite_accueil(uuid,timestamptz,text);
drop function if exists public.enregistrer_visite_accueil(text,text,text,uuid,text,text,timestamptz,text);
drop function if exists public.lire_visites_accueil(timestamptz,timestamptz);
drop function if exists public.enregistrer_relance_famille(uuid,uuid,text,text,timestamptz,text,text,text,text,date);
drop function if exists public.lire_relances_familles();
drop function if exists public.sauver_prospect_famille(uuid,text,text,integer,uuid[],text,text,date,text);
drop function if exists public.lire_prospects_familles();

drop table if exists public.relations_familles_audit;
drop table if exists public.suivis_anniversaires;
drop table if exists public.visites_accueil;
drop table if exists public.relances_familles;
drop table if exists public.prospects_classes;
drop table if exists public.prospects_familles;

commit;
