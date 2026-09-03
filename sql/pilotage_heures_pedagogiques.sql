begin;

create table if not exists public.pilotage_heures_pedagogiques (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references public.classes(id) on delete cascade,
  matiere text not null,
  langue text not null check (langue in ('fr','en')),
  heures_hebdo numeric(5,2) not null check (heures_hebdo >= 0),
  semaines_t1 smallint not null default 12 check (semaines_t1 between 0 and 20),
  semaines_t2 smallint not null default 12 check (semaines_t2 between 0 and 20),
  semaines_t3 smallint not null default 12 check (semaines_t3 between 0 and 20),
  updated_by uuid not null references public.users(id),
  updated_at timestamptz not null default now(),
  unique (classe_id, matiere, langue)
);
alter table public.pilotage_heures_pedagogiques enable row level security;
revoke all on table public.pilotage_heures_pedagogiques from public, anon, authenticated;

create or replace function public.lire_pilotage_heures_pedagogiques()
returns table (classe_id uuid, classe_nom text, matiere text, langue text, heures_hebdo numeric, semaines_t1 smallint, semaines_t2 smallint, semaines_t3 smallint)
language sql security definer set search_path=public,pg_temp
as $$
  select h.classe_id,c.nom,h.matiere,h.langue,h.heures_hebdo,h.semaines_t1,h.semaines_t2,h.semaines_t3
  from public.pilotage_heures_pedagogiques h join public.classes c on c.id=h.classe_id
  where exists (select 1 from public.users u where u.auth_user_id=auth.uid() and u.actif=true)
  order by c.ordre,h.langue,h.matiere
$$;

create or replace function public.sauver_pilotage_heures_pedagogiques(p_lignes jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_moi public.users%rowtype; v_ligne jsonb; v_nombre integer:=0;
begin
  select * into v_moi from public.users where auth_user_id=auth.uid() and actif=true limit 1;
  if v_moi.role <> 'directeur' then raise exception 'direction_requise' using errcode='42501'; end if;
  for v_ligne in select value from jsonb_array_elements(coalesce(p_lignes,'[]')) loop
    insert into public.pilotage_heures_pedagogiques(classe_id,matiere,langue,heures_hebdo,semaines_t1,semaines_t2,semaines_t3,updated_by)
    values((v_ligne->>'classe_id')::uuid,btrim(v_ligne->>'matiere'),v_ligne->>'langue',(v_ligne->>'heures_hebdo')::numeric,(v_ligne->>'semaines_t1')::smallint,(v_ligne->>'semaines_t2')::smallint,(v_ligne->>'semaines_t3')::smallint,v_moi.id)
    on conflict(classe_id,matiere,langue) do update set heures_hebdo=excluded.heures_hebdo,semaines_t1=excluded.semaines_t1,semaines_t2=excluded.semaines_t2,semaines_t3=excluded.semaines_t3,updated_by=v_moi.id,updated_at=now();
    v_nombre:=v_nombre+1;
  end loop;
  return v_nombre;
end $$;

revoke all on function public.lire_pilotage_heures_pedagogiques() from public,anon;
revoke all on function public.sauver_pilotage_heures_pedagogiques(jsonb) from public,anon;
grant execute on function public.lire_pilotage_heures_pedagogiques() to authenticated;
grant execute on function public.sauver_pilotage_heures_pedagogiques(jsonb) to authenticated;
commit;
