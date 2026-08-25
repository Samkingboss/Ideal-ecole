-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIERE — table `periodes`
-- ═══════════════════════════════════════════════════════════════════════
--
-- ⚠ LES DOUBLONS SUPPRIMES NE REVIENNENT PAS, et c est voulu : c etaient
--   des copies strictement identiques d un seed passe trois fois. Rien n en
--   dependait -- les huit references pointaient toutes sur un seul id, qui
--   a ete conserve. Restaurer les clones ne restaurerait aucune donnee.
--
-- Ce retour arriere annule les deux gestes reversibles : l annee ajoutee et
-- le verrou. Le code retombe alors sur son calendrier de repli, celui de
-- l agenda -- l ecran continue de fonctionner.

begin;

delete from public.periodes where annee_scolaire = '2026-2027';

drop index if exists public.periodes_annee_ordre_unique;

commit;

-- ATTENDU : une seule ligne, 2024-2025 -> 5
select annee_scolaire, count(*) from public.periodes group by 1 order by 1;
