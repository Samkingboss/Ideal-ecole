-- ============================================================
-- CONFINEMENT — cycle de vie des identités du personnel
--
-- Décision métier : créer, modifier ou désactiver un COMPTE du personnel
-- est réservé au rôle `directeur`. Le responsable administratif conserve
-- ses attributions RH mais perd le cycle de vie des identités.
--
-- Deux verrous, indissociables :
--   1. le privilège  — plus aucun EXECUTE hors `authenticated` ;
--   2. le corps      — garde `ideal_est(array['directeur'])` en tête.
--
-- Le verrou 1 seul serait insuffisant : le corps ne contrôlait rien, donc
-- tout compte authentifié pouvait s'appeler lui-même avec son propre
-- `p_id` et un `p_role` supérieur. `ideal_role()` lisant `users.role`,
-- c'était une élévation de privilèges effective.
--
-- Le verrou 2 seul serait insuffisant : les fonctions resteraient
-- atteignables sans session, exposant leur logique et leurs messages.
--
-- ORDRE — les CREATE OR REPLACE viennent AVANT les REVOKE, à dessein.
-- `create or replace` préserve les ACL d'une fonction existante ; mais si
-- une signature avait divergé, il CRÉERAIT une fonction neuve, dotée du
-- défaut PUBLIC EXECUTE. Révoquer ensuite ferme les deux cas.
--
-- NE MODIFIE PAS : users_secrets, la génération des codes, la création
-- d'identités auth.users. Confinement uniquement.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1 · enregistrer_utilisateur — corps identique, garde ajoutée
-- ------------------------------------------------------------
create or replace function public.enregistrer_utilisateur(
  p_id       uuid    default null,
  p_prenom   text    default null,
  p_nom      text    default null,
  p_role     text    default null,
  p_langue   text    default null,
  p_fonction text    default null,
  p_code     text    default null,
  p_plafond  integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id       uuid;
  v_code     text;
  v_role     text;
  v_fonction text;
  v_repli    boolean := false;
  v_ancien   text;
  v_user     public.users%rowtype;
begin
  ------------------------------------------------------------------
  -- Qui appelle — avant tout le reste
  ------------------------------------------------------------------
  -- Seule la Direction gère le cycle de vie des identités. Sans cette
  -- garde, tout compte authentifie pouvait se réattribuer un rôle
  -- supérieur en se passant son propre `p_id`.
  if not public.ideal_est(array['directeur']) then
    raise exception 'reserve_a_la_direction'
      using errcode = '42501',
            detail  = 'Seule la direction peut créer ou modifier un compte du personnel.';
  end if;

  ------------------------------------------------------------------
  -- Validations, avant toute écriture
  ------------------------------------------------------------------
  if nullif(btrim(coalesce(p_prenom, '')), '') is null
  or nullif(btrim(coalesce(p_nom,    '')), '') is null then
    raise exception 'identite_incomplete'
      using detail = 'Le prénom et le nom sont obligatoires.';
  end if;

  if nullif(btrim(coalesce(p_role, '')), '') is null then
    raise exception 'role_manquant';
  end if;

  -- Le compte le plus privilégié de la plateforme ne doit pas pouvoir être
  -- créé par l'API tant que l'authentification n'existe pas.
  if btrim(p_role) = 'directeur' then
    raise exception 'role_directeur_interdit'
      using detail = 'Le rôle directeur ne peut pas être attribué par cette voie.';
  end if;

  -- Ni modifié : sans cela, on relèverait la porte d'entrée par l'autre côté.
  if p_id is not null then
    select role into v_ancien from public.users where id = p_id;

    if v_ancien = 'directeur' then
      raise exception 'compte_directeur_protege'
        using detail = 'Le compte du directeur ne peut pas être modifié par cette voie.';
    end if;
  end if;

  v_code := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');

  if length(v_code) < 6 then
    raise exception 'code_trop_court'
      using detail = 'Le code d''accès doit compter au moins 6 caractères alphanumériques.';
  end if;

  v_role     := btrim(p_role);
  v_fonction := nullif(btrim(coalesce(p_fonction, '')), '');

  ------------------------------------------------------------------
  -- Écriture du compte, avec repli sur la contrainte de rôle
  ------------------------------------------------------------------
  begin
    insert into public.users (id, prenom, nom, role, langue, fonction, actif)
    values (coalesce(p_id, gen_random_uuid()),
            btrim(p_prenom), btrim(p_nom), v_role,
            nullif(btrim(coalesce(p_langue, '')), ''), v_fonction, true)
    on conflict (id) do update
       set prenom   = excluded.prenom,
           nom      = excluded.nom,
           role     = excluded.role,
           langue   = excluded.langue,
           fonction = excluded.fonction,
           actif    = true
    returning id into v_id;

  exception when check_violation then
    -- Comportement repris tel quel du client : rôle ramené à `surveillant`,
    -- fonction forcée à `cuisiniere`.
    v_repli    := true;
    v_role     := 'surveillant';
    v_fonction := 'cuisiniere';

    insert into public.users (id, prenom, nom, role, langue, fonction, actif)
    values (coalesce(p_id, gen_random_uuid()),
            btrim(p_prenom), btrim(p_nom), v_role,
            nullif(btrim(coalesce(p_langue, '')), ''), v_fonction, true)
    on conflict (id) do update
       set prenom   = excluded.prenom,
           nom      = excluded.nom,
           role     = excluded.role,
           langue   = excluded.langue,
           fonction = excluded.fonction,
           actif    = true
    returning id into v_id;
  end;

  ------------------------------------------------------------------
  -- Le secret, dans sa table
  ------------------------------------------------------------------
  insert into public.users_secrets (user_id, code_acces, plafond_salaire, updated_at)
  values (v_id, v_code, p_plafond, now())
  on conflict (user_id) do update
     set code_acces      = excluded.code_acces,
         plafond_salaire = excluded.plafond_salaire,
         updated_at      = now();

  ------------------------------------------------------------------
  -- Trace — sans prétendre connaître l'auteur
  ------------------------------------------------------------------
  insert into public.journal_audit
    (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
     auteur_id, auteur_nom, action)
  values
    ('users', v_id::text, null, null,
     format('role=%s%s', v_role, case when v_repli then ' (repli)' else '' end),
     null,
     'acteur non authentifie (phase 0)',
     case when p_id is null then 'creation_compte' else 'modification_compte' end);

  select * into v_user from public.users where id = v_id;

  return to_jsonb(v_user) - 'code_acces' - 'plafond_salaire';
end;
$function$;

-- ------------------------------------------------------------
-- 2 · desactiver_utilisateur — corps identique, garde ajoutée
-- ------------------------------------------------------------
create or replace function public.desactiver_utilisateur(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
begin
  -- Seule la Direction gère le cycle de vie des identités.
  if not public.ideal_est(array['directeur']) then
    raise exception 'reserve_a_la_direction'
      using errcode = '42501',
            detail  = 'Seule la direction peut désactiver un compte du personnel.';
  end if;

  if p_id is null then
    raise exception 'identifiant_manquant';
  end if;

  select role into v_role from public.users where id = p_id;

  if not found then
    raise exception 'compte_introuvable';
  end if;

  if v_role = 'directeur' then
    raise exception 'compte_directeur_protege'
      using detail = 'Le compte du directeur ne peut pas être désactivé par cette voie.';
  end if;

  update public.users set actif = false where id = p_id;

  insert into public.journal_audit
    (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
     auteur_id, auteur_nom, action)
  values
    ('users', p_id::text, 'actif', 'true', 'false',
     null, 'acteur non authentifie (phase 0)', 'desactivation_compte');

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$function$;

-- ------------------------------------------------------------
-- 3 · Les privilèges
--
-- `revoke all` retire EXECUTE quelle que soit son origine — le GRANT
-- explicite de phase0_1_creation.sql:365-367 comme le défaut PUBLIC.
-- On repart de zéro, puis on n'accorde que le strict nécessaire.
-- ------------------------------------------------------------

revoke all on function
  public.enregistrer_utilisateur(uuid,text,text,text,text,text,text,integer)
  from public, anon, authenticated;

revoke all on function
  public.desactiver_utilisateur(uuid)
  from public, anon, authenticated;

-- `authenticated` est rouvert : la porte technique. Le tri se fait dans
-- le corps, pas ici — PostgreSQL ne sait pas distinguer un directeur
-- d'un enseignant, tous deux sont `authenticated` côté PostgREST.
grant execute on function
  public.enregistrer_utilisateur(uuid,text,text,text,text,text,text,integer)
  to authenticated;

grant execute on function
  public.desactiver_utilisateur(uuid)
  to authenticated;

-- `authentifier_par_code` : plus aucun appelant. Le repli de connexion a
-- été retiré de LoginPage.jsx — Supabase Auth fait seul autorité. La
-- fonction reste en base, inatteignable, jusqu'à sa suppression en Phase 2.
revoke all on function
  public.authentifier_par_code(text)
  from public, anon, authenticated;

commit;

-- ============================================================
-- Attendu immédiatement après COMMIT :
--   anon                        → 42501 sur les trois
--   enseignant authentifié      → reserve_a_la_direction (42501)
--   resp. administratif authent.→ reserve_a_la_direction (42501)
--   directeur authentifié       → passe, comportement métier inchangé
-- Recette : scripts/gardes/recette-personnel-confinement.mjs
-- ============================================================
