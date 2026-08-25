-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE G — CONTRÔLE D'INNOCUITÉ APRÈS ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════
--
-- Les six tests ont écrit pour de vrai : ils ont déposé des notifications
-- dans les deux boîtes de direction et ajouté une demande de correction à
-- une préparation. Le `rollback` doit avoir tout annulé.
--
-- Ce bloc ne vérifie pas que les tests ont réussi — c'est déjà fait. Il
-- vérifie qu'ils n'ont RIEN LAISSÉ. Un test qui salit la production est
-- pire qu'un test absent : il faut ensuite deviner ce qui vient de lui.
--
-- STRICTEMENT EN LECTURE. Aucun begin, aucune écriture, aucune fonction
-- appelée. À exécuter d'un seul tenant : la dernière requête est la
-- synthèse, les trois premières donnent le détail.

-- ── G.1 · les deux boîtes de direction ─────────────────────────────────
select key,
       jsonb_array_length(value) as entrees,
       updated_at,
       (select count(*) from jsonb_array_elements(value) n
         where n->>'ref' = '9a0dae7e-048b-41e0-b620-228371c3cd50') as traces_de_test
  from public.app_state
 where app = 'notifications'
   and key in ('notifs_directeur', 'notifs_responsable_administratif')
 order by key;

-- ── G.2 · la préparation utilisée par les tests ────────────────────────
select id,
       status,
       jsonb_array_length(coalesce(historique_statuts, '[]'::jsonb)) as evenements,
       (select count(*) from jsonb_array_elements(coalesce(historique_statuts,'[]'::jsonb)) e
         where e->>'par_nom' = 'FIXTURE DE TEST') as fixtures_restantes,
       (select count(*) from jsonb_array_elements(coalesce(historique_statuts,'[]'::jsonb)) e
         where e->>'action' = 'correction_demandee') as cycles
  from public.preparations
 where id = '9a0dae7e-048b-41e0-b620-228371c3cd50';

-- ── G.3 · aucune fixture ailleurs, dans aucune préparation ─────────────
-- Le test n'en visait qu'une, mais on ne le croit pas sur parole.
select count(*) as preparations_polluees
  from public.preparations p
 where exists (
   select 1 from jsonb_array_elements(coalesce(p.historique_statuts,'[]'::jsonb)) e
    where e->>'par_nom' = 'FIXTURE DE TEST'
       or e->>'commentaire' like 'FIXTURE%');

-- ── G.4 · synthèse ─────────────────────────────────────────────────────
-- Une seule ligne, un seul verdict.
with boites as (
  select coalesce(sum((select count(*) from jsonb_array_elements(value) n
                        where n->>'id' like 'prep-%')), 0) as notifs_prep,
         coalesce(sum(jsonb_array_length(value)), 0) as entrees_totales
    from public.app_state
   where app = 'notifications'
     and key in ('notifs_directeur', 'notifs_responsable_administratif')
), preps as (
  select count(*) as polluees
    from public.preparations p
   where exists (
     select 1 from jsonb_array_elements(coalesce(p.historique_statuts,'[]'::jsonb)) e
      where e->>'par_nom' = 'FIXTURE DE TEST')
)
select b.entrees_totales,
       b.notifs_prep     as notifications_de_preparation,
       p.polluees        as preparations_polluees,
       case when b.entrees_totales = 38
             and b.notifs_prep = 0
             and p.polluees = 0
            then 'PASS — le rollback a tout annulé'
            else 'FAIL — des données de test ont persisté' end as verdict
  from boites b, preps p;
