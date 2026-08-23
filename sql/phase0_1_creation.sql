-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 0 — ÉTAPE 2 : CRÉER, SANS RIEN RETIRER
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ce script est volontairement NON DESTRUCTIF. Après son exécution :
--
--   • `users.code_acces` et `users.plafond_salaire` existent TOUJOURS ;
--   • l'application continue de fonctionner exactement comme avant ;
--   • rien n'est encore protégé.
--
-- Le retrait se fait au script `phase0_2_retrait.sql`, et seulement une fois
-- que le point de contrôle 5 est passé. Cette séparation est la sécurité de
-- toute l'opération : tant que ce script est seul appliqué, un simple retour
-- arrière du frontend suffit à revenir en arrière, sans perte.
--
-- ── Pourquoi déplacer plutôt que révoquer ──────────────────────────────
--
-- `REVOKE SELECT (code_acces)` casserait cinq écrans : sous PostgreSQL,
-- `SELECT *` se développe en la liste complète des colonnes et le droit est
-- vérifié colonne par colonne. Une seule colonne interdite fait échouer la
-- requête entière (42501), sans omission silencieuse.
--
-- En rangeant les secrets dans une table à laquelle `anon` n'a aucun droit,
-- `select('*')` continue de fonctionner partout — et surtout, plus aucune
-- distraction future ne peut les réexposer.

begin;

-- ── 1 · La table des secrets ───────────────────────────────────────────
--
-- `on delete cascade` : un compte supprimé emporte son secret. Aucun secret
-- orphelin ne peut subsister.

create table if not exists public.users_secrets (
  user_id         uuid primary key references public.users(id) on delete cascade,
  code_acces      text not null,
  plafond_salaire integer,
  updated_at      timestamptz not null default now()
);

comment on table public.users_secrets is
  'Données sensibles des comptes, sorties de `users` le 23 août 2026. '
  'Aucun droit n''est accordé à anon ni à authenticated : seules les '
  'fonctions SECURITY DEFINER y accèdent.';

-- Un même code ne peut pas être attribué à deux personnes : sans cela,
-- `authentifier_par_code` pourrait renvoyer un compte au hasard.
create unique index if not exists users_secrets_code_unique
  on public.users_secrets(code_acces);

-- ── 2 · Fermeture, avant tout remplissage ──────────────────────────────
--
-- Supabase accorde par défaut tous les droits à `anon` et `authenticated`
-- sur les nouvelles tables de `public`. Ces révocations ne sont donc pas
-- décoratives : sans elles, la table des secrets serait publique.
--
-- Ceinture et bretelles : révocation des droits ET politique RLS sans
-- aucune règle, ce qui interdit tout accès hors SECURITY DEFINER.

revoke all on public.users_secrets from anon, authenticated;
alter table public.users_secrets enable row level security;

-- ── 3 · Recopie, avec assertion ────────────────────────────────────────

insert into public.users_secrets (user_id, code_acces, plafond_salaire)
select id, code_acces, plafond_salaire
  from public.users
on conflict (user_id) do nothing;

do $$
declare
  n_users   integer;
  n_secrets integer;
begin
  select count(*) into n_users   from public.users;
  select count(*) into n_secrets from public.users_secrets;

  if n_users <> n_secrets then
    raise exception
      'Recopie incomplete : % compte(s) pour % secret(s). Rien n''est valide.',
      n_users, n_secrets;
  end if;

  raise notice 'Recopie conforme : % comptes, % secrets.', n_users, n_secrets;
end
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4 · AUTHENTIFICATION
-- ═══════════════════════════════════════════════════════════════════════
--
-- Remplace `select('*').eq('code_acces', …)` de LoginPage.jsx.
--
-- Deux exigences de comportement, héritées du code existant et à préserver
-- absolument (voir le commentaire de LoginPage.jsx ligne 68) :
--
--   • un code inconnu renvoie NULL — jamais une exception ;
--   • une panne réseau doit rester distinguable d'un code faux.
--
-- Si cette fonction levait une exception sur code inconnu, le client
-- afficherait « serveur injoignable » à quelqu'un qui s'est simplement
-- trompé de code. C'est pour cela qu'elle renvoie NULL en silence.
--
-- `to_jsonb(u) - 'code_acces' - 'plafond_salaire'` : le retrait est explicite
-- et fonctionne AVANT comme APRÈS la suppression des colonnes. Entre les
-- deux scripts, les colonnes existent encore dans `users` — un simple
-- `to_jsonb(u)` les renverrait au navigateur, exactement ce qu'on ferme.

