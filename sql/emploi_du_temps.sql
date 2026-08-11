-- Emploi du temps du primaire — application du document officiel
-- « Emploi du temps Primaire Ideal », version 1.0, année 2026-2027.
--
-- Modèle retenu, conforme au document :
--
--  • La journée compte DOUZE SÉQUENCES de 30 minutes : S1 08h00 … S6 11h00
--    (bloc 1), S7 11h30 … S12 15h30 (bloc 2). Récréations (10h00, 15h00) et
--    déjeuner (12h00) n'en sont pas : ce n'est pas du temps d'enseignement.
--    Total réellement enseigné : 12 × 30 = 360 minutes par jour, 30 h/semaine.
--
--  • La grille est rangée par GROUPE PÉDAGOGIQUE et non par classe. L'école
--    compte six classes, mais CE1 et CE2 d'une part, CM1 et CM2 d'autre part,
--    sont jumelées et suivent le même emploi du temps. Quatre grilles donc :
--    CP1, CP2, CE1-CE2, CM1-CM2. Dupliquer la grille pour chaque classe
--    d'une paire créerait deux vérités à maintenir.
--
--  • Seules les SEMAINES IMPAIRES sont stockées. En semaine paire, les deux
--    blocs sont permutés (§ 1.3) : matières, durées et enseignants restent
--    identiques. La permutation se calcule à la lecture (S1↔S7 … S6↔S12).
--
--  • Les enseignants ne sont pas figés ici. Le document les désigne par leurs
--    initiales ; c'est le compte directeur qui affecte un enseignant réel à
--    chaque matière, via la table `affectations_matieres`.
--
-- À exécuter dans le SQL Editor du dashboard Supabase.

create table if not exists public.emploi_du_temps (
  id         uuid primary key default gen_random_uuid(),
  groupe     text not null,                                     -- CP1, CP2, CE1-CE2, CM1-CM2
  jour       smallint not null check (jour between 1 and 5),     -- 1 = lundi
  sequence   smallint not null check (sequence between 1 and 12),
  matiere    text not null,
  created_at timestamptz not null default now(),
  constraint edt_unicite unique (groupe, jour, sequence)
);

create index if not exists edt_groupe_jour_idx
  on public.emploi_du_temps (groupe, jour);

-- Qui enseigne quoi. Une matière d'un groupe = un seul enseignant sur toute
-- l'année (§ 2.1 du document) : la contrainte d'unicité l'impose.
create table if not exists public.affectations_matieres (
  id         uuid primary key default gen_random_uuid(),
  groupe     text not null,
  matiere    text not null,
  prof_id    uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint aff_unicite unique (groupe, matiere)
);

-- ── Politiques d'accès ────────────────────────────────────────────────
-- Supabase active RLS d'office sur toute nouvelle table : sans ces règles,
-- l'application lit mais ne peut rien enregistrer. Il s'agit ici d'un
-- paramétrage et non d'observations sur un enfant : la suppression est donc
-- ouverte, un créneau saisi par erreur devant pouvoir être retiré.

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

-- ── Grilles officielles (Partie 3 du document) ────────────────────────
-- 240 créneaux : 4 groupes × 5 jours × 12 séquences.
-- Transcription vérifiée contre les totaux horaires annoncés par le document
-- pour chaque matière (« Contrôle des volumes » de chaque grille).

