-- ═══════════════════════════════════════════════════════════════════════
-- FERMER LA FINANCE ET LES DOSSIERS AU RÔLE PUBLIC
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Ce qui est ouvert aujourd'hui ──────────────────────────────────────
--
-- Mesuré depuis la clé publiable, celle qu'embarque le navigateur de tout
-- visiteur du site :
--
--   GET    /financement_params?id=eq.main   → 200   toute la comptabilité,
--                                                    salaires du personnel
--                                                    compris
--   POST   /financement_params              → 201   modification
--   DELETE /financement_params?id=eq.…      → 204   suppression
--   GET    /inscriptions?select=nom,adresse → 200   dossiers des enfants
--   GET    /responsables?select=tel1        → 200   téléphones des parents
--
-- Une requête d'une ligne suffit à obtenir le nom d'un enfant, l'adresse de
-- son domicile et le téléphone de ses parents. Une autre suffit à effacer
-- la comptabilité entière — elle tient dans UNE ligne.
--
-- L'écriture, elle, est déjà fermée sur `inscriptions` et `responsables`
-- (401 · 42501 vérifié) : le formulaire public passe par
-- `creer_inscription`, en SECURITY DEFINER. Rien à changer de ce côté.
--
-- ── Ce qui doit rester possible ────────────────────────────────────────
--
--   `inscription.html`  formulaire public : dépose un dossier via
--                       `creer_inscription`. N'a besoin d'AUCUNE lecture
--                       directe de `inscriptions` ni de `responsables`.
--   `fiche.html`        vérifie une carte via `verifier_carte_scolaire`.
--                       Ne lit plus aucune table.
--   `comptabilite.html` reprend désormais la session du portail
--                       (`storageKey: 'ideal-auth'`) : elle parle en
--                       `authenticated`. Sans cette correction, déjà
--                       livrée, ce script la couperait.
--   Le portail React    est authentifié depuis la phase 3.1.
--
-- ⚠ ORDRE IMPORTANT. Ne pas exécuter ce script avant d'avoir déployé la
--   version du dépôt qui fait partager la session à `comptabilite.html`.
--   Sinon la comptabilité devient illisible pour tout le monde.
--
-- NON DESTRUCTIF : aucune donnée touchée. Uniquement des politiques.
-- Réversible : la section 4 rétablit l'état d'avant.

begin;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · QUI EST DE LA DIRECTION
-- ═══════════════════════════════════════════════════════════════════════
--
-- `ideal_est()` existe déjà (phase 3.1) et lit `auth.uid()`, jamais une
-- valeur transmise par le client.

create or replace function public.ideal_est_direction()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.ideal_est(array['directeur', 'responsable_administratif']);
$function$;

grant execute on function public.ideal_est_direction() to authenticated;

comment on function public.ideal_est_direction() is
  'Vrai si la session appartient a la direction ou au responsable '
  'administratif. Lit auth.uid(), jamais une valeur du client.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · LA COMPTABILITÉ
-- ═══════════════════════════════════════════════════════════════════════
--
-- Lecture ET écriture réservées à la direction. Personne d'autre — pas même
-- un enseignant connecté — n'a de raison de lire les salaires.

alter table public.financement_params enable row level security;

drop policy if exists financement_params_anon      on public.financement_params;
drop policy if exists financement_params_read      on public.financement_params;
drop policy if exists financement_params_write     on public.financement_params;
drop policy if exists financement_params_direction on public.financement_params;

create policy financement_params_direction
  on public.financement_params
  for all
  to authenticated
  using (public.ideal_est_direction())
  with check (public.ideal_est_direction());

-- Aucune politique pour `anon` : sous RLS, l'absence de politique est un
-- refus. La suppression n'est ouverte à personne d'autre que la direction,
-- et elle reste tracée par `updated_at`.

-- ═══════════════════════════════════════════════════════════════════════
-- 3 · LES DOSSIERS ET LES RESPONSABLES LÉGAUX
-- ═══════════════════════════════════════════════════════════════════════
--
-- La lecture passe au personnel connecté. Le dépôt public continue de
-- passer par `creer_inscription`, qui est SECURITY DEFINER et n'a donc pas
-- besoin de politique.

