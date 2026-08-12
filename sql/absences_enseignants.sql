-- Absences des enseignants et neutralisation des pénalités
--
-- Règle posée par le directeur : une journée d'absence ne rapporte aucun
-- point. Si l'enseignant justifie son absence — pièce à l'appui, validée par
-- le responsable administratif — la journée est neutralisée : elle sort de
-- ce qu'on attend de lui, et il est jugé sur les jours où il était présent.
-- Son pourcentage n'est donc ni pénalisé ni avantagé par une absence subie.
--
-- Le justificatif est déposé dans le bucket Storage existant `inscriptions`,
-- sous le dossier `justificatifs/`. On évite ainsi de créer un bucket et ses
-- politiques, qui demanderaient un passage supplémentaire par le dashboard.
--
-- À exécuter dans le SQL Editor de Supabase.

create table if not exists public.absences_enseignants (
  id             uuid primary key default gen_random_uuid(),
  prof_id        uuid not null references public.users(id) on delete cascade,
  date_absence   date not null,
  motif          text,
  justifiee      boolean not null default false,
  justificatif_url  text,
  justificatif_nom  text,
  valide_par     uuid references public.users(id) on delete set null,
  valide_le      timestamptz,
  created_at     timestamptz not null default now(),

  -- Une seule ligne par enseignant et par jour : ressaisir corrige.
  constraint abs_unicite unique (prof_id, date_absence),
  -- Une absence ne peut être déclarée justifiée sans pièce ni validation :
  -- c'est ce qui distingue une neutralisation d'une faveur.
  constraint abs_justif_complete check (
    justifiee = false or (justificatif_url is not null and valide_par is not null)
  )
);

create index if not exists abs_prof_date_idx
  on public.absences_enseignants (prof_id, date_absence);

-- ── Règles d'accès ────────────────────────────────────────────────────
-- Supabase active RLS d'office : sans ces règles, l'application lirait la
-- table mais ne pourrait rien y écrire.
-- La suppression n'est pas ouverte : une absence constatée ne s'efface pas,
-- elle se corrige. Elle pèse sur une rémunération, elle doit laisser trace.

alter table public.absences_enseignants enable row level security;

drop policy if exists abs_lecture on public.absences_enseignants;
create policy abs_lecture on public.absences_enseignants for select using (true);

drop policy if exists abs_saisie on public.absences_enseignants;
create policy abs_saisie on public.absences_enseignants for insert with check (true);

drop policy if exists abs_correction on public.absences_enseignants;
create policy abs_correction on public.absences_enseignants for update using (true) with check (true);

-- Contrôle : doit renvoyer 0 ligne au départ.
select count(*) as absences_enregistrees from public.absences_enseignants;
