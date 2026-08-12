-- Préparation de cours saisie depuis l'emploi du temps
--
-- L'enseignant ne dépose plus un document : il remplit une fiche depuis la
-- cellule de son emploi du temps. On enrichit donc la table `preparations`
-- existante plutôt que d'en créer une seconde — le calcul des points, la
-- correction par la direction et l'historique continuent de fonctionner
-- sans modification.
--
-- `url_doc` reste utilisable : les préparations déposées avant ce changement
-- gardent leur PDF, les nouvelles portent leur contenu structuré.
--
-- À exécuter dans le SQL Editor de Supabase.

alter table public.preparations
  add column if not exists contenu  jsonb,   -- la fiche remplie
  add column if not exists groupe   text,    -- CP1, CP2, CE1-CE2, CM1-CM2
  add column if not exists sequence smallint; -- S1 à S12

-- Une seule préparation par enseignant, par jour et par séquence : revenir
-- sur une cellule déjà préparée doit corriger la fiche, pas en empiler une
-- seconde qui compterait deux fois dans les points.
create unique index if not exists preparations_creneau_unique
  on public.preparations (user_id, date_cours, sequence)
  where sequence is not null;

-- ── Règles d'accès ────────────────────────────────────────────────────
-- La table existe depuis longtemps et son RLS peut ne jamais avoir été
-- configuré. On pose les règles explicitement : sans elles, l'enseignant
-- verrait sa fiche refusée à l'enregistrement.
-- Pas de suppression : une préparation compte dans la prime, elle se
-- corrige mais ne s'efface pas.

alter table public.preparations enable row level security;

drop policy if exists prep_lecture on public.preparations;
create policy prep_lecture on public.preparations for select using (true);

drop policy if exists prep_saisie on public.preparations;
create policy prep_saisie on public.preparations for insert with check (true);

drop policy if exists prep_correction on public.preparations;
create policy prep_correction on public.preparations for update using (true) with check (true);

-- Contrôle : les colonnes doivent apparaître.
select column_name from information_schema.columns
 where table_name = 'preparations' and column_name in ('contenu','groupe','sequence')
 order by column_name;
