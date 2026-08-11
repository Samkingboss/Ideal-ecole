-- ═══════════════════════════════════════════════════════════════════════
-- EMPLOI DU TEMPS DU PRIMAIRE — École IDEAL
-- Application du document officiel « Emploi du temps Primaire Ideal » v1.0
-- Année scolaire 2026-2027. À exécuter dans le SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════════
--
-- La journée compte DOUZE SÉQUENCES de 30 minutes : S1 08h00 … S6 11h00
-- (bloc 1), S7 11h30 … S12 15h30 (bloc 2). Récréations et déjeuner n'en
-- sont pas : le temps réellement enseigné est de 360 min/jour, 30 h/semaine.
--
-- La grille est rangée par GROUPE, pas par classe. L'école compte six
-- classes, mais CE1/CE2 et CM1/CM2 sont jumelées et suivent la même grille.
-- Quatre grilles suffisent ; deux copies auraient fini par diverger.
--
-- Seules les SEMAINES IMPAIRES sont stockées : en semaine paire les deux
-- blocs sont permutés (§ 1.3), ce que l'application calcule à la lecture.

create table if not exists public.emploi_du_temps (
  id         uuid primary key default gen_random_uuid(),
  groupe     text not null,
  jour       smallint not null check (jour between 1 and 5),      -- 1 = lundi
  sequence   smallint not null check (sequence between 1 and 12),
  matiere    text not null,
  created_at timestamptz not null default now(),
  constraint edt_unicite unique (groupe, jour, sequence)
);

create index if not exists edt_groupe_jour_idx
  on public.emploi_du_temps (groupe, jour);

-- Qui enseigne quoi. Une matière d'un groupe est assurée par un seul
-- enseignant sur toute l'année (§ 2.1) : l'unicité l'impose.
create table if not exists public.affectations_matieres (
  id         uuid primary key default gen_random_uuid(),
  groupe     text not null,
  matiere    text not null,
  prof_id    uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint aff_unicite unique (groupe, matiere)
);

-- ── Règles d'accès ────────────────────────────────────────────────────
-- Supabase active RLS d'office : sans ces règles, l'application lirait la
-- grille mais ne pourrait rien y écrire. Il s'agit d'un paramétrage et non
-- d'observations sur un enfant : la suppression reste donc permise.

alter table public.emploi_du_temps enable row level security;
alter table public.affectations_matieres enable row level security;

drop policy if exists edt_lecture on public.emploi_du_temps;
create policy edt_lecture on public.emploi_du_temps for select using (true);
drop policy if exists edt_saisie on public.emploi_du_temps;
create policy edt_saisie on public.emploi_du_temps for insert with check (true);
drop policy if exists edt_correction on public.emploi_du_temps;
create policy edt_correction on public.emploi_du_temps for update using (true) with check (true);
drop policy if exists edt_suppression on public.emploi_du_temps;
create policy edt_suppression on public.emploi_du_temps for delete using (true);

drop policy if exists aff_lecture on public.affectations_matieres;
create policy aff_lecture on public.affectations_matieres for select using (true);
drop policy if exists aff_saisie on public.affectations_matieres;
create policy aff_saisie on public.affectations_matieres for insert with check (true);
drop policy if exists aff_correction on public.affectations_matieres;
create policy aff_correction on public.affectations_matieres for update using (true) with check (true);
drop policy if exists aff_suppression on public.affectations_matieres;
create policy aff_suppression on public.affectations_matieres for delete using (true);

-- ── Les quatre grilles (Partie 3 du document) ─────────────────────────
-- Une ligne = un groupe et un jour ; les douze matières sont données dans
-- l'ordre S1 → S12. Transcription vérifiée contre les totaux horaires que
-- le document annonce sous chaque grille (« Contrôle des volumes »).

