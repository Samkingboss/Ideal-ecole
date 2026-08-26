-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIERE — cibles de la notification des preparations
-- ═══════════════════════════════════════════════════════════════════════
--
-- A n executer que si le directeur decide que le responsable administratif
-- doit de nouveau recevoir le pedagogique.
--
-- ⚠ Le retour arriere SEUL ne suffit pas a retablir l ancien comportement :
--   le centre de notifications ne fait plus lire `notifs_directeur` au
--   responsable administratif. Il faudrait aussi revenir sur ce point dans
--   src/pages/NotificationCenter.jsx.
--
-- Rejouer sql/notification_preparations.sql apres avoir remis
--   v_cles text[] := array['directeur', 'responsable_administratif'];
-- Le corps de la fonction est trop long pour etre recopie ici sans risque
-- de divergence : on rejoue le fichier source, qui fait foi.

-- ATTENDU apres retour arriere : administratif_cible = true
select exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                where ns.nspname='public' and p.proname='notifier_preparation'
                  and p.prosrc like '%responsable_administratif%') as administratif_cible;
