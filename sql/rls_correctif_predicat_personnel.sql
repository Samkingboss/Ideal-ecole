-- ═══════════════════════════════════════════════════════════════════════
-- CORRIGER UN PRÉDICAT QUI NE VEUT PAS DIRE CE QU'IL A L'AIR DE DIRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Le piège ───────────────────────────────────────────────────────────
--
-- Cinq de mes politiques disent :
--
--   using (public.ideal_profil() is not null)
--
-- L'intention était « la session correspond à un membre du personnel ».
-- Ce n'est PAS ce que cette expression signifie.
--
-- `ideal_profil()` rend une ligne entière de `public.users` — un composite.
-- Et en SQL, `composite IS NOT NULL` est vrai seulement si AUCUN de ses
-- champs n'est nul :
--
--   ROW(1, 'a')   IS NOT NULL  →  true
--   ROW(1, NULL)  IS NOT NULL  →  FALSE
--
-- Une ligne de `users` dont `telephone`, `email`, `date_embauche` ou
-- n'importe quelle autre colonne est vide rend donc le prédicat FAUX, et la
-- politique refuse — alors que la personne existe et est active.
--
-- Ce n'est pas une hypothèse de lecture : quand `users` était encore
-- lisible, plusieurs comptes du personnel portaient `telephone: null` et
-- `email: null`.
--
-- ── Ce que cela casse ──────────────────────────────────────────────────
--
--   app_state_lecture_personnel   la cloche de la direction. C'est la
--                                 politique posée précisément pour qu'elle
--                                 puisse lire ses notifications.
--   users_personnel               une enseignante ne verrait plus ses
--                                 collègues, ni l'auteur d'une préparation.
--   disciplines_personnel         ni les incidents.
--   disciplines_ecriture / maj    ni n'en signalerait.
--
-- Les politiques `…_direction` ne sont PAS touchées : `ideal_est_direction()`
-- rend un booléen, pas un composite. C'est d'ailleurs pourquoi les tests 9 à
-- 14 passent et que l'enseignante est correctement exclue.
--
-- ── Le correctif ───────────────────────────────────────────────────────
--
-- `ideal_role()` rend un `text` : `IS NOT NULL` y a son sens ordinaire. La
-- fonction existe depuis la phase 3.1, lit `auth.uid()` et filtre déjà sur
-- `actif = true`.
--
-- NON DESTRUCTIF. IDEMPOTENT. Aucune donnée touchée, aucune fonction
-- modifiée, aucun droit accordé à `anon`.

begin;

-- ── Avant : la preuve du piège ────────────────────────────────────────
-- Ce que valent les deux écritures pour chaque membre du personnel.
-- ATTENDU : `predicat_composite` faux pour toute personne ayant au moins une
-- colonne vide ; `predicat_role` vrai pour tout le monde d'actif.
select u.identifiant,
       u.role,
       (u.*) is not null as predicat_composite,
       u.role is not null as predicat_role
  from public.users u
 where u.actif = true
 order by predicat_composite, u.identifiant;

alter policy app_state_lecture_personnel on public.app_state
  using (public.ideal_role() is not null);

alter policy users_personnel on public.users
  using (public.ideal_role() is not null);

alter policy disciplines_personnel on public.disciplines
  using (public.ideal_role() is not null);

alter policy disciplines_ecriture_personnel on public.disciplines
  with check (public.ideal_role() is not null);

alter policy disciplines_maj_personnel on public.disciplines
  using (public.ideal_role() is not null)
  with check (public.ideal_role() is not null);

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Z1 — plus aucune politique ne teste un composite.
--      ATTENDU : 0
select count(*) as politiques_au_predicat_composite
  from pg_policies
 where schemaname = 'public'
   and (qual like '%ideal_profil() IS NOT NULL%'
     or with_check like '%ideal_profil() IS NOT NULL%');

-- Z2 — les cinq politiques du personnel, avec leur nouveau prédicat.
--      ATTENDU : 5 lignes, toutes citant `ideal_role()`
select tablename, policyname, cmd,
       coalesce(qual, with_check) as predicat
  from pg_policies
 where schemaname = 'public'
   and policyname in ('app_state_lecture_personnel', 'users_personnel',
                      'disciplines_personnel', 'disciplines_ecriture_personnel',
                      'disciplines_maj_personnel')
 order by tablename, cmd, policyname;

-- Z3 — les politiques de direction n'ont pas bougé.
--      ATTENDU : 4 lignes citant `ideal_est_direction()`
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and qual like '%ideal_est_direction%'
 order by tablename;


-- ═══════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- begin;
-- alter policy app_state_lecture_personnel   on public.app_state   using (public.ideal_profil() is not null);
-- alter policy users_personnel               on public.users       using (public.ideal_profil() is not null);
-- alter policy disciplines_personnel         on public.disciplines using (public.ideal_profil() is not null);
-- alter policy disciplines_ecriture_personnel on public.disciplines with check (public.ideal_profil() is not null);
-- alter policy disciplines_maj_personnel     on public.disciplines using (public.ideal_profil() is not null) with check (public.ideal_profil() is not null);
-- commit;