alter table public.inscriptions enable row level security;
alter table public.responsables enable row level security;

drop policy if exists inscriptions_lecture_publique on public.inscriptions;
drop policy if exists inscriptions_anon             on public.inscriptions;
drop policy if exists inscriptions_personnel        on public.inscriptions;

-- SUPERSÉDÉ PAR rls_restreindre_donnees_familiales.sql — prédicat composite corrigé.
create policy inscriptions_personnel
  on public.inscriptions
  for select
  to authenticated
  using (public.ideal_profil() is not null);

drop policy if exists responsables_lecture_publique on public.responsables;
drop policy if exists responsables_anon             on public.responsables;
drop policy if exists responsables_personnel        on public.responsables;

-- SUPERSÉDÉ PAR rls_restreindre_donnees_familiales.sql — prédicat composite corrigé.
create policy responsables_personnel
  on public.responsables
  for select
  to authenticated
  using (public.ideal_profil() is not null);

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- V1 — les politiques posées. Aucune ne doit viser `anon` ni `public`.
select tablename, policyname, cmd, roles::text
  from pg_policies
 where schemaname = 'public'
   and tablename in ('financement_params', 'inscriptions', 'responsables')
 order by tablename, cmd, policyname;

-- V2 — RLS active sur les trois tables.
select relname, relrowsecurity as rls_active
  from pg_class
 where oid in ('public.financement_params'::regclass,
               'public.inscriptions'::regclass,
               'public.responsables'::regclass)
 order by relname;

-- V3 — le dépôt public d'un dossier reste possible : la fonction est bien
--      SECURITY DEFINER et exécutable par anon.
select p.proname,
       case when p.prosecdef then 'definer' else 'invoker' end as securite
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('creer_inscription', 'verifier_carte_scolaire')
 order by p.proname;


-- ═══════════════════════════════════════════════════════════════════════
-- 4 · RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- À n'exécuter que si la fermeture casse un usage légitime non prévu.
-- Rétablit exactement l'ouverture d'avant.
--
-- begin;
-- drop policy if exists financement_params_direction on public.financement_params;
-- drop policy if exists inscriptions_personnel       on public.inscriptions;
-- drop policy if exists responsables_personnel       on public.responsables;
-- create policy financement_params_anon on public.financement_params
--   for all to anon using (true) with check (true);
-- create policy inscriptions_lecture_publique on public.inscriptions
--   for select to anon using (true);
-- create policy responsables_lecture_publique on public.responsables
--   for select to anon using (true);
-- commit;


-- ═══════════════════════════════════════════════════════════════════════
-- 5 · RETRAIT DE LA FIXTURE DE TEST
-- ═══════════════════════════════════════════════════════════════════════
--
-- Un dossier a été créé pour prouver le workflow d'encaissement, par la
-- voie normale (`creer_inscription`). Il porte le nom
-- « TEST-ADMIN-INTEGRATION » et le matricule « 26-27 A008 ».
--
-- Sa trace comptable a déjà été retirée. L'écriture sur `inscriptions` et
-- `responsables` étant fermée à la clé publique — c'est voulu — la
-- suppression du dossier lui-même vous revient.
--
-- Contrôle d'abord : une seule ligne, celle de la fixture.
select id, matricule, nom, prenom, statut, created_at
  from public.inscriptions
 where nom = 'TEST-ADMIN-INTEGRATION';
-- ATTENDU : 1 ligne, matricule « 26-27 A008 ».
-- ARRÊT SI : 0 ligne, ou plus d'une, ou un nom différent.

-- Puis la suppression, dans cet ordre (l'inscription référence le
-- responsable).
delete from public.inscriptions where nom = 'TEST-ADMIN-INTEGRATION';
delete from public.responsables
 where nom = 'TEST-ADMIN' and profession = 'FIXTURE DE TEST';

-- Contrôle final : plus aucune trace.
select
  (select count(*) from public.inscriptions where nom like 'TEST-ADMIN%')      as inscriptions_restantes,
  (select count(*) from public.responsables where profession = 'FIXTURE DE TEST') as responsables_restants;
-- ATTENDU : 0 | 0