insert into public.emploi_du_temps (groupe, jour, sequence, matiere) values
  ('CP1', 1, 1, 'Lecture'),
  ('CP1', 2, 1, 'Lecture'),
  ('CP1', 3, 1, 'Lecture'),
  ('CP1', 4, 1, 'Lecture'),
  ('CP1', 5, 1, 'Lecture'),
  ('CP1', 1, 2, 'Lecture'),
  ('CP1', 2, 2, 'Lecture'),
  ('CP1', 3, 2, 'Lecture'),
  ('CP1', 4, 2, 'Lecture'),
  ('CP1', 5, 2, 'Lecture'),
  ('CP1', 1, 3, 'Écriture'),
  ('CP1', 2, 3, 'Écriture'),
  ('CP1', 3, 3, 'Écriture'),
  ('CP1', 4, 3, 'Lecture'),
  ('CP1', 5, 3, 'Écriture'),
  ('CP1', 1, 4, 'Maths'),
  ('CP1', 2, 4, 'Maths'),
  ('CP1', 3, 4, 'Maths'),
  ('CP1', 4, 4, 'Écriture'),
  ('CP1', 5, 4, 'Écriture'),
  ('CP1', 1, 5, 'Maths'),
  ('CP1', 2, 5, 'Maths'),
  ('CP1', 3, 5, 'Maths'),
  ('CP1', 4, 5, 'Maths'),
  ('CP1', 5, 5, 'Maths'),
  ('CP1', 1, 6, 'Savoir-vivre'),
  ('CP1', 2, 6, 'Sport'),
  ('CP1', 3, 6, 'Savoir-vivre'),
  ('CP1', 4, 6, 'Maths'),
  ('CP1', 5, 6, 'Sport'),
  ('CP1', 1, 7, 'English'),
  ('CP1', 2, 7, 'English'),
  ('CP1', 3, 7, 'English'),
  ('CP1', 4, 7, 'English'),
  ('CP1', 5, 7, 'English'),
  ('CP1', 1, 8, 'Mathematics'),
  ('CP1', 2, 8, 'Mathematics'),
  ('CP1', 3, 8, 'Mathematics'),
  ('CP1', 4, 8, 'English'),
  ('CP1', 5, 8, 'English'),
  ('CP1', 1, 9, 'Mathematics'),
  ('CP1', 2, 9, 'English'),
  ('CP1', 3, 9, 'Mathematics'),
  ('CP1', 4, 9, 'Mathematics'),
  ('CP1', 5, 9, 'English'),
  ('CP1', 1, 10, 'English'),
  ('CP1', 2, 10, 'Arts'),
  ('CP1', 3, 10, 'English'),
  ('CP1', 4, 10, 'Science'),
  ('CP1', 5, 10, 'Mathematics'),
  ('CP1', 1, 11, 'Science'),
  ('CP1', 2, 11, 'Arts'),
  ('CP1', 3, 11, 'English'),
  ('CP1', 4, 11, 'Arts'),
  ('CP1', 5, 11, 'Science'),
  ('CP1', 1, 12, 'Handwriting'),
  ('CP1', 2, 12, 'Science'),
  ('CP1', 3, 12, 'Handwriting'),
  ('CP1', 4, 12, 'Arts'),
  ('CP1', 5, 12, 'Handwriting'),
  ('CP2', 1, 1, 'English'),
  ('CP2', 2, 1, 'English'),
  ('CP2', 3, 1, 'English'),
  ('CP2', 4, 1, 'English'),
  ('CP2', 5, 1, 'English'),
  ('CP2', 1, 2, 'Mathematics'),
  ('CP2', 2, 2, 'Mathematics'),
  ('CP2', 3, 2, 'Mathematics'),
  ('CP2', 4, 2, 'English'),
  ('CP2', 5, 2, 'English'),
  ('CP2', 1, 3, 'Mathematics'),
  ('CP2', 2, 3, 'English'),
  ('CP2', 3, 3, 'Mathematics'),
  ('CP2', 4, 3, 'Mathematics'),
  ('CP2', 5, 3, 'English'),
  ('CP2', 1, 4, 'English'),
  ('CP2', 2, 4, 'Arts'),
  ('CP2', 3, 4, 'English'),
  ('CP2', 4, 4, 'Science'),
  ('CP2', 5, 4, 'Mathematics'),
  ('CP2', 1, 5, 'Science'),
  ('CP2', 2, 5, 'Arts'),
  ('CP2', 3, 5, 'English'),
  ('CP2', 4, 5, 'Arts'),
  ('CP2', 5, 5, 'Science'),
  ('CP2', 1, 6, 'Handwriting'),
  ('CP2', 2, 6, 'Science'),
  ('CP2', 3, 6, 'Handwriting'),
  ('CP2', 4, 6, 'Arts'),
  ('CP2', 5, 6, 'Handwriting'),
  ('CP2', 1, 7, 'Lecture'),
  ('CP2', 2, 7, 'Lecture'),
  ('CP2', 3, 7, 'Lecture'),
  ('CP2', 4, 7, 'Lecture'),
  ('CP2', 5, 7, 'Lecture'),
  ('CP2', 1, 8, 'Lecture'),
  ('CP2', 2, 8, 'Lecture'),
  ('CP2', 3, 8, 'Lecture'),
  ('CP2', 4, 8, 'Maths'),
  ('CP2', 5, 8, 'Maths'),
  ('CP2', 1, 9, 'Maths'),
  ('CP2', 2, 9, 'Maths'),
  ('CP2', 3, 9, 'Maths'),
  ('CP2', 4, 9, 'Grammaire'),
  ('CP2', 5, 9, 'Grammaire'),
  ('CP2', 1, 10, 'Maths'),
  ('CP2', 2, 10, 'Maths'),
  ('CP2', 3, 10, 'Maths'),
  ('CP2', 4, 10, 'Orthographe'),
  ('CP2', 5, 10, 'Orthographe'),
  ('CP2', 1, 11, 'Grammaire'),
  ('CP2', 2, 11, 'Orthographe'),
  ('CP2', 3, 11, 'Vocabulaire'),
  ('CP2', 4, 11, 'Écriture'),
  ('CP2', 5, 11, 'Vocabulaire'),
  ('CP2', 1, 12, 'Écriture'),
  ('CP2', 2, 12, 'Écriture'),
  ('CP2', 3, 12, 'Écriture'),
  ('CP2', 4, 12, 'Savoir-vivre'),
  ('CP2', 5, 12, 'Sport'),
  ('CE1-CE2', 1, 1, 'English'),
  ('CE1-CE2', 2, 1, 'English'),
  ('CE1-CE2', 3, 1, 'TP et projets'),
  ('CE1-CE2', 4, 1, 'English'),
  ('CE1-CE2', 5, 1, 'English'),
  ('CE1-CE2', 1, 2, 'English'),
  ('CE1-CE2', 2, 2, 'English'),
  ('CE1-CE2', 3, 2, 'TP et projets'),
  ('CE1-CE2', 4, 2, 'English'),
  ('CE1-CE2', 5, 2, 'English'),
  ('CE1-CE2', 1, 3, 'English'),
  ('CE1-CE2', 2, 3, 'PE'),
  ('CE1-CE2', 3, 3, 'TP et projets'),
  ('CE1-CE2', 4, 3, 'English'),
  ('CE1-CE2', 5, 3, 'English'),
  ('CE1-CE2', 1, 4, 'Mathematics'),
  ('CE1-CE2', 2, 4, 'Mathematics'),
  ('CE1-CE2', 3, 4, 'TP et projets'),
  ('CE1-CE2', 4, 4, 'PE'),
  ('CE1-CE2', 5, 4, 'English'),
  ('CE1-CE2', 1, 5, 'Mathematics'),
  ('CE1-CE2', 2, 5, 'Science'),
  ('CE1-CE2', 3, 5, 'Mathematics'),
  ('CE1-CE2', 4, 5, 'Mathematics'),
  ('CE1-CE2', 5, 5, 'Mathematics'),
  ('CE1-CE2', 1, 6, 'Science'),
  ('CE1-CE2', 2, 6, 'Science'),
  ('CE1-CE2', 3, 6, 'Science'),
  ('CE1-CE2', 4, 6, 'Mathematics'),
  ('CE1-CE2', 5, 6, 'Science'),
  ('CE1-CE2', 1, 7, 'Grammaire'),
  ('CE1-CE2', 2, 7, 'Grammaire'),
  ('CE1-CE2', 3, 7, 'Grammaire'),
  ('CE1-CE2', 4, 7, 'Grammaire'),
  ('CE1-CE2', 5, 7, 'Orthographe'),
  ('CE1-CE2', 1, 8, 'Maths'),
  ('CE1-CE2', 2, 8, 'Maths'),
  ('CE1-CE2', 3, 8, 'Maths'),
  ('CE1-CE2', 4, 8, 'Maths'),
  ('CE1-CE2', 5, 8, 'Maths'),
  ('CE1-CE2', 1, 9, 'Maths'),
  ('CE1-CE2', 2, 9, 'Maths'),
  ('CE1-CE2', 3, 9, 'Maths'),
  ('CE1-CE2', 4, 9, 'Maths'),
  ('CE1-CE2', 5, 9, 'Art'),
  ('CE1-CE2', 1, 10, 'Conjugaison'),
  ('CE1-CE2', 2, 10, 'Conjugaison'),
  ('CE1-CE2', 3, 10, 'Conjugaison'),
  ('CE1-CE2', 4, 10, 'Conjugaison'),
  ('CE1-CE2', 5, 10, 'Vocabulaire'),
  ('CE1-CE2', 1, 11, 'Orthographe'),
  ('CE1-CE2', 2, 11, 'Orthographe'),
  ('CE1-CE2', 3, 11, 'Orthographe'),
  ('CE1-CE2', 4, 11, 'Vocabulaire'),
  ('CE1-CE2', 5, 11, 'Questions de cours'),
  ('CE1-CE2', 1, 12, 'Questions de cours'),
  ('CE1-CE2', 2, 12, 'Vocabulaire'),
  ('CE1-CE2', 3, 12, 'Questions de cours'),
  ('CE1-CE2', 4, 12, 'Questions de cours'),
  ('CE1-CE2', 5, 12, 'ECM'),
  ('CM1-CM2', 1, 1, 'Maths'),
  ('CM1-CM2', 2, 1, 'Maths'),
  ('CM1-CM2', 3, 1, 'Maths'),
  ('CM1-CM2', 4, 1, 'Maths'),
  ('CM1-CM2', 5, 1, 'Maths'),
  ('CM1-CM2', 1, 2, 'Maths'),
  ('CM1-CM2', 2, 2, 'Maths'),
  ('CM1-CM2', 3, 2, 'Maths'),
  ('CM1-CM2', 4, 2, 'Maths'),
  ('CM1-CM2', 5, 2, 'Art'),
  ('CM1-CM2', 1, 3, 'Grammaire'),
  ('CM1-CM2', 2, 3, 'Grammaire'),
  ('CM1-CM2', 3, 3, 'Grammaire'),
  ('CM1-CM2', 4, 3, 'Grammaire'),
  ('CM1-CM2', 5, 3, 'Orthographe'),
  ('CM1-CM2', 1, 4, 'Conjugaison'),
  ('CM1-CM2', 2, 4, 'Conjugaison'),
  ('CM1-CM2', 3, 4, 'Conjugaison'),
  ('CM1-CM2', 4, 4, 'Conjugaison'),
  ('CM1-CM2', 5, 4, 'Vocabulaire'),
  ('CM1-CM2', 1, 5, 'Orthographe'),
  ('CM1-CM2', 2, 5, 'Orthographe'),
  ('CM1-CM2', 3, 5, 'Orthographe'),
  ('CM1-CM2', 4, 5, 'Vocabulaire'),
  ('CM1-CM2', 5, 5, 'Questions de cours'),
  ('CM1-CM2', 1, 6, 'Questions de cours'),
  ('CM1-CM2', 2, 6, 'Vocabulaire'),
  ('CM1-CM2', 3, 6, 'Questions de cours'),
  ('CM1-CM2', 4, 6, 'Questions de cours'),
  ('CM1-CM2', 5, 6, 'ECM'),
  ('CM1-CM2', 1, 7, 'English'),
  ('CM1-CM2', 2, 7, 'English'),
  ('CM1-CM2', 3, 7, 'TP et projets'),
  ('CM1-CM2', 4, 7, 'English'),
  ('CM1-CM2', 5, 7, 'English'),
  ('CM1-CM2', 1, 8, 'English'),
  ('CM1-CM2', 2, 8, 'English'),
  ('CM1-CM2', 3, 8, 'TP et projets'),
  ('CM1-CM2', 4, 8, 'English'),
  ('CM1-CM2', 5, 8, 'English'),
  ('CM1-CM2', 1, 9, 'English'),
  ('CM1-CM2', 2, 9, 'PE'),
  ('CM1-CM2', 3, 9, 'TP et projets'),
  ('CM1-CM2', 4, 9, 'English'),
  ('CM1-CM2', 5, 9, 'English'),
  ('CM1-CM2', 1, 10, 'Mathematics'),
  ('CM1-CM2', 2, 10, 'Mathematics'),
  ('CM1-CM2', 3, 10, 'TP et projets'),
  ('CM1-CM2', 4, 10, 'PE'),
  ('CM1-CM2', 5, 10, 'English'),
  ('CM1-CM2', 1, 11, 'Mathematics'),
  ('CM1-CM2', 2, 11, 'Science'),
  ('CM1-CM2', 3, 11, 'Mathematics'),
  ('CM1-CM2', 4, 11, 'Mathematics'),
  ('CM1-CM2', 5, 11, 'Mathematics'),
  ('CM1-CM2', 1, 12, 'Science'),
  ('CM1-CM2', 2, 12, 'Science'),
  ('CM1-CM2', 3, 12, 'Science'),
  ('CM1-CM2', 4, 12, 'Mathematics'),
  ('CM1-CM2', 5, 12, 'Science')
