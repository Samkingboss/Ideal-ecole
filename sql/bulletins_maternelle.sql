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
declare
  v_moi public.users%rowtype;
  v_classe uuid;
  v_langue text;
  v_contribution jsonb;
  v_id uuid;
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

  -- Une maîtresse ne remplace jamais le travail de l'autre : le serveur
  -- détermine sa langue depuis son profil authentifié et ne remplace que sa
  -- propre contribution dans le bulletin commun de l'élève.
  v_langue := case
    when v_moi.langue = 'en' or coalesce(v_moi.fonction,'') like '%-en-%' then 'en'
    else 'fr'
  end;
  v_contribution := coalesce(p_donnees,'{}'::jsonb)
    || jsonb_build_object('updated_by',v_moi.id,'updated_at',now());

  insert into public.maternelle_bulletins(eleve_id,trimestre,annee_scolaire,donnees,updated_by)
  values(
    p_eleve_id,p_trimestre,btrim(p_annee_scolaire),
    jsonb_build_object('contributions',jsonb_build_object(v_langue,v_contribution),'statut','brouillon'),
    v_moi.id
  )
  on conflict(eleve_id,trimestre,annee_scolaire) do update
    set donnees=jsonb_set(
          coalesce(maternelle_bulletins.donnees,'{}'::jsonb),
          '{contributions}',
          coalesce(maternelle_bulletins.donnees->'contributions','{}'::jsonb)
            || jsonb_build_object(v_langue,v_contribution),
          true
        ),
        updated_by=v_moi.id,
        updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end; $$;

create or replace function public.soumettre_bulletin_maternelle(
  p_eleve_id uuid, p_trimestre text, p_annee_scolaire text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_moi public.users%rowtype;
  v_section text;
  v_langue text;
  v_donnees jsonb;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'authentification_requise' using errcode='42501'; end if;
  select case when c.nom in ('PS','Petite Section') then 'PS' else 'GS' end
    into v_section
    from public.eleves e join public.classes c on c.id=e.classe_id
   where e.id=p_eleve_id and e.actif=true
     and c.nom in ('PS','GS','Petite Section','Grande Section');
  if v_section is null then raise exception 'eleve_maternelle_introuvable' using errcode='P0002'; end if;
  if p_trimestre not in ('t1','t2','t3') then raise exception 'trimestre_invalide'; end if;
  if not exists (
    select 1 from public.eleves e join public.prof_classes pc on pc.classe_id=e.classe_id
     where e.id=p_eleve_id and pc.user_id=v_moi.id
  ) then raise exception 'classe_non_affectee' using errcode='42501'; end if;
  v_langue := case when v_moi.langue='en' or coalesce(v_moi.fonction,'') like '%-en-%' then 'en' else 'fr' end;
  if not ((v_section='GS' and v_langue='fr') or (v_section='PS' and v_langue='en')) then
    raise exception 'titulaire_requise' using errcode='42501';
  end if;
  select b.donnees into v_donnees from public.maternelle_bulletins b
   where b.eleve_id=p_eleve_id and b.trimestre=p_trimestre and b.annee_scolaire=btrim(p_annee_scolaire)
   for update;
  if v_donnees is null then raise exception 'bulletin_introuvable' using errcode='P0002'; end if;
  if jsonb_object_length(coalesce(v_donnees->'contributions'->'fr'->'evaluations','{}'::jsonb))=0
     or jsonb_object_length(coalesce(v_donnees->'contributions'->'en'->'evaluations','{}'::jsonb))=0 then
    raise exception 'contributions_fr_et_en_requises';
  end if;
  update public.maternelle_bulletins
     set donnees=v_donnees || jsonb_build_object('statut','soumis_direction','soumis_par',v_moi.id,'soumis_le',now()),
         updated_by=v_moi.id, updated_at=now()
   where eleve_id=p_eleve_id and trimestre=p_trimestre and annee_scolaire=btrim(p_annee_scolaire);
  return jsonb_build_object('ok',true,'statut','soumis_direction');
end; $$;

revoke all on function public.lire_bulletins_maternelle(uuid[]) from public, anon;
revoke all on function public.sauver_bulletin_maternelle(uuid,text,text,jsonb) from public, anon;
revoke all on function public.soumettre_bulletin_maternelle(uuid,text,text) from public, anon;
grant execute on function public.lire_bulletins_maternelle(uuid[]) to authenticated;
grant execute on function public.sauver_bulletin_maternelle(uuid,text,text,jsonb) to authenticated;
grant execute on function public.soumettre_bulletin_maternelle(uuid,text,text) to authenticated;

commit;
