-- Fiche de checking de fin de cours
-- Une note de compréhension sur 100 par élève et par cours, saisie par
-- l'enseignant juste après la leçon. Alimente le rapport hebdomadaire
-- (prouesse de la semaine / point à améliorer).
--
-- À exécuter dans le SQL Editor du dashboard Supabase.

begin;

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

-- Extension check-point. `note` reste le résultat général afin que les
-- consommateurs historiques continuent de lire la même colonne.
alter table public.comprehensions
  add column if not exists preparation_id uuid references public.preparations(id) on delete set null,
  add column if not exists participation integer check (participation between 0 and 100),
  add column if not exists comprehension integer check (comprehension between 0 and 100),
  add column if not exists statut text not null default 'evalue'
    check (statut in ('evalue', 'absent'));

alter table public.comprehensions drop constraint if exists comprehensions_unicite;
alter table public.comprehensions drop constraint if exists comprehensions_checkpoint_unicite;
alter table public.comprehensions add constraint comprehensions_checkpoint_unicite
  unique nulls not distinct (eleve_id, preparation_id, date_cours, matiere);

alter table public.comprehensions drop constraint if exists comprehensions_checkpoint_coherent;
alter table public.comprehensions add constraint comprehensions_checkpoint_coherent check (
  (statut = 'absent' and participation is null and comprehension is null)
  or (statut = 'evalue' and (preparation_id is null or
    (participation is not null and comprehension is not null
      and note = round((participation + comprehension)::numeric / 2))))
);

create index if not exists comprehensions_preparation_idx on public.comprehensions (preparation_id);

-- Le rapport hebdomadaire interroge toujours par élève et par plage de dates.
create index if not exists comprehensions_eleve_date_idx
  on public.comprehensions (eleve_id, date_cours);

-- Vue enseignant : moyenne d'une classe sur une journée.
create index if not exists comprehensions_classe_date_idx
  on public.comprehensions (classe_id, date_cours);

-- ── Politiques d'accès ────────────────────────────────────────────────
-- Supabase active RLS d'office sur toute nouvelle table : sans les règles
-- ci-dessous, l'application reçoit « new row violates row-level security »
-- et aucune note ne peut être enregistrée.
--
-- Lecture, saisie et correction sont ouvertes ; la suppression ne l'est pas.
-- Une note erronée se corrige en ressaisissant le cours (la contrainte
-- d'unicité met la ligne à jour), elle ne s'efface pas : le relevé de ce
-- qu'un enfant a compris ne doit pas pouvoir disparaître sans trace.
-- Ces règles restent larges tant que la plateforme n'a pas d'authentification
-- réelle — c'est le chantier de sécurisation à mener avant la rentrée.

alter table public.comprehensions enable row level security;

drop policy if exists comprehensions_lecture on public.comprehensions;
create policy comprehensions_lecture on public.comprehensions
  for select using (true);

drop policy if exists comprehensions_saisie on public.comprehensions;
create policy comprehensions_saisie on public.comprehensions
  for insert with check (true);

drop policy if exists comprehensions_correction on public.comprehensions;
create policy comprehensions_correction on public.comprehensions
  for update using (true) with check (true);

commit;
