-- ═══════════════════════════════════════════════════════════════════════
-- RESTREINDRE LES DONNÉES FAMILIALES À LA DIRECTION
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Ce que le test authentifié a révélé ────────────────────────────────
--
--   15c · une ENSEIGNANTE lit `responsables` → 200, avec des lignes.
--
-- Les téléphones, courriels et adresses des parents sont accessibles à
-- tout membre du personnel connecté. Ce n'était pas un accident : la
-- politique posée disait « personnel connecté », et une enseignante en
-- fait partie. C'est le périmètre qui était trop large.
--
-- ── Ce qui a été tracé avant de restreindre ────────────────────────────
--
--   `responsables`           lue par UN SEUL écran : InscriptionsValidation
--   `inscriptions`           lue par CartesScolaires, CertificatScolarite,
--                            InscriptionsValidation, DirecteurApp,
--                            comptabilite.html, inscription.html
--   `documents_inscription`  lue par InscriptionsValidation
--
-- Les trois composants React sont montés dans `DirecteurApp` — et rien
-- d'autre. Les deux pages statiques sont réservées à la direction et au
-- responsable administratif, par garde et par session partagée.
--
-- Vérifié : `ProfApp`, `SurveillantApp`, `MaternelleApp` et `ConseillerApp`
-- ne lisent AUCUNE de ces trois tables. Zéro occurrence.
--
-- Restreindre à la direction ne casse donc aucun écran d'enseignante :
-- il n'y en a pas qui en dépende.
--
-- ── Ce qui n'est PAS restreint, et pourquoi ────────────────────────────
--
--   `users`        une enseignante a besoin de lire ses collègues —
--                  SurveillantApp affiche les professeurs, MaternelleApp
--                  les assistantes, les préparations montrent leur auteur.
--                  Reste au personnel connecté.
--   `disciplines`  une enseignante signale un incident et consulte ceux de
--                  sa classe. Reste au personnel connecté.
--
-- NON DESTRUCTIF. IDEMPOTENT. Aucune donnée touchée, aucune fonction
-- modifiée, aucun droit accordé à `anon`.

begin;

-- `ideal_est_direction()` existe depuis la première fermeture et lit
-- `auth.uid()`, jamais une valeur transmise par le client.

drop policy if exists inscriptions_personnel  on public.inscriptions;
create policy inscriptions_direction
  on public.inscriptions
  for select to authenticated
  using (public.ideal_est_direction());

drop policy if exists responsables_personnel  on public.responsables;
create policy responsables_direction
  on public.responsables
  for select to authenticated
  using (public.ideal_est_direction());

drop policy if exists documents_inscription_personnel on public.documents_inscription;
create policy documents_inscription_direction
  on public.documents_inscription
  for select to authenticated
  using (public.ideal_est_direction());

-- ── Contrôle DANS la transaction ──────────────────────────────────────
do $$
declare n integer;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public'
     and tablename in ('inscriptions', 'responsables', 'documents_inscription')
     and (roles::text like '%anon%' or roles::text like '%public%');
  if n > 0 then
    raise exception 'FERMETURE INCOMPLÈTE : % politique(s) visent anon ou public', n;
  end if;
end
$$;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Y1 — trois politiques, toutes réservées à la direction.
--      ATTENDU :
--        documents_inscription | documents_inscription_direction | SELECT | {authenticated}
--        inscriptions          | inscriptions_direction          | SELECT | {authenticated}
--        responsables          | responsables_direction          | SELECT | {authenticated}
select tablename, policyname, cmd, roles::text, qual::text
  from pg_policies
 where schemaname = 'public'
   and tablename in ('inscriptions', 'responsables', 'documents_inscription')
 order by tablename;

-- Y2 — l'ancienne politique « personnel » a bien disparu.
--      ATTENDU : 0
select count(*) as anciennes_politiques_personnel
  from pg_policies
 where schemaname = 'public'
   and policyname in ('inscriptions_personnel', 'responsables_personnel',
                      'documents_inscription_personnel');

-- Y3 — `users` et `disciplines` restent au personnel : une enseignante doit
--      continuer à voir ses collègues et à signaler un incident.
--      ATTENDU : users_personnel, disciplines_personnel,
--                disciplines_ecriture_personnel, disciplines_maj_personnel
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename in ('users', 'disciplines')
 order by tablename, cmd;


-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- begin;
-- drop policy if exists inscriptions_direction          on public.inscriptions;
-- drop policy if exists responsables_direction          on public.responsables;
-- drop policy if exists documents_inscription_direction on public.documents_inscription;
-- create policy inscriptions_personnel on public.inscriptions
--   for select to authenticated using (public.ideal_profil() is not null);
-- create policy responsables_personnel on public.responsables
--   for select to authenticated using (public.ideal_profil() is not null);
-- create policy documents_inscription_personnel on public.documents_inscription
--   for select to authenticated using (public.ideal_profil() is not null);
-- commit;
