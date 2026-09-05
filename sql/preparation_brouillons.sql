-- Brouillon persistant des fiches de preparation.
-- Cette table est strictement separee des preparations officiellement soumises.

begin;

create table if not exists public.preparation_brouillons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date_cours date not null,
  creneau_cle text not null check (length(creneau_cle) between 5 and 300),
  contenu jsonb not null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  unique (user_id, date_cours, creneau_cle)
);

comment on table public.preparation_brouillons is
  'Brouillons enseignants non soumis. Aucune notification ni preparation officielle n''est creee ici.';

revoke all on public.preparation_brouillons from public, anon, authenticated;
alter table public.preparation_brouillons enable row level security;

create or replace function public.lire_brouillon_preparation(p_date_cours date, p_creneau_cle text)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_prof public.users; v_brouillon public.preparation_brouillons;
begin
  select u.* into v_prof from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_prof.id is null then raise exception 'session_non_authentifiee' using errcode = '28000'; end if;
  if v_prof.role not in ('professeur','directeur','responsable_administratif') then raise exception 'brouillon_reserve_professeur' using errcode = '42501'; end if;

  select b.* into v_brouillon from public.preparation_brouillons b
   where b.user_id = v_prof.id and b.date_cours = p_date_cours
     and b.creneau_cle = p_creneau_cle;
  if v_brouillon.id is null then return null; end if;
  return jsonb_build_object('contenu', v_brouillon.contenu, 'version', v_brouillon.version,
                            'updated_at', v_brouillon.updated_at);
end
$function$;

create or replace function public.sauver_brouillon_preparation(
  p_date_cours date, p_creneau_cle text, p_contenu jsonb,
  p_version_attendue bigint default null
)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_prof public.users; v_brouillon public.preparation_brouillons;
begin
  select u.* into v_prof from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_prof.id is null then raise exception 'session_non_authentifiee' using errcode = '28000'; end if;
  if v_prof.role not in ('professeur','directeur','responsable_administratif') then raise exception 'brouillon_reserve_professeur' using errcode = '42501'; end if;
  if p_date_cours is null or p_creneau_cle is null or length(p_creneau_cle) not between 5 and 300 then
    raise exception 'cle_brouillon_invalide' using errcode = '22023';
  end if;
  if p_contenu is null or jsonb_typeof(p_contenu) <> 'object' then
    raise exception 'contenu_brouillon_invalide' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_prof.id::text || ':' || p_date_cours::text || ':' || p_creneau_cle, 0));
  select b.* into v_brouillon from public.preparation_brouillons b
   where b.user_id = v_prof.id and b.date_cours = p_date_cours
     and b.creneau_cle = p_creneau_cle for update;

  if v_brouillon.id is null then
    if p_version_attendue is not null then
      return jsonb_build_object('conflit', true, 'version', null, 'contenu', null);
    end if;
    insert into public.preparation_brouillons (user_id, date_cours, creneau_cle, contenu)
    values (v_prof.id, p_date_cours, p_creneau_cle, p_contenu)
    returning * into v_brouillon;
  else
    if p_version_attendue is null or p_version_attendue <> v_brouillon.version then
      return jsonb_build_object('conflit', true, 'version', v_brouillon.version,
                                'updated_at', v_brouillon.updated_at, 'contenu', v_brouillon.contenu);
    end if;
    update public.preparation_brouillons
       set contenu = p_contenu, version = version + 1, updated_at = now()
     where id = v_brouillon.id returning * into v_brouillon;
  end if;

  return jsonb_build_object('conflit', false, 'version', v_brouillon.version,
                            'updated_at', v_brouillon.updated_at);
end
$function$;

create or replace function public.supprimer_brouillon_preparation(p_date_cours date, p_creneau_cle text)
returns boolean language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_prof public.users; v_nombre integer;
begin
  select u.* into v_prof from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_prof.id is null then raise exception 'session_non_authentifiee' using errcode = '28000'; end if;
  if v_prof.role not in ('professeur','directeur','responsable_administratif') then raise exception 'brouillon_reserve_professeur' using errcode = '42501'; end if;
  delete from public.preparation_brouillons b
   where b.user_id = v_prof.id and b.date_cours = p_date_cours
     and b.creneau_cle = p_creneau_cle;
  get diagnostics v_nombre = row_count;
  return v_nombre > 0;
end
$function$;

revoke all on function public.lire_brouillon_preparation(date, text) from public, anon;
revoke all on function public.sauver_brouillon_preparation(date, text, jsonb, bigint) from public, anon;
revoke all on function public.supprimer_brouillon_preparation(date, text) from public, anon;
grant execute on function public.lire_brouillon_preparation(date, text) to authenticated;
grant execute on function public.sauver_brouillon_preparation(date, text, jsonb, bigint) to authenticated;
grant execute on function public.supprimer_brouillon_preparation(date, text) to authenticated;

commit;
