-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 2 — CRÉATION SÉCURISÉE DES COMPTES DU PERSONNEL
--
-- Le directeur crée un membre ; le membre choisit son mot de passe par un
-- lien à usage unique. Le directeur ne voit jamais de secret.
--
-- ── Ce que ce fichier NE fait PAS ──────────────────────────────────────
--
-- Il n'écrit RIEN dans `auth.users` ni `auth.identities`. La migration
-- ponctuelle phase3_1_socle_auth.sql l'a fait une fois, sous surveillance ;
-- un workflow permanent ne peut pas dépendre d'un schéma interne que
-- Supabase fait évoluer sans préavis. Les deux écritures Auth — créer une
-- identité, poser un mot de passe — passent par l'API Admin, depuis une
-- fonction serveur Vercel. Voir api/personnel-creer.js et
-- api/personnel-activer.js.
--
-- Raison décisive, au-delà de la compatibilité : un
-- `update auth.users set encrypted_password = …` ne révoque pas les
-- sessions en cours. Un membre reprenant la main sur un compte compromis
-- laisserait vivante la session de l'intrus. GoTrue, lui, sait ce qu'un
-- changement de mot de passe implique.
--
-- ── Ce que ce fichier ne touche pas ────────────────────────────────────
--
-- `users_secrets` : aucune écriture, aucun effacement, aucun drop.
-- `enregistrer_utilisateur` / `desactiver_utilisateur` : laissées telles
-- que la Phase 1 les a confinées.
-- Les comptes existants : ni mot de passe, ni identifiant, ni
-- auth_user_id, ni ligne de secret modifiés.
--
-- NON DESTRUCTIF : additif. Aucune colonne ni table supprimée.
-- ═══════════════════════════════════════════════════════════════════════

begin;

create extension if not exists pgcrypto with schema extensions;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · LE TÉLÉPHONE DU PERSONNEL — pourquoi PAS dans public.users
-- ═══════════════════════════════════════════════════════════════════════
--
-- La consigne demandait `public.users.telephone`. La cartographie exigée
-- par la même consigne l'interdit, et voici la mesure :
--
--   policy `users_personnel` (rls_correctif_predicat_personnel.sql:69)
--     on public.users for select to authenticated
--     using (public.ideal_role() is not null)
--       ⟹ TOUT membre du personnel lit TOUTE la table users.
--
--   cinq écrans font `select('*')` dessus — DirecteurApp:429,
--   SurveillantApp:64, MaternelleApp:156, PerformancesDirecteur:13,
--   plus comptabilite.html.
--
-- Une colonne `telephone` dans `users` serait donc lue par les
-- surveillants, les enseignants et les assistantes de maternelle. La
-- consigne dit : « ne pas rendre le téléphone visible à des rôles qui ne
-- le voient pas déjà sans justification ». C'est exactement ce cas.
--
-- Un `revoke select (telephone) … from authenticated` ne sauve pas : en
-- PostgreSQL, un privilège refusé sur UNE colonne fait échouer tout
-- `select *`. Les cinq écrans casseraient.
--
-- D'où une table séparée, sans policy, atteignable par les seules
-- fonctions SECURITY DEFINER gardées « directeur ». Le numéro est saisi à
-- la création, comme demandé ; il n'est simplement lisible que par la
-- direction.

create table if not exists public.personnel_contact (
  user_id    uuid primary key references public.users(id) on delete cascade,
  telephone  text,
  updated_at timestamptz not null default now()
);

comment on table public.personnel_contact is
  'Numero WhatsApp du personnel. Hors de `users` a dessein : la policy '
  '`users_personnel` ouvre cette table a tout le personnel, ce numero non.';

revoke all on table public.personnel_contact from public, anon, authenticated;
alter table public.personnel_contact enable row level security;
-- Aucune policy : ceinture et bretelles, comme users_secrets.

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · LES LIENS D'ACTIVATION
-- ═══════════════════════════════════════════════════════════════════════
--
-- Calque de `liens_publics_inscription`, contraintes comprises. Le token
-- brut n'existe qu'en transit ; seule son empreinte est stockée.

create table if not exists public.acces_personnel (
  id          uuid primary key default pg_catalog.gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  token_hash  bytea not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  revoked_at  timestamptz,
  constraint acces_personnel_hash_chk        check (octet_length(token_hash) = 32),
  constraint acces_personnel_hash_unique     unique (token_hash),
  constraint acces_personnel_expiration_chk  check (expires_at > created_at),
  constraint acces_personnel_usage_chk       check (used_at    is null or used_at    >= created_at),
  constraint acces_personnel_revocation_chk  check (revoked_at is null or revoked_at >= created_at)
);

