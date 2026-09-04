-- Espace Relations familles & Vie scolaire.
--
-- Principes :
--   * l'identité, la classe, la naissance et les présences restent lues dans
--     leurs sources officielles (`eleves`, `classes`, `presences_eleves`) ;
--   * seules les informations nouvelles vivent ici : prospects, relances,
--     décisions d'anniversaire et visites ;
--   * la conseillère de vie scolaire écrit, la Direction contrôle, personne
--     d'autre n'accède aux tables ;
--   * aucune suppression n'est exposée : l'historique reste traçable.
begin;

create table if not exists public.prospects_familles (
  id uuid primary key default gen_random_uuid(),
  nom_parent text not null check (length(trim(nom_parent)) between 2 and 160),
  telephone text not null check (length(trim(telephone)) between 5 and 40),
  nombre_enfants integer not null default 1 check (nombre_enfants between 1 and 20),
  besoin text,
  statut text not null default 'nouveau'
    check (statut in ('nouveau','a_relancer','rendez_vous','inscrit','sans_suite')),
  prochaine_relance date,
  notes text,
  created_by uuid not null references public.users(id),
  updated_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospects_classes (
  prospect_id uuid not null references public.prospects_familles(id) on delete cascade,
  classe_id uuid not null references public.classes(id),
  primary key (prospect_id, classe_id)
);

create table if not exists public.relances_familles (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects_familles(id),
  eleve_id uuid references public.eleves(id),
  responsable_contacte text not null check (length(trim(responsable_contacte)) between 2 and 160),
  telephone text,
  date_contact timestamptz not null default now(),
  motif text not null check (length(trim(motif)) between 2 and 200),
  resultat text not null
    check (resultat in ('joint','sans_reponse','a_rappeler','message_envoye','rendez_vous')),
  resume text,
  prochaine_action text,
  date_suivi date,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(prospect_id, eleve_id) = 1)
);

create table if not exists public.visites_accueil (
  id uuid primary key default gen_random_uuid(),
  visiteur_nom text not null check (length(trim(visiteur_nom)) between 2 and 160),
  telephone text,
  type_visite text not null
    check (type_visite in ('retrait_eleve','rendez_vous','livraison','autre')),
  eleve_id uuid references public.eleves(id),
  personne_recherchee text,
  motif text not null check (length(trim(motif)) between 2 and 240),
  arrivee_at timestamptz not null default now(),
  depart_at timestamptz,
  notes text,
  created_by uuid not null references public.users(id),
  closed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (depart_at is null or depart_at >= arrivee_at),
  check (type_visite <> 'retrait_eleve' or eleve_id is not null)
);

create table if not exists public.suivis_anniversaires (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.eleves(id),
  annee_scolaire text not null check (annee_scolaire ~ '^[0-9]{4}-[0-9]{4}$'),
  statut text not null default 'a_contacter'
    check (statut in ('a_contacter','parent_contacte','a_confirmer','confirme_ecole','non_celebre','annule','celebre')),
  notes text,
  contacte_at timestamptz,
  updated_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (eleve_id, annee_scolaire)
);

