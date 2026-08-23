-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 0 — ÉTAPE 1 : SAUVEGARDE, AVANT TOUTE AUTRE COMMANDE
-- ═══════════════════════════════════════════════════════════════════════
--
-- À exécuter dans l'éditeur SQL Supabase, AVANT `phase0_1_creation.sql`.
--
-- ── Pourquoi une copie en base plutôt qu'un fichier CSV ────────────────
--
-- Le risque contre lequel on se protège n'est pas « Supabase disparaît » :
-- c'est « la migration se passe mal et les codes sont perdus ». Contre ce
-- risque-là, une table de sauvegarde dans la même base est exactement
-- l'outil qu'il faut — et elle ne dépend d'aucun bouton d'interface.
--
-- Un fichier CSV aurait de surcroît un défaut propre : il créerait une
-- copie de plus des treize codes, en clair, sur un ordinateur. Or ces codes
-- sont déjà considérés comme compromis, et ils seront tous remplacés à
-- l'étape 8. Multiplier leurs copies sur disque ne protège rien et ajoute
-- une exposition.
--
-- ── Pourquoi un schéma séparé ──────────────────────────────────────────
--
-- Une table créée dans `public` hériterait des droits par défaut de
-- Supabase et deviendrait lisible par la clé anonyme. On recréerait
-- exactement la faille qu'on est en train de fermer, sous un autre nom.
--
-- PostgREST n'expose que le schéma `public`. Une table rangée dans
-- `sauvegarde` est donc hors de portée de l'API, quelle que soit la suite.

begin;

-- ── 1 · Un schéma que l'API ne voit pas ────────────────────────────────

create schema if not exists sauvegarde;

revoke all on schema sauvegarde from anon, authenticated;
grant  usage on schema sauvegarde to postgres;

comment on schema sauvegarde is
  'Copies de sûreté antérieures aux migrations. Hors du schéma expose par '
  'PostgREST : aucun acces via l''API, en lecture comme en ecriture.';

-- ── 2 · La copie ───────────────────────────────────────────────────────
--
-- `create table as` capture la structure et les données en une fois.
-- Le nom porte la date : une seconde exécution le même jour échouerait
-- plutôt que d'écraser silencieusement une sauvegarde existante.

create table sauvegarde.users_20260823 as
  select *, now() as sauvegarde_le
    from public.users;

revoke all on all tables in schema sauvegarde from anon, authenticated;

-- ── 3 · Assertion ──────────────────────────────────────────────────────
--
-- Une sauvegarde incomplète est pire qu'une absence de sauvegarde : elle
-- inspire une confiance qu'elle ne mérite pas. Si les volumes ne
-- correspondent pas, la transaction est annulée et rien n'est créé.

do $$
declare
  n_source integer;
  n_copie  integer;
  n_codes  integer;
begin
  select count(*) into n_source from public.users;
  select count(*) into n_copie  from sauvegarde.users_20260823;

  if n_source <> n_copie then
    raise exception
      'ARRET : % ligne(s) en source pour % copiee(s). Sauvegarde invalide.',
      n_source, n_copie;
  end if;

  -- Le code d'accès est la donnée que cette sauvegarde existe pour protéger.
  -- On vérifie qu'aucun n'est vide, sans en afficher un seul.
  select count(*) into n_codes
    from sauvegarde.users_20260823
   where nullif(btrim(coalesce(code_acces, '')), '') is null;

  if n_codes > 0 then
    raise exception
      'ARRET : % code(s) vide(s) dans la copie. Sauvegarde invalide.', n_codes;
  end if;

  raise notice 'Sauvegarde conforme : % comptes, % code(s) manquant(s).',
    n_copie, n_codes;
end
$$;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — aucune ne révèle un code
-- ═══════════════════════════════════════════════════════════════════════

-- Volumes et intégrité. Attendu : 13 | 13 | 0 | 0
select
  (select count(*) from public.users)                 as source,
  (select count(*) from sauvegarde.users_20260823)    as copie,
  (select count(*) from sauvegarde.users_20260823
     where code_acces is null)                        as codes_manquants,
  (select count(*) from public.users u
     full join sauvegarde.users_20260823 s on s.id = u.id
    where u.id is null or s.id is null)               as lignes_non_appariees;

-- Concordance code par code, sans afficher aucune valeur.
-- Attendu : 0
select count(*) as divergences
  from public.users u
  join sauvegarde.users_20260823 s on s.id = u.id
 where u.code_acces      is distinct from s.code_acces
    or u.plafond_salaire is distinct from s.plafond_salaire;

-- Contrôle de confinement : la sauvegarde ne doit PAS être exposée.
-- Attendu : aucune ligne. Si une ligne apparaît, ne pas poursuivre.
select grantee, privilege_type
  from information_schema.table_privileges
 where table_schema = 'sauvegarde'
   and grantee in ('anon', 'authenticated');


-- ═══════════════════════════════════════════════════════════════════════
-- POUR PLUS TARD — quand la phase 0 sera close et stabilisée
-- ═══════════════════════════════════════════════════════════════════════
--
-- Cette table contient les anciens codes, ceux qui étaient compromis. Une
-- fois la rotation faite (étape 8) et quelques jours de fonctionnement
-- normal écoulés, elle n'a plus de raison d'être et devient elle-même une
-- collection de secrets à protéger. On la supprime alors :
--
--   drop table sauvegarde.users_20260823;
--
-- Ne pas le faire avant : c'est le filet de tout le reste de la phase.