-- Un seul lien VIVANT par membre. Garanti par la base, pas par la
-- discipline de l'appelant : deux « Envoyer l'accès » simultanés ne
-- peuvent pas produire deux liens utilisables.
create unique index if not exists acces_personnel_vivant_unique
  on public.acces_personnel(user_id)
  where used_at is null and revoked_at is null;

create index if not exists acces_personnel_user_idx
  on public.acces_personnel(user_id);

revoke all on table public.acces_personnel from public, anon, authenticated;
alter table public.acces_personnel enable row level security;
-- Aucune policy : les empreintes ne sortent jamais par PostgREST.

-- ═══════════════════════════════════════════════════════════════════════
-- 3 · IDENTIFIANT DISPONIBLE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Même algorithme que phase3_1_socle_auth.sql : initiale du prénom + nom,
-- sans accent, suffixé en cas de collision — deux « Bintou NABO »
-- existent déjà dans les données.
--
-- Cette fonction PROPOSE, elle ne réserve pas. Deux créations simultanées
-- pourraient recevoir la même valeur ; la collision est alors refusée
-- DEUX FOIS en aval, par deux autorités indépendantes : l'unicité d'e-mail
-- de GoTrue, puis `users_identifiant_unique`. Aucun état corrompu n'est
-- atteignable, et c'est pour cela qu'on ne pose pas de verrou ici.

create or replace function public.identifiant_disponible(p_prenom text, p_nom text)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_base text;
  v_cand text;
  v_n    integer := 1;
begin
  if not public.ideal_est(array['directeur']) then
    raise exception 'reserve_a_la_direction'
      using errcode = '42501';
  end if;

  v_base := lower(regexp_replace(
              public.unaccent_simple(coalesce(left(btrim(coalesce(p_prenom,'')),1),'')
                                  || coalesce(btrim(coalesce(p_nom,'')),'')),
              '[^a-z0-9]', '', 'g'));
  v_base := nullif(left(v_base, 14), '');
  if v_base is null then v_base := 'compte'; end if;

  v_cand := v_base;
  while exists (select 1 from public.users where identifiant = v_cand) loop
    v_n := v_n + 1;
    v_cand := v_base || v_n::text;
  end loop;

  return v_cand;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4 · RATTACHEMENT DU PROFIL À L'IDENTITÉ AUTH
-- ═══════════════════════════════════════════════════════════════════════
--
-- Appelée APRÈS auth.admin.createUser, avec le jeton du DIRECTEUR — pas
-- avec la clé serveur. Deux conséquences : la garde de rôle fonctionne, et
-- `auth.uid()` identifie enfin l'auteur. La ligne d'audit cesse d'écrire
-- « acteur non authentifie (phase 0) » sur ce chemin.
--
-- Si cette fonction échoue, l'identité Auth vient d'être créée et se
-- retrouve orpheline. La compensation `auth.admin.deleteUser` incombe à
-- l'appelant — voir api/personnel-creer.js. Elle n'est PAS optionnelle :
-- un e-mail Auth orphelin bloquerait toute recréation du même membre.

