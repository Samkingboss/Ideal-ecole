begin;

-- Fiche de partenariat famille-ecole du bulletin maternelle.
-- Les faits de ponctualite restent calcules depuis presences_eleves : ils ne
-- sont jamais recopies ni modifies ici. Cette table ne porte que les constats
-- encadres, le contexte et les actions convenues pendant le dialogue.
create table if not exists public.maternelle_suivis_famille (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id) on delete cascade,
  trimestre text not null check (trimestre in ('t1','t2','t3')),
  annee_scolaire text not null,
  donnees jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maternelle_suivis_famille_unique
    unique (eleve_id, trimestre, annee_scolaire)
);

alter table public.maternelle_suivis_famille enable row level security;
revoke all on table public.maternelle_suivis_famille from public, anon, authenticated;

create or replace function public.lire_suivis_famille_maternelle(
  p_eleve_ids uuid[], p_trimestre text, p_annee_scolaire text
) returns table (
  eleve_id uuid,
  donnees jsonb,
  updated_at timestamptz,
  jours_pointes integer,
  arrivees_a_l_heure integer,
  departs_renseignes integer,
  retraits_a_l_heure integer,
  absences integer,
  absences_signalees integer
)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_moi public.users%rowtype;
  v_annee text := replace(coalesce(p_annee_scolaire,''),' ','');
  v_debut date;
  v_fin date;
  v_annee_debut integer;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'authentification_requise' using errcode='42501'; end if;
  if p_trimestre not in ('t1','t2','t3') then raise exception 'trimestre_invalide'; end if;
  if nullif(v_annee,'') is null then raise exception 'annee_scolaire_requise'; end if;

  select min(p.date_debut), max(p.date_fin) into v_debut,v_fin
    from public.periodes p
   where replace(p.annee_scolaire,' ','')=v_annee
     and p.ordre = any(case p_trimestre when 't1' then array[1,2]
                                           when 't2' then array[3,4]
                                           else array[5] end);
  if v_debut is null or v_fin is null then
    v_annee_debut := split_part(v_annee,'-',1)::integer;
    if p_trimestre='t1' then v_debut:=make_date(v_annee_debut,9,1); v_fin:=make_date(v_annee_debut,12,31);
    elsif p_trimestre='t2' then v_debut:=make_date(v_annee_debut+1,1,1); v_fin:=make_date(v_annee_debut+1,4,30);
    else v_debut:=make_date(v_annee_debut+1,5,1); v_fin:=make_date(v_annee_debut+1,7,31);
    end if;
  end if;

  return query
  select e.id,
         case when v_moi.role in ('directeur','responsable_administratif')
              then coalesce(s.donnees,'{}'::jsonb)
              else coalesce(s.donnees,'{}'::jsonb)-array['scolarite_statut','scolarite_observation']
          end,
         s.updated_at,
         coalesce(p.jours_pointes,0)::integer,
         coalesce(p.arrivees_a_l_heure,0)::integer,
         coalesce(p.departs_renseignes,0)::integer,
         coalesce(p.retraits_a_l_heure,0)::integer,
         coalesce(p.absences,0)::integer,
         coalesce(p.absences_signalees,0)::integer
    from public.eleves e
    join public.classes c on c.id=e.classe_id
    left join public.maternelle_suivis_famille s
      on s.eleve_id=e.id and s.trimestre=p_trimestre
     and replace(s.annee_scolaire,' ','')=v_annee
    left join lateral (
      select count(*) as jours_pointes,
             count(*) filter (
               where pe.statut<>'absent'
                 and coalesce(pe.minutes_retard,0)=0
                 and coalesce(pe.retard_matin,0)=0
             ) as arrivees_a_l_heure,
             count(*) filter (where pe.heure_depart is not null) as departs_renseignes,
             count(*) filter (
               where pe.heure_depart is not null and coalesce(pe.retard_soir,0)=0
             ) as retraits_a_l_heure,
             count(*) filter (where pe.statut='absent') as absences,
             count(*) filter (
               where pe.statut='absent' and nullif(btrim(coalesce(pe.justification,'')),'') is not null
             ) as absences_signalees
        from public.presences_eleves pe
       where pe.eleve_id=e.id and pe.date_jour between v_debut and v_fin
    ) p on true
   where e.id=any(coalesce(p_eleve_ids,'{}'::uuid[]))
     and e.actif=true
     and c.nom in ('PS','GS','Petite Section','Grande Section')
     and (v_moi.role in ('directeur','responsable_administratif') or exists (
       select 1 from public.prof_classes pc
        where pc.user_id=v_moi.id and pc.classe_id=e.classe_id
     ));
