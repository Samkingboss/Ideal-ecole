-- ÉTAPE 1 sur 2 · IDENTIFIER les neuf lignes de sonde. LECTURE SEULE.
--
-- Ne rien supprimer avant que ce SELECT ait renvoyé EXACTEMENT huit lignes,
-- et que ces huit lignes soient bien celles attendues.
--
-- L'appariement porte sur le COUPLE (app, key), jamais sur `app` seul :
-- `cantine` et `rh` contiennent des données réelles à côté de leur sonde.
-- Aucun LIKE, aucun préfixe, aucune approximation.

select app, key, updated_at, jsonb_typeof(value) as type_valeur
  from public.app_state
 where (app, key) in (
   ('__probe__',      '__probe__'),
   ('__sonde_ideal',  '__sonde'),
   ('__sonde_x',      '__s'),
   ('audit_test',     'audit_test'),
   ('diagnostic',     'garde_ecriture_24_08'),
   ('cantine',        '__sonde_pointage'),
   ('rh',             '__sonde_dossier'),
   ('__garde__',      '__sonde_ecriture__'),
   ('__recette__',    '__recette__')
 )
 order by app, key;

-- ATTENDU : 9 lignes, et ces horodatages (relevés le 30/08/2026) :
--
--   __garde__      / __sonde_ecriture__     2026-08-30 08:28
--   __probe__      / __probe__              2026-08-23
--   __sonde_ideal  / __sonde                2026-08-24
--   __sonde_x      / __s                    2026-08-25
--   audit_test     / audit_test             2026-08-09
--   __recette__    / __recette__            2026-08-30 (créée par une sonde de recette,
--                                                      corrigée depuis pour ne plus écrire)
--   cantine        / __sonde_pointage       2026-08-25
--   diagnostic     / garde_ecriture_24_08   2026-08-24
--   rh             / __sonde_dossier        2026-08-25
--
-- ARRÊT SI le compte n'est pas 9 : ne pas exécuter l'étape 2.
