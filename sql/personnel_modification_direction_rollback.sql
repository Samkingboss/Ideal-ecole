-- Retire uniquement la possibilité de modifier une fiche complète.
-- Les corrections déjà enregistrées sont conservées : les annuler ici
-- recréerait précisément les erreurs administratives que cette fonction évite.

begin;

drop function if exists public.modifier_membre_personnel(
  uuid,text,text,text,text,text,text,text,boolean,uuid[]
);

commit;
