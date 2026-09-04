-- ═══════════════════════════════════════════════════════════════════════
-- ACCES PERSONNEL · REEMISSION ATOMIQUE
-- ═════════════════════════════════════════════════════════════════════
--
-- Un double appui pouvait lancer deux transactions concurrentes. Les deux
-- revoquaient le meme ancien lien ; la seconde insertion heurtait ensuite
-- `acces_personnel_vivant_unique`. Le verrou de ligne sur `users` serialise
-- maintenant l'emission pour un membre donne.
--
-- Aucune donnee n'est supprimee et aucun lien existant n'est modifie pendant
-- l'installation. La regle prend effet au prochain clic.

begin;

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

  if not found then
    raise exception 'compte_introuvable';
  end if;

  if v_auth is null then
    raise exception 'compte_sans_identite_auth'
      using detail = 'Ce compte n''a pas d''identite Auth : il date d''avant la Phase 2.';
  end if;

  select telephone into v_tel
    from public.personnel_contact where user_id = p_user_id;

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

revoke all on function public.emettre_acces_personnel(uuid)
  from public, anon, authenticated;
grant execute on function public.emettre_acces_personnel(uuid)
  to authenticated;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.emettre_acces_personnel(uuid)'::regprocedure)
    into v_definition;
  if position('for update of u' in lower(v_definition)) = 0 then
    raise exception 'Verrou de reemission non installe';
  end if;
end $$;

commit;

select
  position(
    'for update of u' in
    lower(pg_get_functiondef('public.emettre_acces_personnel(uuid)'::regprocedure))
  ) > 0 as reemission_serialisee;
