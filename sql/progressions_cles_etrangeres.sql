-- Les clés étrangères manquantes de `progressions`.
--
-- C'est le défaut n° 2 du document de reprise, et il coûte cher : sans lien
-- déclaré entre `progressions` et `objectifs`, PostgREST refuse toute jointure
-- imbriquée et répond 400. Trois écrans en dépendent et se calculent donc sur
-- du vide, sans qu'aucune erreur ne soit visible :
--
--   · DirecteurApp — les statistiques pédagogiques par classe ;
--   · ProfApp      — le chargement des check-points ;
--   · ConseillerApp — les résultats pédagogiques du rapport hebdomadaire.
--
-- Ce correctif était bloqué par des lignes orphelines : `progressions`
-- renvoyait à des objectifs supprimés depuis. La table a été purgée entre-temps
-- et compte aujourd'hui zéro ligne — le lien peut donc être posé sans avoir à
-- arbitrer le sort d'anciennes évaluations.
--
-- À exécuter dans le SQL Editor de Supabase.


-- ── 1. Vérification préalable ────────────────────────────────────────────
--
-- Si des lignes ont été saisies depuis, ce compte doit être à zéro avant
-- d'aller plus loin. Une contrainte posée sur des données incohérentes échoue,
-- et c'est tant mieux : mieux vaut refuser que masquer.

select count(*) as progressions_orphelines
  from public.progressions p
 where p.objectif_id is not null
   and not exists (select 1 from public.objectifs o where o.id = p.objectif_id);


-- ── 2. Le lien vers les objectifs ────────────────────────────────────────
--
-- `on delete restrict` : on ne peut pas supprimer un objectif qui a déjà été
-- évalué. C'est volontaire. `cascade` effacerait au passage les notes des
-- élèves, `set null` recréerait exactement les orphelins qu'on répare ici.
-- Refuser la suppression oblige à une décision explicite.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'progressions_objectif_fk') then
    alter table public.progressions
      add constraint progressions_objectif_fk
      foreign key (objectif_id) references public.objectifs(id) on delete restrict;
  end if;
end $$;


-- ── 3. Le lien vers les compétences ──────────────────────────────────────
--
-- Même raison : `rapports.html` doit aujourd'hui rapprocher les compétences en
-- mémoire, faute de lien déclaré. La colonne peut être nulle — toutes les
-- progressions ne visent pas une compétence — mais quand elle est renseignée,
-- elle doit désigner quelque chose qui existe.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'progressions_competence_fk')
     and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'progressions'
                    and column_name = 'competence_id') then
    alter table public.progressions
      add constraint progressions_competence_fk
      foreign key (competence_id) references public.competences(id) on delete restrict;
  end if;
end $$;


-- ── 4. Index de lecture ──────────────────────────────────────────────────
-- Les jointures se feront désormais côté base : autant qu'elles soient rapides.

create index if not exists progressions_objectif_idx   on public.progressions (objectif_id);
create index if not exists progressions_competence_idx on public.progressions (competence_id);


-- ── 5. Contrôle ──────────────────────────────────────────────────────────
-- Les deux contraintes doivent apparaître.

select conname as contrainte_posee
  from pg_constraint
 where conrelid = 'public.progressions'::regclass
   and contype = 'f'
 order by conname;