create table if not exists public.relations_familles_audit (
  id bigint generated always as identity primary key,
  entite text not null,
  entite_id uuid not null,
  action text not null,
  avant jsonb,
  apres jsonb,
  auteur_id uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists prospects_familles_relance_idx
  on public.prospects_familles (prochaine_relance, statut);
create index if not exists relances_familles_prospect_idx
  on public.relances_familles (prospect_id, date_contact desc);
create index if not exists relances_familles_eleve_idx
  on public.relances_familles (eleve_id, date_contact desc);
create index if not exists visites_accueil_arrivee_idx
  on public.visites_accueil (arrivee_at desc);
create index if not exists suivis_anniversaires_eleve_idx
  on public.suivis_anniversaires (eleve_id, annee_scolaire);

revoke all on public.prospects_familles, public.prospects_classes,
  public.relances_familles, public.visites_accueil,
  public.suivis_anniversaires, public.relations_familles_audit
  from public, anon, authenticated;
alter table public.prospects_familles enable row level security;
alter table public.prospects_classes enable row level security;
alter table public.relances_familles enable row level security;
alter table public.visites_accueil enable row level security;
alter table public.suivis_anniversaires enable row level security;
alter table public.relations_familles_audit enable row level security;

create or replace function public.lire_prospects_familles()
returns table (
  id uuid, nom_parent text, telephone text, nombre_enfants integer,
  besoin text, statut text, prochaine_relance date, notes text,
  classe_ids uuid[], classes_souhaitees text[], nombre_relances bigint,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path=public,pg_temp
as $function$
  select p.id, p.nom_parent, p.telephone, p.nombre_enfants, p.besoin,
         p.statut, p.prochaine_relance, p.notes,
         coalesce(array_agg(c.id order by c.nom) filter (where c.id is not null), '{}'::uuid[]),
         coalesce(array_agg(c.nom order by c.nom) filter (where c.id is not null), '{}'::text[]),
         (select count(*) from public.relances_familles r where r.prospect_id=p.id),
         p.created_at, p.updated_at
    from public.prospects_familles p
    left join public.prospects_classes pc on pc.prospect_id=p.id
    left join public.classes c on c.id=pc.classe_id
   where exists (
     select 1 from public.users u
      where u.auth_user_id=auth.uid() and u.actif=true
        and u.role in ('conseiller_vie_scolaire','directeur')
   )
   group by p.id
   order by
     case p.statut when 'a_relancer' then 0 when 'nouveau' then 1 when 'rendez_vous' then 2 else 3 end,
     p.prochaine_relance nulls last, p.updated_at desc;
$function$;

create or replace function public.sauver_prospect_famille(
  p_id uuid, p_nom_parent text, p_telephone text, p_nombre_enfants integer,
  p_classes uuid[], p_besoin text, p_statut text, p_prochaine_relance date, p_notes text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_moi public.users; v_id uuid; v_ancien public.prospects_familles;
  v_nouveau public.prospects_familles; v_attendu integer; v_trouve integer;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_moi.role <> 'conseiller_vie_scolaire' then raise exception 'relations_familles_reservees' using errcode='42501'; end if;
  if length(trim(coalesce(p_nom_parent,''))) not between 2 and 160
     or length(trim(coalesce(p_telephone,''))) not between 5 and 40
     or coalesce(p_nombre_enfants,0) not between 1 and 20
     or p_statut not in ('nouveau','a_relancer','rendez_vous','inscrit','sans_suite') then
    raise exception 'prospect_invalide' using errcode='22023';
  end if;

  v_attendu := cardinality(coalesce(p_classes,'{}'::uuid[]));
  select count(distinct c.id) into v_trouve from public.classes c
   where c.id=any(coalesce(p_classes,'{}'::uuid[]));
  if v_attendu <> v_trouve then raise exception 'classe_souhaitee_invalide' using errcode='22023'; end if;

  if p_id is null then
    insert into public.prospects_familles
      (nom_parent,telephone,nombre_enfants,besoin,statut,prochaine_relance,notes,created_by,updated_by)
    values
      (trim(p_nom_parent),trim(p_telephone),p_nombre_enfants,nullif(trim(coalesce(p_besoin,'')),''),
       p_statut,p_prochaine_relance,nullif(trim(coalesce(p_notes,'')),''),v_moi.id,v_moi.id)
    returning * into v_nouveau;
    v_id := v_nouveau.id;
    insert into public.relations_familles_audit(entite,entite_id,action,apres,auteur_id)
    values('prospect',v_id,'creation',to_jsonb(v_nouveau),v_moi.id);
  else
    select p.* into v_ancien from public.prospects_familles p where p.id=p_id for update;
    if v_ancien.id is null then raise exception 'prospect_introuvable' using errcode='P0002'; end if;
    update public.prospects_familles p set
      nom_parent=trim(p_nom_parent), telephone=trim(p_telephone), nombre_enfants=p_nombre_enfants,
      besoin=nullif(trim(coalesce(p_besoin,'')),''), statut=p_statut,
      prochaine_relance=p_prochaine_relance, notes=nullif(trim(coalesce(p_notes,'')),''),
      updated_by=v_moi.id, updated_at=now()
     where p.id=p_id returning * into v_nouveau;
    v_id := p_id;
    insert into public.relations_familles_audit(entite,entite_id,action,avant,apres,auteur_id)
    values('prospect',v_id,'modification',to_jsonb(v_ancien),to_jsonb(v_nouveau),v_moi.id);
  end if;

  delete from public.prospects_classes pc where pc.prospect_id=v_id;
  insert into public.prospects_classes(prospect_id,classe_id)
    select v_id,c.id from public.classes c
     where c.id=any(coalesce(p_classes,'{}'::uuid[]));
  return v_id;
end
$function$;

create or replace function public.lire_relances_familles()
returns table (
  id uuid, prospect_id uuid, eleve_id uuid, responsable_contacte text,
  telephone text, date_contact timestamptz, motif text, resultat text,
  resume text, prochaine_action text, date_suivi date,
  prospect_nom text, eleve_nom text, classe_nom text, created_at timestamptz
)
language sql stable security definer set search_path=public,pg_temp
as $function$
  select r.id,r.prospect_id,r.eleve_id,r.responsable_contacte,r.telephone,
         r.date_contact,r.motif,r.resultat,r.resume,r.prochaine_action,r.date_suivi,
         p.nom_parent,
         nullif(trim(coalesce(e.prenom,'')||' '||coalesce(e.nom,'')),''),
         c.nom,r.created_at
    from public.relances_familles r
    left join public.prospects_familles p on p.id=r.prospect_id
    left join public.eleves e on e.id=r.eleve_id
    left join public.classes c on c.id=e.classe_id
   where exists (
     select 1 from public.users u where u.auth_user_id=auth.uid() and u.actif=true
       and u.role in ('conseiller_vie_scolaire','directeur')
   )
   order by r.date_contact desc;
$function$;

create or replace function public.enregistrer_relance_famille(
  p_prospect_id uuid, p_eleve_id uuid, p_responsable_contacte text, p_telephone text,
  p_date_contact timestamptz, p_motif text, p_resultat text, p_resume text,
  p_prochaine_action text, p_date_suivi date
)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_moi public.users; v_id uuid; v_ligne public.relances_familles;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_moi.role <> 'conseiller_vie_scolaire' then raise exception 'relations_familles_reservees' using errcode='42501'; end if;
  if num_nonnulls(p_prospect_id,p_eleve_id) <> 1
     or length(trim(coalesce(p_responsable_contacte,''))) not between 2 and 160
     or length(trim(coalesce(p_motif,''))) not between 2 and 200
     or p_resultat not in ('joint','sans_reponse','a_rappeler','message_envoye','rendez_vous') then
    raise exception 'relance_invalide' using errcode='22023';
  end if;
  if p_prospect_id is not null and not exists(select 1 from public.prospects_familles p where p.id=p_prospect_id) then
    raise exception 'prospect_introuvable' using errcode='P0002';
  end if;
  if p_eleve_id is not null and not exists(select 1 from public.eleves e where e.id=p_eleve_id and e.actif=true) then
    raise exception 'eleve_introuvable' using errcode='P0002';
  end if;
  insert into public.relances_familles
    (prospect_id,eleve_id,responsable_contacte,telephone,date_contact,motif,resultat,resume,prochaine_action,date_suivi,created_by)
  values
    (p_prospect_id,p_eleve_id,trim(p_responsable_contacte),nullif(trim(coalesce(p_telephone,'')),''),
     coalesce(p_date_contact,now()),trim(p_motif),p_resultat,nullif(trim(coalesce(p_resume,'')),''),
     nullif(trim(coalesce(p_prochaine_action,'')),''),p_date_suivi,v_moi.id)
  returning * into v_ligne;
  v_id := v_ligne.id;
  insert into public.relations_familles_audit(entite,entite_id,action,apres,auteur_id)
  values('relance',v_id,'creation',to_jsonb(v_ligne),v_moi.id);
  return v_id;
end
$function$;

create or replace function public.lire_visites_accueil(p_debut timestamptz, p_fin timestamptz)
returns table (
  id uuid, visiteur_nom text, telephone text, type_visite text, eleve_id uuid,
  eleve_nom text, personne_recherchee text, motif text, arrivee_at timestamptz,
  depart_at timestamptz, notes text, created_at timestamptz
)
language sql stable security definer set search_path=public,pg_temp
as $function$
  select v.id,v.visiteur_nom,v.telephone,v.type_visite,v.eleve_id,
         nullif(trim(coalesce(e.prenom,'')||' '||coalesce(e.nom,'')),''),
         v.personne_recherchee,v.motif,v.arrivee_at,v.depart_at,v.notes,v.created_at
    from public.visites_accueil v
    left join public.eleves e on e.id=v.eleve_id
   where v.arrivee_at >= p_debut and v.arrivee_at < p_fin
     and exists (
       select 1 from public.users u where u.auth_user_id=auth.uid() and u.actif=true
         and u.role in ('conseiller_vie_scolaire','directeur')
     )
   order by v.arrivee_at desc;
$function$;

create or replace function public.enregistrer_visite_accueil(
  p_visiteur_nom text, p_telephone text, p_type_visite text, p_eleve_id uuid,
  p_personne_recherchee text, p_motif text, p_arrivee_at timestamptz, p_notes text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_moi public.users; v_ligne public.visites_accueil;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_moi.role <> 'conseiller_vie_scolaire' then raise exception 'relations_familles_reservees' using errcode='42501'; end if;
  if length(trim(coalesce(p_visiteur_nom,''))) not between 2 and 160
     or length(trim(coalesce(p_motif,''))) not between 2 and 240
     or p_type_visite not in ('retrait_eleve','rendez_vous','livraison','autre')
     or (p_type_visite='retrait_eleve' and p_eleve_id is null) then
    raise exception 'visite_invalide' using errcode='22023';
  end if;
  if p_eleve_id is not null and not exists(select 1 from public.eleves e where e.id=p_eleve_id and e.actif=true) then
    raise exception 'eleve_introuvable' using errcode='P0002';
  end if;
  insert into public.visites_accueil
    (visiteur_nom,telephone,type_visite,eleve_id,personne_recherchee,motif,arrivee_at,notes,created_by)
  values
    (trim(p_visiteur_nom),nullif(trim(coalesce(p_telephone,'')),''),p_type_visite,p_eleve_id,
     nullif(trim(coalesce(p_personne_recherchee,'')),''),trim(p_motif),coalesce(p_arrivee_at,now()),
     nullif(trim(coalesce(p_notes,'')),''),v_moi.id)
  returning * into v_ligne;
  insert into public.relations_familles_audit(entite,entite_id,action,apres,auteur_id)
  values('visite',v_ligne.id,'creation',to_jsonb(v_ligne),v_moi.id);
  return v_ligne.id;
end
$function$;

create or replace function public.clore_visite_accueil(p_id uuid, p_depart_at timestamptz, p_notes text)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_moi public.users; v_ancien public.visites_accueil; v_nouveau public.visites_accueil;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_moi.role <> 'conseiller_vie_scolaire' then raise exception 'relations_familles_reservees' using errcode='42501'; end if;
  select v.* into v_ancien from public.visites_accueil v where v.id=p_id for update;
  if v_ancien.id is null then raise exception 'visite_introuvable' using errcode='P0002'; end if;
  if v_ancien.depart_at is not null then return false; end if;
  if coalesce(p_depart_at,now()) < v_ancien.arrivee_at then raise exception 'depart_avant_arrivee' using errcode='22023'; end if;
  update public.visites_accueil v set depart_at=coalesce(p_depart_at,now()),
    notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),v.notes), closed_by=v_moi.id, updated_at=now()
   where v.id=p_id returning * into v_nouveau;
  insert into public.relations_familles_audit(entite,entite_id,action,avant,apres,auteur_id)
  values('visite',p_id,'depart',to_jsonb(v_ancien),to_jsonb(v_nouveau),v_moi.id);
  return true;
end
$function$;

create or replace function public.lire_suivis_anniversaires(p_annee_scolaire text)
returns table (id uuid, eleve_id uuid, annee_scolaire text, statut text, notes text, contacte_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path=public,pg_temp
as $function$
  select s.id,s.eleve_id,s.annee_scolaire,s.statut,s.notes,s.contacte_at,s.updated_at
    from public.suivis_anniversaires s
   where s.annee_scolaire=p_annee_scolaire
     and exists (
       select 1 from public.users u where u.auth_user_id=auth.uid() and u.actif=true
         and u.role in ('conseiller_vie_scolaire','directeur')
     );
$function$;

create or replace function public.sauver_suivi_anniversaire(
  p_eleve_id uuid, p_annee_scolaire text, p_statut text, p_notes text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_moi public.users; v_ancien public.suivis_anniversaires; v_nouveau public.suivis_anniversaires;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_moi.role <> 'conseiller_vie_scolaire' then raise exception 'relations_familles_reservees' using errcode='42501'; end if;
  if not exists(select 1 from public.eleves e where e.id=p_eleve_id and e.actif=true)
     or p_annee_scolaire !~ '^[0-9]{4}-[0-9]{4}$'
     or p_statut not in ('a_contacter','parent_contacte','a_confirmer','confirme_ecole','non_celebre','annule','celebre') then
    raise exception 'suivi_anniversaire_invalide' using errcode='22023';
  end if;
  select s.* into v_ancien from public.suivis_anniversaires s
   where s.eleve_id=p_eleve_id and s.annee_scolaire=p_annee_scolaire for update;
  insert into public.suivis_anniversaires(eleve_id,annee_scolaire,statut,notes,contacte_at,updated_by)
  values(p_eleve_id,p_annee_scolaire,p_statut,nullif(trim(coalesce(p_notes,'')),''),
         case when p_statut <> 'a_contacter' then now() end,v_moi.id)
  on conflict(eleve_id,annee_scolaire) do update set
    statut=excluded.statut, notes=excluded.notes,
    contacte_at=case when excluded.statut <> 'a_contacter'
      then coalesce(public.suivis_anniversaires.contacte_at,now())
      else public.suivis_anniversaires.contacte_at end,
    updated_by=v_moi.id, updated_at=now()
  returning * into v_nouveau;
  insert into public.relations_familles_audit(entite,entite_id,action,avant,apres,auteur_id)
  values('anniversaire',v_nouveau.id,case when v_ancien.id is null then 'creation' else 'modification' end,
         case when v_ancien.id is null then null else to_jsonb(v_ancien) end,to_jsonb(v_nouveau),v_moi.id);
  return v_nouveau.id;
end
$function$;

-- À l'ouverture du compte, crée une seule alerte J-3 par enfant et par année.
-- La naissance reste lue dans `eleves`; aucune copie de date n'est créée.
create or replace function public.traiter_rappels_anniversaires()
returns integer language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_moi public.users; r record; v_cle text; v_id text; v_notif jsonb;
  v_liste jsonb; v_reste jsonb; v_nombre integer := 0; v_annee integer;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_moi.role <> 'conseiller_vie_scolaire' then return 0; end if;
  v_annee := extract(year from (current_date + 3));
  v_cle := 'notifs_'||v_moi.id::text;
  for r in
    select e.id,e.prenom,e.nom from public.eleves e
     where e.actif=true and e.date_naissance is not null
       and to_char(e.date_naissance,'MM-DD')=to_char(current_date+3,'MM-DD')
       and not exists(
         select 1 from public.suivis_anniversaires s
          where s.eleve_id=e.id and s.annee_scolaire='2026-2027' and s.statut <> 'a_contacter'
       )
  loop
    v_id := 'anniversaire-'||v_annee::text||'-'||r.id::text;
    v_notif := jsonb_build_object(
      'id',v_id,'titre','Anniversaire à préparer',
      'message',trim(coalesce(r.prenom,'')||' '||coalesce(r.nom,''))||' fête son anniversaire dans 3 jours. Contactez la famille.',
      'date',now(),'lu',false,'type','anniversaire','tabTarget','anniversaires','ref',r.id::text
    );
    perform pg_advisory_xact_lock(hashtext('app_state:notifications:'||v_cle)::bigint);
    select a.value into v_liste from public.app_state a where a.app='notifications' and a.key=v_cle;
    if jsonb_typeof(coalesce(v_liste,'null'::jsonb)) is distinct from 'array' then v_liste := '[]'::jsonb; end if;
    if not exists(select 1 from jsonb_array_elements(v_liste) n where n->>'id'=v_id) then
      select coalesce(jsonb_agg(e),'[]'::jsonb) into v_reste
        from (select e from jsonb_array_elements(v_liste) e limit 49) q;
      insert into public.app_state(app,key,value,updated_at)
      values('notifications',v_cle,jsonb_build_array(v_notif)||v_reste,now())
      on conflict(app,key) do update set value=excluded.value,updated_at=excluded.updated_at;
      begin
        perform public.emettre_notification_push(array[v_moi.id::text],
          'Anniversaire à préparer',trim(coalesce(r.prenom,'')||' '||coalesce(r.nom,''))||' : contactez la famille dans les 3 jours.',
          '/?notificationTab=anniversaires&notificationRef='||r.id::text,'ideal-'||v_id);
      exception when others then null;
      end;
      v_nombre := v_nombre + 1;
    end if;
  end loop;
  return v_nombre;
end
$function$;

revoke all on function public.lire_prospects_familles() from public,anon;
revoke all on function public.sauver_prospect_famille(uuid,text,text,integer,uuid[],text,text,date,text) from public,anon;
revoke all on function public.lire_relances_familles() from public,anon;
revoke all on function public.enregistrer_relance_famille(uuid,uuid,text,text,timestamptz,text,text,text,text,date) from public,anon;
revoke all on function public.lire_visites_accueil(timestamptz,timestamptz) from public,anon;
revoke all on function public.enregistrer_visite_accueil(text,text,text,uuid,text,text,timestamptz,text) from public,anon;
revoke all on function public.clore_visite_accueil(uuid,timestamptz,text) from public,anon;
revoke all on function public.lire_suivis_anniversaires(text) from public,anon;
revoke all on function public.sauver_suivi_anniversaire(uuid,text,text,text) from public,anon;
revoke all on function public.traiter_rappels_anniversaires() from public,anon;

grant execute on function public.lire_prospects_familles() to authenticated;
grant execute on function public.sauver_prospect_famille(uuid,text,text,integer,uuid[],text,text,date,text) to authenticated;
grant execute on function public.lire_relances_familles() to authenticated;
grant execute on function public.enregistrer_relance_famille(uuid,uuid,text,text,timestamptz,text,text,text,text,date) to authenticated;
grant execute on function public.lire_visites_accueil(timestamptz,timestamptz) to authenticated;
grant execute on function public.enregistrer_visite_accueil(text,text,text,uuid,text,text,timestamptz,text) to authenticated;
grant execute on function public.clore_visite_accueil(uuid,timestamptz,text) to authenticated;
grant execute on function public.lire_suivis_anniversaires(text) to authenticated;
grant execute on function public.sauver_suivi_anniversaire(uuid,text,text,text) to authenticated;
grant execute on function public.traiter_rappels_anniversaires() to authenticated;

commit;
