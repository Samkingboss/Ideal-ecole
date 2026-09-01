-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK — Phase 2, creation securisee des comptes du personnel
--
-- ⚠ CE ROLLBACK NE REND PAS LA CREATION DE COMPTES FONCTIONNELLE.
-- Il retire le mecanisme neuf ; il ne repare pas l'ancien, qui etait deja
-- casse (users.identifiant est NOT NULL et enregistrer_utilisateur ne le
-- pose pas). Apres ce rollback, creer un membre echoue de nouveau.
--
-- Il ne touche ni les comptes existants, ni users_secrets, ni le
-- confinement de la Phase 1.
--
-- Les identites Auth deja creees par api/personnel-creer.js SURVIVENT :
-- elles vivent dans auth.users, hors de ce fichier. Les membres deja
-- actives continuent de se connecter. C'est voulu — supprimer des
-- identites en rollback enfermerait des gens dehors.
-- ═══════════════════════════════════════════════════════════════════════

begin;

drop function if exists public.consommer_acces_personnel(text);
drop function if exists public.lire_etat_acces_personnel();
drop function if exists public.emettre_acces_personnel(uuid);
drop function if exists public.rattacher_membre_personnel(uuid,text,text,text,text,text,text,text);
drop function if exists public.identifiant_disponible(text,text);

-- Les liens en transit deviennent inoperants : la page d'activation
-- n'aura plus de fonction a appeler. Les membres non actives devront
-- attendre la remise en service.
drop table if exists public.acces_personnel;

-- Le numero WhatsApp du personnel est perdu. Le sauvegarder d'abord si
-- l'on compte revenir :
--   create table personnel_contact_sauvegarde as
--     select * from public.personnel_contact;
drop table if exists public.personnel_contact;

commit;

-- Apres ce rollback, la recette DOIT repasser au rouge. Si elle reste
-- verte, le rollback n'a pas pris.
