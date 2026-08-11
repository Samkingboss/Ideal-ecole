-- Fiche de checking de fin de cours
-- Une note de compréhension sur 100 par élève et par cours, saisie par
-- l'enseignant juste après la leçon. Alimente le rapport hebdomadaire
-- (prouesse de la semaine / point à améliorer).
--
-- À exécuter dans le SQL Editor du dashboard Supabase.

create table if not exists public.comprehensions (
  id          uuid primary key default gen_random_uuid(),
  eleve_id    uuid not null references public.eleves(id) on delete cascade,
  classe_id   uuid references public.classes(id),
  prof_id     uuid references public.users(id),
  date_cours  date not null default current_date,
  matiere     text not null,
  lecon       text,
  note        integer not null check (note >= 0 and note <= 100),
  observation text,
  saisi_par   text,
  created_at  timestamptz not null default now(),

  -- Un seul relevé par élève, par matière et par jour : ressaisir le même
  -- cours corrige la note au lieu d'empiler des doublons.
  constraint comprehensions_unicite unique (eleve_id, date_cours, matiere)
);

-- Le rapport hebdomadaire interroge toujours par élève et par plage de dates.
create index if not exists comprehensions_eleve_date_idx
  on public.comprehensions (eleve_id, date_cours);

-- Vue enseignant : moyenne d'une classe sur une journée.
create index if not exists comprehensions_classe_date_idx
  on public.comprehensions (classe_id, date_cours);