end $$;

create or replace function public.sauver_suivi_famille_maternelle(
  p_eleve_id uuid, p_trimestre text, p_annee_scolaire text, p_donnees jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_moi public.users%rowtype;
  v_classe uuid;
  v_autorise jsonb;
  v_existant jsonb;
  v_id uuid;
  v_statut text;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'authentification_requise' using errcode='42501'; end if;
  if p_trimestre not in ('t1','t2','t3') then raise exception 'trimestre_invalide'; end if;
  if nullif(btrim(p_annee_scolaire),'') is null then raise exception 'annee_scolaire_requise'; end if;
  if jsonb_typeof(coalesce(p_donnees,'{}'::jsonb))<>'object' then raise exception 'donnees_invalides'; end if;

  select e.classe_id into v_classe
    from public.eleves e join public.classes c on c.id=e.classe_id
   where e.id=p_eleve_id and e.actif=true
     and c.nom in ('PS','GS','Petite Section','Grande Section');
  if v_classe is null then raise exception 'eleve_maternelle_introuvable' using errcode='P0002'; end if;
  if v_moi.role not in ('directeur','responsable_administratif')
     and not exists (select 1 from public.prof_classes pc where pc.user_id=v_moi.id and pc.classe_id=v_classe)
  then raise exception 'classe_non_affectee' using errcode='42501'; end if;

  select coalesce(jsonb_object_agg(j.key,j.value),'{}'::jsonb) into v_autorise
    from jsonb_each(coalesce(p_donnees,'{}'::jsonb)) j
   where j.key=any(
     case when v_moi.role in ('directeur','responsable_administratif')
       then array['devoirs_statut','hygiene_statut','rencontres_statut','points_appui','a_accompagner','contexte','actions','droit_reponse','scolarite_statut','scolarite_observation']
       else array['devoirs_statut','hygiene_statut','rencontres_statut','points_appui','a_accompagner','contexte','actions','droit_reponse']
     end
   );

  foreach v_statut in array array['devoirs_statut','hygiene_statut','rencontres_statut','scolarite_statut'] loop
    if v_autorise ? v_statut and v_autorise->>v_statut not in ('regulier','a_consolider','accompagnement','non_applicable')
    then raise exception 'statut_invalide_%',v_statut; end if;
  end loop;
  if v_autorise ? 'actions' and jsonb_typeof(v_autorise->'actions')<>'array' then raise exception 'actions_invalides'; end if;
  if length(v_autorise::text)>12000 then raise exception 'suivi_trop_long'; end if;

  select s.donnees into v_existant from public.maternelle_suivis_famille s
   where s.eleve_id=p_eleve_id and s.trimestre=p_trimestre
     and replace(s.annee_scolaire,' ','')=replace(p_annee_scolaire,' ','')
   for update;
  v_autorise:=coalesce(v_existant,'{}'::jsonb)||coalesce(v_autorise,'{}'::jsonb)
    ||jsonb_build_object('updated_at',now(),'updated_by',v_moi.id);

  insert into public.maternelle_suivis_famille(eleve_id,trimestre,annee_scolaire,donnees,updated_by)
  values(p_eleve_id,p_trimestre,btrim(p_annee_scolaire),v_autorise,v_moi.id)
  on conflict(eleve_id,trimestre,annee_scolaire) do update
     set donnees=excluded.donnees,updated_by=v_moi.id,updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $$;

revoke all on function public.lire_suivis_famille_maternelle(uuid[],text,text) from public,anon;
revoke all on function public.sauver_suivi_famille_maternelle(uuid,text,text,jsonb) from public,anon;
grant execute on function public.lire_suivis_famille_maternelle(uuid[],text,text) to authenticated;
grant execute on function public.sauver_suivi_famille_maternelle(uuid,text,text,jsonb) to authenticated;

commit;

-- Controle attendu apres execution : true / true / false.
select
  to_regclass('public.maternelle_suivis_famille') is not null as table_installee,
  to_regprocedure('public.lire_suivis_famille_maternelle(uuid[],text,text)') is not null as lecture_installee,
  has_table_privilege('anon','public.maternelle_suivis_famille','select') as anon_peut_lire;
