-- ═══════════════════════════════════════════════════════════════════════
-- FERMER `documents_inscription`, `users` ET `disciplines` À LA CLÉ PUBLIQUE
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Ce que la clé publique obtient aujourd'hui ─────────────────────────
--
--   documents_inscription  18 lignes — type, nom de fichier et chemin de
--                          l'acte de naissance, du carnet de vaccination,
--                          du bulletin et du certificat de transfert de
--                          chaque enfant, nommément
--   users                  13 lignes — prénom, nom, rôle et IDENTIFIANT DE
--                          CONNEXION de tout le personnel
--   disciplines             4 lignes — motif et gravité des incidents
--                          (« Gifler son maître », grave)
--
-- Les FICHIERS eux-mêmes restent protégés : le bucket est privé et l'URL
-- publique répond « Bucket not found ». Seules les métadonnées fuient —
-- mais elles nomment l'enfant et la nature du document.
--
-- ── Lecteurs tracés avant toute fermeture ──────────────────────────────
--
-- La méthode est celle qui a marché pour les trois premières tables :
-- établir qui lit, vérifier que ces lecteurs sont authentifiés, puis
-- fermer. Relevé exhaustif sur `src/` et `public/` :
--
--   documents_inscription  AUCUN LECTEUR. Écrite uniquement par
--                          `creer_inscription`, SECURITY DEFINER. C'est
--                          d'ailleurs pourquoi aucun écran ne montre les
--                          pièces manquantes.
--   users                  8 accès — sept écrans du portail React
--                          (authentifié depuis la phase 3.1) et
--                          `comptabilite.html`, qui partage la session du
--                          portail depuis le déploiement précédent.
--                          La CONNEXION n'en fait pas partie : elle passe
--                          par `signInWithPassword` puis `ideal_profil()`,
--                          SECURITY DEFINER. Fermer `users` ne peut donc
--                          pas enfermer quelqu'un dehors.
--   disciplines            7 accès — ProfApp, SurveillantApp,
--                          DirecteurApp, ConseillerApp, ActivitePersonnel,
--                          SignalementIncident. Tous dans le portail
--                          authentifié. Aucune page statique.
--
-- Aucune surface publique ne lit ces trois tables. La fermeture ne casse
-- donc rien, et aucun déploiement préalable n'est nécessaire.
--
-- ── Périmètre choisi ───────────────────────────────────────────────────
--
--   documents_inscription  personnel connecté, en lecture. L'écriture
--                          reste à `creer_inscription` et à l'ajout
--                          ultérieur d'une pièce par le personnel.
--   users                  personnel connecté. Les colonnes sensibles
--                          (`code_acces`, `plafond_salaire`) sont déjà
--                          hors de portée par les gardes L1 et L2 : cette
--                          politique ne les rouvre pas.
--   disciplines            personnel connecté. Le détail de qui peut
--                          écrire quoi relève d'un chantier de rôles à
--                          part ; on ferme d'abord la lecture publique.
--
-- NON DESTRUCTIF : aucune donnée touchée. IDEMPOTENT : rejouable.

begin;

alter table public.documents_inscription enable row level security;
alter table public.users                 enable row level security;
alter table public.disciplines           enable row level security;

-- Les politiques existantes sont retirées par leur nom RÉEL, relevé en
-- production. Ne jamais deviner un nom de politique : `drop policy if
-- exists` sur un nom inexistant est un no-op silencieux, et c'est
-- exactement ce qui a fait échouer la fermeture précédente.
do $$
declare p record;
begin
  for p in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('documents_inscription', 'users', 'disciplines')
       and (roles::text like '%anon%' or roles::text like '%public%')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    raise notice 'politique retirée : %.%', p.tablename, p.policyname;
  end loop;
end
$$;

drop policy if exists documents_inscription_personnel on public.documents_inscription;
-- SUPERSÉDÉ PAR rls_restreindre_donnees_familiales.sql — prédicat composite corrigé.
create policy documents_inscription_personnel
  on public.documents_inscription
  for select to authenticated
  using (public.ideal_profil() is not null);

drop policy if exists users_personnel on public.users;
-- SUPERSÉDÉ PAR rls_correctif_predicat_personnel.sql — prédicat composite corrigé.
create policy users_personnel
  on public.users
  for select to authenticated
  using (public.ideal_profil() is not null);

drop policy if exists disciplines_personnel on public.disciplines;
-- SUPERSÉDÉ PAR rls_correctif_predicat_personnel.sql — prédicat composite corrigé.
create policy disciplines_personnel
  on public.disciplines
  for select to authenticated
  using (public.ideal_profil() is not null);

-- L'écriture des incidents reste possible pour le personnel : elle existe
-- déjà dans ProfApp et SignalementIncident, et la fermer romprait le
-- signalement.
drop policy if exists disciplines_ecriture_personnel on public.disciplines;
-- SUPERSÉDÉ PAR rls_correctif_predicat_personnel.sql — prédicat composite corrigé.
create policy disciplines_ecriture_personnel
  on public.disciplines
  for insert to authenticated
  with check (public.ideal_profil() is not null);

drop policy if exists disciplines_maj_personnel on public.disciplines;
-- SUPERSÉDÉ PAR rls_correctif_predicat_personnel.sql — prédicat composite corrigé.
create policy disciplines_maj_personnel
  on public.disciplines
  for update to authenticated
  using (public.ideal_profil() is not null)
  with check (public.ideal_profil() is not null);

-- ── Contrôle DANS la transaction ──────────────────────────────────────
do $$
declare n integer;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public'
     and tablename in ('documents_inscription', 'users', 'disciplines')
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

-- W1 — les politiques des trois tables, toutes `authenticated`.
select tablename, policyname, cmd, roles::text
  from pg_policies
 where schemaname = 'public'
   and tablename in ('documents_inscription', 'users', 'disciplines')
 order by tablename, cmd, policyname;

-- W2 — RLS active.
select relname, relrowsecurity as rls_active
  from pg_class
 where oid in ('public.documents_inscription'::regclass,
               'public.users'::regclass,
               'public.disciplines'::regclass)
 order by relname;

-- W3 — la connexion ne dépend pas de `users` : les deux fonctions du pont
--      Auth restent SECURITY DEFINER.
select p.proname, case when p.prosecdef then 'definer' else 'invoker' end as securite
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('ideal_profil', 'ideal_role', 'ideal_est')
 order by p.proname;


-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- begin;
-- drop policy if exists documents_inscription_personnel on public.documents_inscription;
-- drop policy if exists users_personnel                 on public.users;
-- drop policy if exists disciplines_personnel           on public.disciplines;
-- drop policy if exists disciplines_ecriture_personnel  on public.disciplines;
-- drop policy if exists disciplines_maj_personnel       on public.disciplines;
-- create policy lecture_documents on public.documents_inscription for select to anon using (true);
-- create policy lecture_users     on public.users                 for select to anon using (true);
-- create policy lecture_disc      on public.disciplines           for all    to anon using (true) with check (true);
-- commit;
