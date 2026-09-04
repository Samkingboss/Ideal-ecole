-- Retour arrière du circuit d'accompagnement des préparations maternelles.
-- Les préparations et le stock historiques ne sont jamais supprimés.

begin;

drop function if exists public.configurer_bareme_assistantes_maternelle(jsonb);
drop function if exists public.confirmer_materiel_assistante(uuid, boolean, boolean, text);
drop function if exists public.traiter_materiel_administration(uuid, text, text);
drop function if exists public.traiter_materiel_surveillance(uuid, text, integer, text);
drop function if exists public.demander_materiel_assistante(uuid, jsonb);
drop function if exists public.enregistrer_contribution_assistante(uuid, text, text, text);
drop function if exists public.lire_circuit_assistantes_maternelle();
drop function if exists public.calculer_points_circuit_maternelle(uuid);
drop function if exists public.est_membre_actif_circuit_maternelle(text[]);

drop table if exists public.maternelle_circuit_evenements;
drop table if exists public.maternelle_materiel_circuit;
drop table if exists public.maternelle_contributions_assistantes;
drop table if exists public.maternelle_circuit_config;

commit;