create or replace function public.rattacher_membre_personnel(
  p_auth_user_id uuid,
  p_identifiant  text,
  p_prenom       text,
  p_nom          text,
  p_role         text,
  p_langue       text    default null,
  p_fonction     text    default null,
  p_telephone    text    default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id   uuid;
  v_role text;
  v_user public.users%rowtype;
begin
  if not public.ideal_est(array['directeur']) then
    raise exception 'reserve_a_la_direction'
      using errcode = '42501',
            detail  = 'Seule la direction peut creer un compte du personnel.';
  end if;

  if p_auth_user_id is null then
    raise exception 'identite_auth_manquante';
  end if;

  if nullif(btrim(coalesce(p_identifiant,'')), '') is null then
    raise exception 'identifiant_manquant';
  end if;

  if nullif(btrim(coalesce(p_prenom,'')), '') is null
  or nullif(btrim(coalesce(p_nom,'')), '') is null then
    raise exception 'identite_incomplete'
      using detail = 'Le prenom et le nom sont obligatoires.';
  end if;

  v_role := nullif(btrim(coalesce(p_role,'')), '');
  if v_role is null then
    raise exception 'role_manquant';
  end if;

  -- Le compte le plus privilegie de la plateforme ne se cree pas par
  -- l'API. Meme regle qu'en Phase 1, meme raison.
  if v_role = 'directeur' then
    raise exception 'role_directeur_interdit';
  end if;

  insert into public.users (id, identifiant, auth_user_id, prenom, nom,
                            role, langue, fonction, actif)
  values (gen_random_uuid(), lower(btrim(p_identifiant)), p_auth_user_id,
          btrim(p_prenom), btrim(p_nom), v_role,
          nullif(btrim(coalesce(p_langue,'')), ''),
          nullif(btrim(coalesce(p_fonction,'')), ''), true)
  returning id into v_id;

  -- Le numero, dans sa table fermee. Absent : pas de ligne, plutot qu'une
  -- ligne vide qui laisserait croire a une saisie.
  if nullif(btrim(coalesce(p_telephone,'')), '') is not null then
    insert into public.personnel_contact (user_id, telephone)
    values (v_id, btrim(p_telephone))
    on conflict (user_id) do update
       set telephone = excluded.telephone, updated_at = now();
  end if;

  -- AUCUNE ecriture dans users_secrets. Le `plafond_salaire` qu'y posait
  -- `enregistrer_utilisateur` n'est lu nulle part dans l'application : les
  -- salaires viennent de `personnelRH`, dans app_state. C'etait une donnee
  -- morte, et `code_acces` etant NOT NULL, la conserver aurait oblige a
  -- inventer un faux secret pour un compte qui n'en a pas.
  --
  -- Consequence voulue : `users_secrets` ne contient plus QUE les anciens
  -- comptes. C'est ce qui rend fiable la detection `ancien_compte` de
  -- `lire_etat_acces_personnel`.

  insert into public.journal_audit
    (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
     auteur_id, auteur_nom, action)
  values
    ('users', v_id::text, null, null, format('role=%s', v_role),
     auth.uid(),
     coalesce((select u.prenom || ' ' || u.nom from public.users u
                where u.auth_user_id = auth.uid()), 'direction'),
     'creation_compte');

  select * into v_user from public.users where id = v_id;
  return to_jsonb(v_user);
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5 · ÉMISSION D'UN LIEN D'ACCÈS
-- ═══════════════════════════════════════════════════════════════════════
--
-- Aucun secret serveur requis : cette fonction est appelable directement
-- depuis le navigateur du directeur, avec sa session. Le token brut sort
-- UNE fois, dans le retour, pour composer le lien WhatsApp. Il n'est
-- stocke nulle part et n'apparait dans aucune fonction de lecture.

create or replace function public.emettre_acces_personnel(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_token   text;
  v_expire  timestamptz;
  v_ident   text;
  v_prenom  text;
  v_tel     text;
  v_auth    uuid;
begin
  if not public.ideal_est(array['directeur']) then
    raise exception 'reserve_a_la_direction'
      using errcode = '42501';
  end if;

  select u.identifiant, u.prenom, u.auth_user_id
    into v_ident, v_prenom, v_auth
    from public.users u
   where u.id = p_user_id and u.actif = true
     for update of u;

  -- Le verrou sur la fiche personnel serialise deux emissions rapprochees.
  -- Sans lui, deux doubles clics peuvent revoquer le meme ancien lien, puis
  -- tenter chacun un INSERT : le second heurte l'index vivant unique.

  if not found then
    raise exception 'compte_introuvable';
  end if;

  -- Un compte sans identite Auth ne peut pas recevoir de mot de passe.
  -- Mieux vaut le dire ici que laisser le membre buter sur la page.
  if v_auth is null then
    raise exception 'compte_sans_identite_auth'
      using detail = 'Ce compte n''a pas d''identite Auth : il date d''avant la Phase 2.';
  end if;

  select telephone into v_tel
    from public.personnel_contact where user_id = p_user_id;

  -- Le renvoi revoque : un lien deja parti cesse de fonctionner des qu'un
  -- nouveau est emis. Avant l'insert, sinon l'index partiel refuserait.
  update public.acces_personnel
     set revoked_at = now()
   where user_id = p_user_id
     and used_at is null
     and revoked_at is null;

  v_token  := encode(extensions.gen_random_bytes(32), 'hex');
  v_expire := now() + interval '48 hours';

  insert into public.acces_personnel (user_id, token_hash, expires_at)
  values (p_user_id,
          extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
          v_expire);

  insert into public.journal_audit
    (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
     auteur_id, auteur_nom, action)
  values
    ('acces_personnel', p_user_id::text, null, null, 'lien emis',
     auth.uid(),
     coalesce((select u.prenom || ' ' || u.nom from public.users u
                where u.auth_user_id = auth.uid()), 'direction'),
     'emission_acces');
  -- Aucun token, aucune empreinte dans l'audit. La trace dit QUE, pas QUOI.

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'identifiant', v_ident,
    'prenom', v_prenom,
    'telephone', v_tel,
    'expire_le', v_expire
  );
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6 · ÉTAT D'ACCÈS — statuts seuls, jamais d'empreinte
-- ═══════════════════════════════════════════════════════════════════════
--
-- `ancien_compte` existe pour ne pas mentir : un membre d'avant la Phase 2
-- se connecte parfaitement, mais n'a jamais recu de lien. L'afficher
-- « Acces non envoye » ferait croire a un compte inutilisable.

create or replace function public.lire_etat_acces_personnel()
returns table (
  user_id     uuid,
  statut      text,
  expire_le   timestamptz,
  telephone   text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select u.id,
         case
           when u.auth_user_id is null                          then 'sans_identite'
           when exists (select 1 from public.acces_personnel a
                         where a.user_id = u.id and a.used_at is not null)
                                                                then 'active'
           when exists (select 1 from public.acces_personnel a
                         where a.user_id = u.id and a.used_at is null
                           and a.revoked_at is null and a.expires_at > now())
                                                                then 'envoyee'
           when exists (select 1 from public.acces_personnel a
                         where a.user_id = u.id and a.used_at is null
                           and a.revoked_at is null and a.expires_at <= now())
                                                                then 'expiree'
           when exists (select 1 from public.users_secrets s
                         where s.user_id = u.id)                then 'ancien_compte'
           else 'non_envoye'
         end,
         (select max(a.expires_at) from public.acces_personnel a
           where a.user_id = u.id and a.used_at is null and a.revoked_at is null),
         (select c.telephone from public.personnel_contact c where c.user_id = u.id)
    from public.users u
   where public.ideal_est(array['directeur'])
     and u.actif = true;
$function$;
-- La garde est DANS le `where` : une fonction `sql` ne peut pas lever
-- d'exception. Un non-directeur recoit zero ligne, jamais une donnee.

-- ═══════════════════════════════════════════════════════════════════════
-- 7 · CONSOMMATION D'UN LIEN — réservée à la clé serveur
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ni anon ni authenticated ne l'atteignent : seule la fonction Vercel, qui
-- porte la cle serveur, peut l'appeler. AUCUNE fonction touchant
-- l'authentification n'est donc joignable depuis un navigateur.
--
-- L'UPDATE conditionnel avec RETURNING est atomique : deux requetes
-- simultanees portant le meme token, une seule gagne. Le rejeu est
-- impossible sans verrou explicite.

create or replace function public.consommer_acces_personnel(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_user_id uuid;
  v_auth_id uuid;
begin
  -- Reponse neutre des la forme : aucune requete n'est emise pour un
  -- token malforme, donc aucun cout et aucun signal temporel.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false);
  end if;

  update public.acces_personnel a
     set used_at = now()
   where a.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
     and a.used_at    is null
     and a.revoked_at is null
     and a.expires_at > now()
  returning a.user_id into v_user_id;

  if v_user_id is null then
    -- Inconnu, expire, deja consomme, revoque : meme reponse.
    return jsonb_build_object('ok', false);
  end if;

  select u.auth_user_id into v_auth_id
    from public.users u where u.id = v_user_id and u.actif = true;

  if v_auth_id is null then
    return jsonb_build_object('ok', false);
  end if;

  insert into public.journal_audit
    (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
     auteur_id, auteur_nom, action)
  values
    ('acces_personnel', v_user_id::text, null, null, 'lien consomme',
     null, 'membre du personnel', 'activation_acces');

  return jsonb_build_object('ok', true, 'auth_user_id', v_auth_id);
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 8 · PRIVILÈGES
-- ═══════════════════════════════════════════════════════════════════════
--
-- `revoke all … from public` d'abord : PostgreSQL accorde EXECUTE a PUBLIC
-- par defaut, et ce defaut est invisible dans pg_proc.proacl. Lecon de la
-- Phase 1.

revoke all on function public.identifiant_disponible(text,text)
  from public, anon, authenticated;
revoke all on function public.rattacher_membre_personnel(uuid,text,text,text,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.emettre_acces_personnel(uuid)
  from public, anon, authenticated;
revoke all on function public.lire_etat_acces_personnel()
  from public, anon, authenticated;
revoke all on function public.consommer_acces_personnel(text)
  from public, anon, authenticated;

-- Les quatre fonctions Direction : porte technique ouverte a tout compte
-- authentifie, tri effectue dans le corps par ideal_est(['directeur']).
grant execute on function public.identifiant_disponible(text,text)                to authenticated;
grant execute on function public.rattacher_membre_personnel(uuid,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.emettre_acces_personnel(uuid)                    to authenticated;
grant execute on function public.lire_etat_acces_personnel()                      to authenticated;

-- La consommation : cle serveur uniquement. Ni anon ni authenticated.
grant execute on function public.consommer_acces_personnel(text)                  to service_role;

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- Attendu apres COMMIT — recette : scripts/gardes/recette-acces-personnel.mjs
--   anon sur les cinq fonctions                    → 42501
--   enseignant authentifie sur les quatre Direction → reserve_a_la_direction
--   enseignant sur consommer_acces_personnel        → 42501
--   directeur                                       → passe
-- ═══════════════════════════════════════════════════════════════════════
