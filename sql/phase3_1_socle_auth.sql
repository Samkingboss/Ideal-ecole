-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 3 — ÉTAPE 1 : LE SOCLE D'AUTHENTIFICATION
-- ═══════════════════════════════════════════════════════════════════════
--
-- Décision D5 : Supabase Auth devient l'autorité d'authentification.
-- L'expérience du personnel reste « identifiant court + code secret » ; le
-- compte Auth vit derrière, invisible.
--
-- ── Pourquoi un INSERT SQL et non signUp() ─────────────────────────────
--
-- Le projet exige la confirmation d'e-mail (`mailer_autoconfirm` désactivé).
-- Un `signUp()` créerait treize comptes non confirmés, donc inutilisables,
-- et attendrait un courriel que personne ne recevra — les adresses sont
-- synthétiques. L'insertion directe pose `email_confirmed_at` et règle la
-- question.
--
-- ── L'adresse synthétique ──────────────────────────────────────────────
--
-- `identifiant@comptes.ideal-ecole.ml`, déterministe. Le frontend la
-- reconstruit sans requête préalable : pas de table de correspondance à
-- interroger avant de se connecter, ce qui compte sur un réseau instable.
-- Aucun courriel n'y est jamais envoyé.
--
-- ── La transition ──────────────────────────────────────────────────────
--
-- Les comptes Auth reçoivent LE CODE ACTUEL de chaque personne, lu dans
-- `users_secrets`. Personne ne change de code, personne n'est enfermé
-- dehors. `users_secrets` survit à cette étape et ne sera supprimée qu'une
-- fois les connexions Auth vérifiées — c'est le filet de la migration.
--
-- NON DESTRUCTIF : additif. Aucune colonne supprimée, aucun compte modifié.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · IDENTIFIANT COURT ET LIEN VERS L'IDENTITÉ AUTH
-- ═══════════════════════════════════════════════════════════════════════
--
-- Une personne, un profil IDEAL, une identité Auth. Les deux contraintes
-- d'unicité rendent le doublon impossible, plutôt que déconseillé.

alter table public.users
  add column if not exists identifiant  text,
  add column if not exists auth_user_id uuid;

comment on column public.users.identifiant is
  'Identifiant court de connexion, saisi par la personne. L''adresse Auth en '
  'derive : identifiant || ''@comptes.ideal-ecole.ml''.';
comment on column public.users.auth_user_id is
  'Identite Supabase Auth. Une personne, un profil, une identite.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · GÉNÉRATION DES IDENTIFIANTS
-- ═══════════════════════════════════════════════════════════════════════
--
-- Première lettre du prénom + nom, sans accent ni espace. Deux « Bintou
-- NABO » existent : la collision reçoit un suffixe numérique plutôt que de
-- faire échouer la migration.

do $$
declare
  r      record;
  base   text;
  cand   text;
  n      integer;
begin
  for r in select id, prenom, nom from public.users
            where identifiant is null
            order by created_at nulls last, id
  loop
    base := lower(regexp_replace(
              public.unaccent_simple(coalesce(left(r.prenom,1),'') || coalesce(r.nom,'')),
              '[^a-z0-9]', '', 'g'));
    base := nullif(left(base, 14), '');
    if base is null then base := 'compte'; end if;

    cand := base; n := 1;
    while exists (select 1 from public.users where identifiant = cand) loop
      n := n + 1;
      cand := base || n::text;
    end loop;

    update public.users set identifiant = cand where id = r.id;
  end loop;
end
$$;

create unique index if not exists users_identifiant_unique on public.users(identifiant);
alter table public.users alter column identifiant set not null;

