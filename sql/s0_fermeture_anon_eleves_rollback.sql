-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK — S0, fermeture d'urgence de public.eleves
--
-- ⚠ CE ROLLBACK ROUVRE À INTERNET LES DOSSIERS DE VOS ÉLÈVES.
--
-- Il rétablit littéralement la faille : n'importe qui disposant de la clé
-- publiable pourra de nouveau LIRE, MODIFIER et SUPPRIMER les 26 dossiers —
-- noms, dates de naissance, téléphones des parents, allergies et
-- restrictions alimentaires, et la photographie d'un enfant.
--
-- À N'UTILISER QUE si la fermeture casse un usage vital, et pour le temps
-- strictement nécessaire au diagnostic.
--
-- AVANT DE ROULER CECI : la cause la plus probable d'un blocage est une
-- page restée sur la clé publique. Vérifier d'abord que `pedago-archive`
-- est bien déployée avec sa session — la réparer est infiniment préférable
-- à rouvrir la table.
-- ═══════════════════════════════════════════════════════════════════════

begin;

grant select, insert, update, delete on table public.eleves  to anon;
grant select, insert, update, delete on table public.classes to anon;

commit;

-- Après ce rollback, la recette DOIT repasser au rouge.
-- Si elle reste verte, le rollback n'a pas pris : vérifiez-le avant de
-- conclure quoi que ce soit.
