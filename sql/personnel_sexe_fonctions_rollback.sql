-- ROLLBACK — accord grammatical des fonctions du personnel
--
-- Ce retour retire les deux nouvelles RPC. La colonne `users.sexe` et les
-- valeurs déjà saisies sont volontairement conservées : effacer ces données
-- personnelles rendrait le rollback destructeur et ferait perdre les accords
-- déjà vérifiés par la Direction.

begin;

drop function if exists public.modifier_sexe_personnel(uuid,text);
drop function if exists public.rattacher_membre_personnel(uuid,text,text,text,text,text,text,text,text);

commit;