on conflict (groupe, jour, sequence) do update set matiere = excluded.matiere;

insert into public.affectations_matieres (groupe, matiere) values
  ('CP1', 'Arts'),
  ('CP1', 'English'),
  ('CP1', 'Handwriting'),
  ('CP1', 'Lecture'),
  ('CP1', 'Mathematics'),
  ('CP1', 'Maths'),
  ('CP1', 'Savoir-vivre'),
  ('CP1', 'Science'),
  ('CP1', 'Sport'),
  ('CP1', 'Écriture'),
  ('CP2', 'Arts'),
  ('CP2', 'English'),
  ('CP2', 'Grammaire'),
  ('CP2', 'Handwriting'),
  ('CP2', 'Lecture'),
  ('CP2', 'Mathematics'),
  ('CP2', 'Maths'),
  ('CP2', 'Orthographe'),
  ('CP2', 'Savoir-vivre'),
  ('CP2', 'Science'),
  ('CP2', 'Sport'),
  ('CP2', 'Vocabulaire'),
  ('CP2', 'Écriture'),
  ('CE1-CE2', 'Art'),
  ('CE1-CE2', 'Conjugaison'),
  ('CE1-CE2', 'ECM'),
  ('CE1-CE2', 'English'),
  ('CE1-CE2', 'Grammaire'),
  ('CE1-CE2', 'Mathematics'),
  ('CE1-CE2', 'Maths'),
  ('CE1-CE2', 'Orthographe'),
  ('CE1-CE2', 'PE'),
  ('CE1-CE2', 'Questions de cours'),
  ('CE1-CE2', 'Science'),
  ('CE1-CE2', 'TP et projets'),
  ('CE1-CE2', 'Vocabulaire'),
  ('CM1-CM2', 'Art'),
  ('CM1-CM2', 'Conjugaison'),
  ('CM1-CM2', 'ECM'),
  ('CM1-CM2', 'English'),
  ('CM1-CM2', 'Grammaire'),
  ('CM1-CM2', 'Mathematics'),
  ('CM1-CM2', 'Maths'),
  ('CM1-CM2', 'Orthographe'),
  ('CM1-CM2', 'PE'),
  ('CM1-CM2', 'Questions de cours'),
  ('CM1-CM2', 'Science'),
  ('CM1-CM2', 'TP et projets'),
  ('CM1-CM2', 'Vocabulaire')
on conflict (groupe, matiere) do nothing;
