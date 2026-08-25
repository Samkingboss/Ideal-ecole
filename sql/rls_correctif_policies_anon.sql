-- ═══════════════════════════════════════════════════════════════════════
-- CORRECTIF RLS — RETIRER LES TROIS POLITIQUES `anon` RESTANTES
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Pourquoi la migration précédente ne les a pas retirées ─────────────
--
-- CAUSE = B, prouvée : les noms visés par `drop policy if exists` ne
-- correspondaient à aucun nom réel.
--
--   Le script tentait          La production portait
--   ─────────────────          ─────────────────────
--   financement_params_anon    « Allow all for anon »
--   financement_params_read
--   financement_params_write
--   inscriptions_anon          « lecture_inscriptions »
--   inscriptions_lecture_publique
--   responsables_anon          « lecture_responsables »
--   responsables_lecture_publique
--
-- Aucun recoupement. Et `drop policy IF EXISTS` sur un nom inexistant est
-- un NO-OP SILENCIEUX : ni erreur, ni avertissement. La migration a donc
-- « réussi », créé les trois bonnes politiques `authenticated`, et laissé
-- les trois `anon` intactes.
--
-- J'avais relevé les noms des politiques de `app_state` lors d'un
-- diagnostic précédent, et j'ai extrapolé la même convention à ces trois
-- tables sans jamais la vérifier. Les noms étaient devinés.
--
-- ── Ce qu'anon peut encore faire, mesuré après la migration ────────────
--
--   SELECT financement_params  → 200      INSERT → 201
--   UPDATE financement_params  → 204      DELETE → 204
--   SELECT inscriptions        → 200   (nom, prénom, adresse du domicile)
--   SELECT responsables        → 200   (nom, téléphone, courriel)
--
-- ── Ce qui a été vérifié avant d'écrire ce correctif ───────────────────
--
-- Aucune surface publique déployée ne dépend de ces lectures :
--
--   `fiche.html`        n'appelle plus que `verifier_carte_scolaire`
--                       (SECURITY DEFINER, exécutable par anon). Vérifié
--                       en production : aucun `from('inscriptions')`, aucun
--                       `from('responsables')`.
--   `rapports.html`     ne lit aucune de ces trois tables.
--   `comptabilite.html` partage la session du portail depuis le dernier
--                       déploiement : ses lectures sont `authenticated`.
--   `inscription.html`  est réservée au personnel par une garde, mais
--                       tournait en `anon` — son tableau de bord lisait
--                       `inscriptions` avec la clé publique. Elle partage
--                       désormais la session du portail.
--
--   ⚠ CE CORRECTIF SUPPOSE LE DÉPLOIEMENT DE `inscription.html`.
--     Sans lui, le tableau de bord du secrétariat afficherait des zéros.
--
-- Le dépôt d'un dossier par un parent continue de passer par
-- `creer_inscription`, SECURITY DEFINER : il ne dépend d'aucune politique.
--
-- MINIMAL : trois `drop policy`, rien d'autre. Aucune politique
-- `authenticated` touchée, aucune fonction modifiée, aucune donnée écrite.
-- IDEMPOTENT : rejouable sans effet.

begin;

-- Les noms sont ceux relevés en production, entre guillemets doubles pour
-- « Allow all for anon » qui contient des espaces.
drop policy if exists "Allow all for anon"   on public.financement_params;
drop policy if exists "lecture_inscriptions" on public.inscriptions;
drop policy if exists "lecture_responsables" on public.responsables;

-- ── Contrôle DANS la transaction ──────────────────────────────────────
-- Si une politique anon ou public subsiste sur ces trois tables, on annule
-- tout plutôt que de laisser croire à une fermeture.
do $$
declare n integer;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public'
     and tablename in ('financement_params', 'inscriptions', 'responsables')
     and (roles::text like '%anon%' or roles::text like '%public%');
  if n > 0 then
    raise exception 'FERMETURE INCOMPLÈTE : % politique(s) visent encore anon ou public', n;
  end if;
end
$$;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- V1 — exactement trois politiques, toutes `authenticated`.
select tablename, policyname, cmd, roles::text, qual::text, with_check::text
  from pg_policies
 where schemaname = 'public'
   and tablename in ('financement_params', 'inscriptions', 'responsables')
 order by tablename, policyname;

-- V2 — RLS toujours active.
select relname, relrowsecurity as rls_active
  from pg_class
 where oid in ('public.financement_params'::regclass,
               'public.inscriptions'::regclass,
               'public.responsables'::regclass)
 order by relname;

-- V3 — les deux surfaces publiques restent intactes.
select p.proname,
       case when p.prosecdef then 'definer' else 'invoker' end as securite,
       pg_get_function_arguments(p.oid) as parametres
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('creer_inscription', 'verifier_carte_scolaire',
                     'enregistrer_paiement', 'notifier_preparation')
 order by p.proname;

-- V4 — anon peut toujours DÉPOSER un dossier et VÉRIFIER une carte.
select grantee, routine_name, privilege_type
  from information_schema.role_routine_grants
 where routine_schema = 'public'
   and routine_name in ('creer_inscription', 'verifier_carte_scolaire')
   and grantee = 'anon'
 order by routine_name;


-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- À n'exécuter que si une surface légitime se révèle cassée. Rétablit
-- exactement les trois politiques retirées, avec leurs noms d'origine.
--
-- begin;
-- create policy "Allow all for anon"   on public.financement_params
--   for all    to anon using (true) with check (true);
-- create policy "lecture_inscriptions" on public.inscriptions
--   for select to anon using (true);
-- create policy "lecture_responsables" on public.responsables
--   for select to anon using (true);
-- commit;