create or replace function public.authentifier_par_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_code text;
  v_user public.users%rowtype;
begin
  -- Même normalisation que `normaliserCode` (LoginPage.jsx ligne 18) :
  -- majuscules, puis retrait de tout ce qui n'est ni lettre ni chiffre.
  v_code := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');

  if v_code = '' then
    return null;
  end if;

  select u.* into v_user
    from public.users u
    join public.users_secrets s on s.user_id = u.id
   where s.code_acces = v_code
     and u.actif = true;

  if not found then
    return null;
  end if;

  return to_jsonb(v_user) - 'code_acces' - 'plafond_salaire';
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5 · ENREGISTREMENT D'UN COMPTE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Remplace les deux `upsert` de DirecteurApp.jsx (lignes 524 et 538).
--
-- ── Ce que cette fonction NE FAIT PAS ──────────────────────────────────
--
-- Elle ne vérifie pas qui l'appelle. Elle ne le peut pas : il n'y a pas
-- encore d'authentification, `auth.uid()` vaut NULL, et un identifiant
-- transmis par le client ne serait qu'une affirmation. Conformément à la
-- décision du 23 août, elle n'en fait donc pas semblant : le journal
-- d'audit enregistrera `auteur_id = null` et le mentionnera explicitement.
--
-- ── Ce qu'elle apporte malgré tout ─────────────────────────────────────
--
--   • plus d'écriture de colonnes arbitraires — seuls les champs prévus ;
--   • le rôle `directeur` devient non créable et non modifiable ;
--   • aucune suppression n'est possible ;
--   • chaque appel laisse une trace dans un journal désormais ineffaçable.
--
-- Le repli sur `users_role_check` reproduit le comportement client existant
-- (DirecteurApp.jsx lignes 536-547). Je n'ai pas pu lire la définition de
-- la contrainte — le catalogue est inaccessible depuis PostgREST — donc je
-- reproduis l'effet observé sans prétendre en connaître la règle.

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

-- ═══════════════════════════════════════════════════════════════════════
-- 6 · DÉSACTIVATION
-- ═══════════════════════════════════════════════════════════════════════
--
-- Remplace `update({actif:false})` de DirecteurApp.jsx ligne 650.
-- Ne supprime jamais : la désactivation reste réversible, conformément au
-- modèle déjà retenu ailleurs dans la plateforme.

create or replace function public.desactiver_utilisateur(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
begin
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

-- ── 7 · Droits d'exécution ─────────────────────────────────────────────
--
-- Accordées à `anon` : il n'y a pas encore d'autre rôle. C'est la limite
-- assumée de la phase 0, levée en phase 3.

grant execute on function public.authentifier_par_code(text)                           to anon, authenticated;
grant execute on function public.enregistrer_utilisateur(uuid,text,text,text,text,text,text,integer) to anon, authenticated;
grant execute on function public.desactiver_utilisateur(uuid)                          to anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — après le COMMIT
-- ═══════════════════════════════════════════════════════════════════════
-- Attendu : autant de secrets que de comptes, et zéro divergence.

select
  (select count(*) from public.users)         as comptes,
  (select count(*) from public.users_secrets) as secrets,
  (select count(*) from public.users u
     left join public.users_secrets s on s.user_id = u.id
    where s.user_id is null)                  as comptes_sans_secret;
-- attendu : 13 | 13 | 0

-- Concordance de chaque code recopié, sans afficher aucune valeur.
select count(*) as divergences
  from public.users u
  join public.users_secrets s on s.user_id = u.id
 where u.code_acces is distinct from s.code_acces
    or u.plafond_salaire is distinct from s.plafond_salaire;
-- attendu : 0
