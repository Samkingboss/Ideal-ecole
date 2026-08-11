-- Emploi du temps du primaire — application du document officiel
-- « Emploi du temps Primaire Ideal », version 1.0, année 2026-2027.
--
-- Modèle retenu, conforme au document :
--
--  • La journée compte DOUZE SÉQUENCES de 30 minutes, et non des horaires
--    libres : S1 08h00 … S6 11h00 (bloc 1), S7 11h30 … S12 15h30 (bloc 2).
--    Récréations (10h00 et 15h00) et déjeuner (12h00) ne sont pas des
--    séquences : ce n'est pas du temps d'enseignement. Total réel enseigné :
--    12 × 30 min = 360 minutes par jour, 30 heures par semaine.
--
--  • On ne stocke que la grille des SEMAINES IMPAIRES. En semaine paire, le
--    bloc du matin et celui de l'après-midi sont permutés (§ 1.3) : matières,
--    durées et enseignants restent identiques. Dupliquer les lignes pour les
--    semaines paires ferait deux vérités à maintenir ; la permutation se
--    calcule à la lecture (S1↔S7, S2↔S8, … S6↔S12).

create table if not exists public.emploi_du_temps (
  id         uuid primary key default gen_random_uuid(),
  classe_id  uuid not null references public.classes(id) on delete cascade,
  jour       smallint not null check (jour between 1 and 5),      -- 1 = lundi
  sequence   smallint not null check (sequence between 1 and 12), -- S1 à S12
  matiere    text not null,
  prof_id    uuid references public.users(id),
  created_at timestamptz not null default now(),

  -- Une seule matière par classe et par séquence : ressaisir un créneau le
  -- corrige au lieu d'empiler deux cours concurrents.
  constraint edt_unicite unique (classe_id, jour, sequence)
);

create index if not exists edt_classe_jour_idx
  on public.emploi_du_temps (classe_id, jour);

-- ── Politiques d'accès ────────────────────────────────────────────────
-- Supabase active RLS d'office sur toute nouvelle table : sans ces règles,
-- l'application lit mais ne peut rien enregistrer.
-- La suppression est ouverte, contrairement aux notes des élèves : un créneau
-- saisi par erreur doit pouvoir être retiré. Il s'agit d'un paramétrage, pas
-- d'une observation sur un enfant.

alter table public.emploi_du_temps enable row level security;

drop policy if exists edt_lecture on public.emploi_du_temps;
create policy edt_lecture on public.emploi_du_temps
  for select using (true);

drop policy if exists edt_saisie on public.emploi_du_temps;
create policy edt_saisie on public.emploi_du_temps
  for insert with check (true);

drop policy if exists edt_correction on public.emploi_du_temps;
create policy edt_correction on public.emploi_du_temps
  for update using (true) with check (true);

drop policy if exists edt_suppression on public.emploi_du_temps;
create policy edt_suppression on public.emploi_du_temps
  for delete using (true);
