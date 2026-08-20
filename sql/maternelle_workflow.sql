-- Module opérationnel Maternelle IDEAL : rotation PS/GS, préparations,
-- lecture assistante, matériel, rondes et alertes d'accompagnement.
-- À exécuter une fois dans l'éditeur SQL Supabase.

begin;

alter table public.users add column if not exists fonction text;

create table if not exists public.maternelle_preparations (
  id uuid primary key default gen_random_uuid(),
  date_cours date not null,
  heure_debut time not null,
  heure_fin time,
  classe_code text not null check (classe_code in ('PS','GS')),
  trimestre text not null default 't1' check (trimestre in ('t1','t2','t3')),
  langue text not null check (langue in ('fr','en')),
  maitresse_id uuid not null references public.users(id) on delete restrict,
  domaine text not null,
  objectif text not null,
  deroulement text not null,
  materiels jsonb not null default '[]'::jsonb,
  consignes_assistante text,
  statut text not null default 'brouillon' check (statut in ('brouillon','publiee','realisee','reportee')),
  publiee_le timestamptz,
  compte_rendu text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maitresse_id, date_cours, heure_debut)
);

create table if not exists public.maternelle_lectures_assistantes (
  id uuid primary key default gen_random_uuid(),
  preparation_id uuid not null unique references public.maternelle_preparations(id) on delete cascade,
  assistante_id uuid not null references public.users(id) on delete restrict,
  lue_le timestamptz not null default now(),
  objectif_compris text not null,
  role_pendant_activite text not null,
  lieu_recuperation text,
  risque_identifie text,
  materiel_recupere boolean not null default false,
  materiel_installe boolean not null default false,
  installe_le timestamptz,
  observation text,
  updated_at timestamptz not null default now()
);

create table if not exists public.maternelle_controles_materiel (
  id uuid primary key default gen_random_uuid(),
  preparation_id uuid not null unique references public.maternelle_preparations(id) on delete cascade,
  maitresse_id uuid not null references public.users(id) on delete restrict,
  controle_le timestamptz not null default now(),
  elements jsonb not null default '[]'::jsonb,
  statut text not null check (statut in ('complet','incomplet','absent')),
  observation text,
  dans_delai boolean not null default false
);

create table if not exists public.maternelle_rondes_classes (
  id uuid primary key default gen_random_uuid(),
  date_ronde date not null,
  classe_code text not null check (classe_code in ('PS','GS')),
  surveillant_id uuid not null references public.users(id) on delete restrict,
  assistante_id uuid references public.users(id) on delete set null,
  tables_rangees boolean not null default false,
  classe_propre boolean not null default false,
  materiel_range boolean not null default false,
  effets_personnels_ranges boolean not null default false,
  passages_degages boolean not null default false,
  aucun_danger boolean not null default false,
  resultat text not null check (resultat in ('conforme','a_ameliorer','non_conforme','urgent')),
  observation text,
  photo_url text,
  effectuee_le timestamptz not null default now(),
  unique (date_ronde, classe_code)
);

create table if not exists public.maternelle_alertes_accompagnement (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid references public.eleves(id) on delete set null,
  eleve_nom text not null,
  classe_code text not null check (classe_code in ('PS','GS')),
  toilette text not null,
  situation text not null,
  urgence text not null default 'normale' check (urgence in ('normale','haute','critique')),
  constatee_le timestamptz not null default now(),
  signalee_par uuid references public.users(id) on delete set null,
  assistante_id uuid references public.users(id) on delete set null,
  statut text not null default 'signalee' check (statut in ('signalee','prise_en_charge','cloturee')),
  prise_en_charge_le timestamptz,
  reponse_assistante text,
  cloturee_le timestamptz,
  cloturee_par uuid references public.users(id) on delete set null
);

create index if not exists maternelle_preps_date_idx on public.maternelle_preparations(date_cours, heure_debut);
create index if not exists maternelle_alertes_statut_idx on public.maternelle_alertes_accompagnement(statut, constatee_le desc);

alter table public.maternelle_preparations enable row level security;
alter table public.maternelle_lectures_assistantes enable row level security;
alter table public.maternelle_controles_materiel enable row level security;
alter table public.maternelle_rondes_classes enable row level security;
alter table public.maternelle_alertes_accompagnement enable row level security;

do $policies$
declare t text;
begin
  foreach t in array array[
    'maternelle_preparations','maternelle_lectures_assistantes',
    'maternelle_controles_materiel','maternelle_rondes_classes',
    'maternelle_alertes_accompagnement'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_lecture', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_lecture', t);
    execute format('drop policy if exists %I on public.%I', t || '_saisie', t);
    execute format('create policy %I on public.%I for insert with check (true)', t || '_saisie', t);
    execute format('drop policy if exists %I on public.%I', t || '_correction', t);
    execute format('create policy %I on public.%I for update using (true) with check (true)', t || '_correction', t);
  end loop;
end;
$policies$;

commit;
