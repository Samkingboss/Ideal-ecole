-- ═══════════════════════════════════════════════════════════════════════
-- SEXE DÉCLARÉ DU PERSONNEL ET ACCORD DES FONCTIONS
--
-- Source unique : public.users.sexe (`F` ou `M`).
-- Propriétaire : Direction.
-- Consommateurs : interfaces, signatures, préparations, devoirs et rapports.
--
-- La valeur n'est jamais déduite du prénom. Les corrections passent par une
-- RPC Direction et sont écrites dans journal_audit.
-- ═══════════════════════════════════════════════════════════════════════

begin;

alter table public.users
  add column if not exists sexe text;

do $bloc$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'users'
       and c.conname = 'users_sexe_check'
  ) then
    alter table public.users
      add constraint users_sexe_check
      check (sexe is null or sexe in ('F', 'M'));
  end if;
end;
$bloc$;

comment on column public.users.sexe is
  'Sexe déclaré du membre (F/M), utilisé pour l accord grammatical des fonctions. Jamais déduit du prénom.';

-- Nouvelle surcharge atomique pour les créations réalisées après cette
-- migration. L'ancienne signature à huit paramètres reste disponible pour
-- les clients déjà déployés pendant la transition ; la nouvelle route envoie
-- obligatoirement p_sexe et choisit donc cette signature à neuf paramètres.
create or replace function public.rattacher_membre_personnel(
  p_auth_user_id uuid,
  p_identifiant  text,
  p_prenom       text,
  p_nom          text,
  p_role         text,
  p_langue       text,
  p_fonction     text,
  p_telephone    text,
  p_sexe         text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_sexe   text;
  v_profil jsonb;
  v_id     uuid;
begin
  if not public.ideal_est(array['directeur']) then
    raise exception 'reserve_a_la_direction'
      using errcode = '42501',
            detail  = 'Seule la direction peut créer un compte du personnel.';
  end if;

  v_sexe := upper(nullif(btrim(coalesce(p_sexe, '')), ''));
  if v_sexe is null or v_sexe not in ('F', 'M') then
    raise exception 'sexe_invalide'
      using errcode = '22023',
            detail  = 'Le sexe du membre doit être F ou M.';
  end if;

  -- La fonction historique conserve toutes ses validations, la création de
  -- l'identité métier, le contact et sa première trace d'audit.
  v_profil := public.rattacher_membre_personnel(
    p_auth_user_id, p_identifiant, p_prenom, p_nom, p_role,
    p_langue, p_fonction, p_telephone
  );
  v_id := (v_profil ->> 'id')::uuid;

  update public.users
     set sexe = v_sexe
   where id = v_id;

  insert into public.journal_audit
    (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
     auteur_id, auteur_nom, action)
  values
    ('users', v_id::text, 'sexe', null, v_sexe,
     auth.uid(),
     coalesce((select u.prenom || ' ' || u.nom
                 from public.users u
                where u.auth_user_id = auth.uid()), 'direction'),
     'precision_sexe_personnel');

  select to_jsonb(u) into v_profil
    from public.users u
   where u.id = v_id;

  return v_profil;
end;
$function$;

-- Mise à jour des fiches existantes. L'identité et le poste restent intacts :
-- seule la donnée d'accord grammatical change.
create or replace function public.modifier_sexe_personnel(
  p_user_id uuid,
  p_sexe    text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_ancien text;
  v_sexe   text;
  v_profil jsonb;
begin
  if not public.ideal_est(array['directeur']) then
    raise exception 'reserve_a_la_direction'
      using errcode = '42501',
            detail  = 'Seule la direction peut préciser le sexe du personnel.';
  end if;

  if p_user_id is null then
    raise exception 'personnel_manquant' using errcode = '22023';
  end if;

  v_sexe := upper(nullif(btrim(coalesce(p_sexe, '')), ''));
  if v_sexe is null or v_sexe not in ('F', 'M') then
    raise exception 'sexe_invalide'
      using errcode = '22023',
            detail  = 'Le sexe du membre doit être F ou M.';
  end if;

  select u.sexe into v_ancien
    from public.users u
   where u.id = p_user_id
   for update;

  if not found then
    raise exception 'personnel_introuvable' using errcode = 'P0002';
  end if;

  if v_ancien is distinct from v_sexe then
    update public.users
       set sexe = v_sexe
     where id = p_user_id;

    insert into public.journal_audit
      (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
       auteur_id, auteur_nom, action)
    values
      ('users', p_user_id::text, 'sexe', v_ancien, v_sexe,
       auth.uid(),
       coalesce((select u.prenom || ' ' || u.nom
                   from public.users u
                  where u.auth_user_id = auth.uid()), 'direction'),
       'modification_sexe_personnel');
  end if;

  select to_jsonb(u) into v_profil
    from public.users u
   where u.id = p_user_id;

  return v_profil;
end;
$function$;

revoke all on function public.rattacher_membre_personnel(uuid,text,text,text,text,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.modifier_sexe_personnel(uuid,text)
  from public, anon, authenticated;

grant execute on function public.rattacher_membre_personnel(uuid,text,text,text,text,text,text,text,text)
  to authenticated;
grant execute on function public.modifier_sexe_personnel(uuid,text)
  to authenticated;

commit;

-- Attendu : « Success. No rows returned. »

