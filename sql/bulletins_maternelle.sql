begin;

create table if not exists public.maternelle_bulletins (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  trimestre text not null check (trimestre in ('t1','t2','t3')),
  annee_scolaire text not null,
  donnees jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maternelle_bulletins_eleve_periode_unique unique (eleve_id, trimestre, annee_scolaire)
);

alter table public.maternelle_bulletins enable row level security;
revoke all on table public.maternelle_bulletins from public, anon, authenticated;

create or replace function public.lire_bulletins_maternelle(p_eleve_ids uuid[])
returns table (eleve_id uuid, trimestre text, annee_scolaire text, donnees jsonb, updated_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_moi public.users%rowtype;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_moi.id is null then raise exception 'authentification_requise' using errcode='42501'; end if;
  return query
  select b.eleve_id,b.trimestre,b.annee_scolaire,b.donnees,b.updated_at
    from public.maternelle_bulletins b
    join public.eleves e on e.id=b.eleve_id
   where b.eleve_id=any(coalesce(p_eleve_ids,'{}'::uuid[]))
     and (v_moi.role in ('directeur','responsable_administratif')
       or exists (select 1 from public.prof_classes pc where pc.user_id=v_moi.id and pc.classe_id=e.classe_id));
end; $$;

create or replace function public.sauver_bulletin_maternelle(
  p_eleve_id uuid, p_trimestre text, p_annee_scolaire text, p_donnees jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_moi public.users%rowtype; v_classe uuid; v_id uuid;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_moi.id is null then raise exception 'authentification_requise' using errcode='42501'; end if;
  if p_trimestre not in ('t1','t2','t3') then raise exception 'trimestre_invalide'; end if;
  if nullif(btrim(p_annee_scolaire),'') is null then raise exception 'annee_scolaire_requise'; end if;
  select e.classe_id into v_classe from public.eleves e
   join public.classes c on c.id=e.classe_id
   where e.id=p_eleve_id and e.actif=true and c.nom in ('PS','GS','Petite Section','Grande Section');
  if v_classe is null then raise exception 'eleve_maternelle_introuvable' using errcode='P0002'; end if;
  if v_moi.role not in ('directeur','responsable_administratif')
     and not exists (select 1 from public.prof_classes pc where pc.user_id=v_moi.id and pc.classe_id=v_classe)
  then raise exception 'classe_non_affectee' using errcode='42501'; end if;
  insert into public.maternelle_bulletins(eleve_id,trimestre,annee_scolaire,donnees,updated_by)
  values(p_eleve_id,p_trimestre,btrim(p_annee_scolaire),coalesce(p_donnees,'{}'::jsonb),v_moi.id)
  on conflict(eleve_id,trimestre,annee_scolaire) do update
    set donnees=excluded.donnees,updated_by=v_moi.id,updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end; $$;

revoke all on function public.lire_bulletins_maternelle(uuid[]) from public, anon;
revoke all on function public.sauver_bulletin_maternelle(uuid,text,text,jsonb) from public, anon;
grant execute on function public.lire_bulletins_maternelle(uuid[]) to authenticated;
grant execute on function public.sauver_bulletin_maternelle(uuid,text,text,jsonb) to authenticated;

commit;