insert into public.emploi_du_temps (groupe, jour, sequence, matiere)
select g.groupe, g.jour::smallint, s.ord::smallint, s.matiere
from (values
  ('CP1', 1, array['Lecture', 'Lecture', 'Écriture', 'Maths', 'Maths', 'Savoir-vivre', 'English', 'Mathematics', 'Mathematics', 'English', 'Science', 'Handwriting']), -- Lundi
  ('CP1', 2, array['Lecture', 'Lecture', 'Écriture', 'Maths', 'Maths', 'Sport', 'English', 'Mathematics', 'English', 'Arts', 'Arts', 'Science']), -- Mardi
  ('CP1', 3, array['Lecture', 'Lecture', 'Écriture', 'Maths', 'Maths', 'Savoir-vivre', 'English', 'Mathematics', 'Mathematics', 'English', 'English', 'Handwriting']), -- Mercredi
  ('CP1', 4, array['Lecture', 'Lecture', 'Lecture', 'Écriture', 'Maths', 'Maths', 'English', 'English', 'Mathematics', 'Science', 'Arts', 'Arts']), -- Jeudi
  ('CP1', 5, array['Lecture', 'Lecture', 'Écriture', 'Écriture', 'Maths', 'Sport', 'English', 'English', 'English', 'Mathematics', 'Science', 'Handwriting']), -- Vendredi
  ('CP2', 1, array['English', 'Mathematics', 'Mathematics', 'English', 'Science', 'Handwriting', 'Lecture', 'Lecture', 'Maths', 'Maths', 'Grammaire', 'Écriture']), -- Lundi
  ('CP2', 2, array['English', 'Mathematics', 'English', 'Arts', 'Arts', 'Science', 'Lecture', 'Lecture', 'Maths', 'Maths', 'Orthographe', 'Écriture']), -- Mardi
  ('CP2', 3, array['English', 'Mathematics', 'Mathematics', 'English', 'English', 'Handwriting', 'Lecture', 'Lecture', 'Maths', 'Maths', 'Vocabulaire', 'Écriture']), -- Mercredi
  ('CP2', 4, array['English', 'English', 'Mathematics', 'Science', 'Arts', 'Arts', 'Lecture', 'Maths', 'Grammaire', 'Orthographe', 'Écriture', 'Savoir-vivre']), -- Jeudi
  ('CP2', 5, array['English', 'English', 'English', 'Mathematics', 'Science', 'Handwriting', 'Lecture', 'Maths', 'Grammaire', 'Orthographe', 'Vocabulaire', 'Sport']), -- Vendredi
  ('CE1-CE2', 1, array['English', 'English', 'English', 'Mathematics', 'Mathematics', 'Science', 'Grammaire', 'Maths', 'Maths', 'Conjugaison', 'Orthographe', 'Questions de cours']), -- Lundi
  ('CE1-CE2', 2, array['English', 'English', 'PE', 'Mathematics', 'Science', 'Science', 'Grammaire', 'Maths', 'Maths', 'Conjugaison', 'Orthographe', 'Vocabulaire']), -- Mardi
  ('CE1-CE2', 3, array['TP et projets', 'TP et projets', 'TP et projets', 'TP et projets', 'Mathematics', 'Science', 'Grammaire', 'Maths', 'Maths', 'Conjugaison', 'Orthographe', 'Questions de cours']), -- Mercredi
  ('CE1-CE2', 4, array['English', 'English', 'English', 'PE', 'Mathematics', 'Mathematics', 'Grammaire', 'Maths', 'Maths', 'Conjugaison', 'Vocabulaire', 'Questions de cours']), -- Jeudi
  ('CE1-CE2', 5, array['English', 'English', 'English', 'English', 'Mathematics', 'Science', 'Orthographe', 'Maths', 'Art', 'Vocabulaire', 'Questions de cours', 'ECM']), -- Vendredi
  ('CM1-CM2', 1, array['Maths', 'Maths', 'Grammaire', 'Conjugaison', 'Orthographe', 'Questions de cours', 'English', 'English', 'English', 'Mathematics', 'Mathematics', 'Science']), -- Lundi
  ('CM1-CM2', 2, array['Maths', 'Maths', 'Grammaire', 'Conjugaison', 'Orthographe', 'Vocabulaire', 'English', 'English', 'PE', 'Mathematics', 'Science', 'Science']), -- Mardi
  ('CM1-CM2', 3, array['Maths', 'Maths', 'Grammaire', 'Conjugaison', 'Orthographe', 'Questions de cours', 'TP et projets', 'TP et projets', 'TP et projets', 'TP et projets', 'Mathematics', 'Science']), -- Mercredi
  ('CM1-CM2', 4, array['Maths', 'Maths', 'Grammaire', 'Conjugaison', 'Vocabulaire', 'Questions de cours', 'English', 'English', 'English', 'PE', 'Mathematics', 'Mathematics']), -- Jeudi
  ('CM1-CM2', 5, array['Maths', 'Art', 'Orthographe', 'Vocabulaire', 'Questions de cours', 'ECM', 'English', 'English', 'English', 'English', 'Mathematics', 'Science']) -- Vendredi
) as g(groupe, jour, matieres)
cross join lateral unnest(g.matieres) with ordinality as s(matiere, ord)
on conflict (groupe, jour, sequence) do update set matiere = excluded.matiere;

-- Chaque couple groupe + matière attend son enseignant, que le compte
-- directeur affectera depuis la plateforme.
insert into public.affectations_matieres (groupe, matiere)
select distinct groupe, matiere from public.emploi_du_temps
on conflict (groupe, matiere) do nothing;

-- Contrôle : doit afficher 240 créneaux et 49 matières à affecter.
select (select count(*) from public.emploi_du_temps)       as creneaux,
       (select count(*) from public.affectations_matieres) as matieres_a_affecter;