-- ═══════════════════════════════════════════════════════════════════════
-- 3 · CRÉATION DES IDENTITÉS AUTH
-- ═══════════════════════════════════════════════════════════════════════
--
-- Chaque compte reçoit son code actuel, haché par Supabase Auth (bcrypt).
-- Après cette étape, le code existe sous deux formes : en clair dans
-- `users_secrets` — le filet — et haché dans `auth.users`. L'étape 4
-- supprimera la première, une fois les connexions prouvées.
--
-- `auth.identities.provider_id` n'existe que sur les versions récentes de
-- GoTrue. On l'insère dynamiquement plutôt que de parier sur la version.

do $$
declare
  r              record;
  v_auth_id      uuid;
  v_email        text;
  a_provider_id  boolean;
  n_crees        integer := 0;
begin
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'identities'
       and column_name = 'provider_id'
  ) into a_provider_id;

  for r in
    select u.id, u.identifiant, u.prenom, u.nom, u.role, s.code_acces
      from public.users u
      join public.users_secrets s on s.user_id = u.id
     where u.auth_user_id is null
  loop
    v_email   := lower(r.identifiant) || '@comptes.ideal-ecole.ml';
    v_auth_id := gen_random_uuid();

    -- Les colonnes de jetons refusent NULL sur plusieurs versions de
    -- GoTrue : on les initialise à la chaîne vide.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_auth_id,
      'authenticated', 'authenticated', v_email,
      extensions.crypt(r.code_acces, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('identifiant', r.identifiant,
                         'prenom', r.prenom, 'nom', r.nom, 'role', r.role),
      '', '', '', ''
    );

    if a_provider_id then
      insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                                   last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_auth_id, v_auth_id::text,
              jsonb_build_object('sub', v_auth_id::text, 'email', v_email,
                                 'email_verified', true, 'phone_verified', false),
              'email', now(), now(), now());
    else
      insert into auth.identities (id, user_id, identity_data, provider,
                                   last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_auth_id,
              jsonb_build_object('sub', v_auth_id::text, 'email', v_email,
                                 'email_verified', true, 'phone_verified', false),
              'email', now(), now(), now());
    end if;

    update public.users set auth_user_id = v_auth_id where id = r.id;
    n_crees := n_crees + 1;
  end loop;

  raise notice 'Identites Auth creees : %', n_crees;
end
$$;

create unique index if not exists users_auth_user_id_unique on public.users(auth_user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 4 · LE PONT ENTRE L'IDENTITÉ AUTH ET LE PROFIL IDEAL
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ces deux fonctions sont le socle de toutes les politiques RLS à venir.
-- Elles lisent `auth.uid()`, jamais une valeur transmise par le client :
-- c'est toute la différence entre une permission et une convention
-- d'affichage.

create or replace function public.ideal_profil()
returns public.users
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select u.* from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true
   limit 1;
$function$;

create or replace function public.ideal_role()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select u.role from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true
   limit 1;
$function$;

create or replace function public.ideal_est(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.ideal_role() = any(p_roles), false);
$function$;

grant execute on function public.ideal_profil()      to authenticated;
grant execute on function public.ideal_role()        to anon, authenticated;
grant execute on function public.ideal_est(text[])   to anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Une personne, un profil, une identité. Aucun doublon, aucun orphelin.
select count(*)                                            as profils,
       count(identifiant)                                  as avec_identifiant,
       count(auth_user_id)                                 as avec_identite_auth,
       count(distinct identifiant)                         as identifiants_distincts,
       count(distinct auth_user_id)                        as identites_distinctes
  from public.users;
-- attendu : 13 | 13 | 13 | 13 | 13

-- Chaque identité Auth correspond à un seul profil, et réciproquement.
select count(*) as anomalies
  from public.users u
  left join auth.users a on a.id = u.auth_user_id
 where u.auth_user_id is null
    or a.id is null
    or a.email <> lower(u.identifiant) || '@comptes.ideal-ecole.ml'
    or a.email_confirmed_at is null;
-- attendu : 0

-- Les identifiants, pour distribution. Aucun code n'apparaît.
select identifiant, prenom, nom, role, actif
  from public.users order by actif desc, role, nom;
