-- Purge des données d'essai laissées par la vérification du circuit matériel,
-- le 16 août 2026.
--
-- Ces lignes ne sont pas supprimables depuis l'application : aucune politique
-- de DELETE n'est ouverte sur ces tables, et c'est voulu — un mouvement de
-- stock et une demande laissent trace. Seul le SQL Editor peut les retirer.
--
-- Elles sont inoffensives : l'article est déjà désactivé, il n'apparaît ni au
-- catalogue du surveillant ni dans la liste des enseignants. Ne passez ce
-- script que si vous voulez un historique parfaitement propre au démarrage.
--
-- L'ordre compte : les mouvements et la demande référencent l'article.

delete from public.mouvements_stock
 where materiel_id in (select id from public.materiels where nom like 'ZZ ESSAI%');

delete from public.demandes_materiel
 where libelle like 'ZZ ESSAI%';

delete from public.materiels
 where nom like 'ZZ ESSAI%';

-- Contrôle : les trois comptes doivent être à zéro.
select 'materiels d essai'  as reste, count(*) from public.materiels          where nom     like 'ZZ ESSAI%'
union all select 'demandes d essai',        count(*) from public.demandes_materiel where libelle like 'ZZ ESSAI%'
union all select 'mouvements orphelins',    count(*) from public.mouvements_stock  where materiel_id not in (select id from public.materiels);
