-- Circuit d'accompagnement des préparations de maternelle.
--
-- Source pédagogique : public.preparations (aucune copie).
-- Source logistique   : public.materiels / demandes_materiel /
--                       mouvements_stock (aucun second stock).
-- Toutes les écritures passent par des RPC qui lisent l'auteur dans
-- auth.uid(). Le client ne choisit ni son identité ni son rôle.

begin;

create table if not exists public.maternelle_circuit_config (
  id boolean primary key default true check (id),
  points_preparation numeric(6,2) not null default 20 check (points_preparation >= 0),
  heures_points_pleins numeric(6,2) not null default 24 check (heures_points_pleins > 0),
  heures_minimum numeric(6,2) not null default 5 check (heures_minimum >= 0),
  points_contribution numeric(6,2) not null default 10 check (points_contribution >= 0),
  points_materiel_assistante numeric(6,2) not null default 10 check (points_materiel_assistante >= 0),
  points_surveillance numeric(6,2) not null default 10 check (points_surveillance >= 0),
  points_administration numeric(6,2) not null default 10 check (points_administration >= 0),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint maternelle_circuit_delais_coherents check (heures_points_pleins >= heures_minimum)
);

insert into public.maternelle_circuit_config(id) values (true)
on conflict (id) do nothing;

create table if not exists public.maternelle_contributions_assistantes (
  id uuid primary key default gen_random_uuid(),
  preparation_id uuid not null references public.preparations(id) on delete cascade,
  assistante_id uuid not null references public.users(id),
  comprehension text not null,
  role_propose text not null,
  apport_propose text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maternelle_contribution_unique unique(preparation_id, assistante_id),
  constraint maternelle_contribution_comprehension check (length(btrim(comprehension)) >= 5),
  constraint maternelle_contribution_role check (length(btrim(role_propose)) >= 5),
  constraint maternelle_contribution_apport check (length(btrim(apport_propose)) >= 5)
);

create table if not exists public.maternelle_materiel_circuit (
  id uuid primary key default gen_random_uuid(),
  preparation_id uuid not null references public.preparations(id) on delete cascade,
  assistante_id uuid not null references public.users(id),
  demande_materiel_id uuid references public.demandes_materiel(id) on delete set null,
  materiel_id uuid references public.materiels(id) on delete set null,
  libelle text not null,
  quantite integer not null default 1 check (quantite > 0),
  statut text not null default 'demande_assistante' check (statut in (
    'demande_assistante','escalade_administration','retour_surveillance',
    'livre_assistante','installe','non_fourni'
  )),
  demande_le timestamptz not null default now(),
  surveillant_id uuid references public.users(id),
  surveillant_le timestamptz,
  quantite_livree integer check (quantite_livree is null or quantite_livree >= 0),
  commentaire_surveillance text,
  administratif_id uuid references public.users(id),
  administratif_le timestamptz,
  decision_administration text check (decision_administration is null or decision_administration in ('fourni','commande','non_fourni')),
  commentaire_administration text,
  recu_assistante boolean,
  installe_assistante boolean,
  confirme_le timestamptz,
  commentaire_assistante text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maternelle_materiel_libelle check (length(btrim(libelle)) > 0),
  constraint maternelle_materiel_unique unique(preparation_id, assistante_id, libelle)
);

create table if not exists public.maternelle_circuit_evenements (
  id bigint generated always as identity primary key,
  preparation_id uuid references public.preparations(id) on delete cascade,
  materiel_circuit_id uuid references public.maternelle_materiel_circuit(id) on delete cascade,
  auteur_id uuid references public.users(id) on delete set null,
  auteur_role text not null,
  evenement text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mat_contributions_preparation_idx
  on public.maternelle_contributions_assistantes(preparation_id);
create index if not exists mat_circuit_preparation_idx
  on public.maternelle_materiel_circuit(preparation_id, statut);
create index if not exists mat_circuit_statut_idx
  on public.maternelle_materiel_circuit(statut, demande_le);
create index if not exists mat_circuit_evenements_preparation_idx
  on public.maternelle_circuit_evenements(preparation_id, created_at desc);

alter table public.maternelle_circuit_config enable row level security;
alter table public.maternelle_contributions_assistantes enable row level security;
alter table public.maternelle_materiel_circuit enable row level security;
alter table public.maternelle_circuit_evenements enable row level security;

revoke all on table public.maternelle_circuit_config from public, anon, authenticated;
revoke all on table public.maternelle_contributions_assistantes from public, anon, authenticated;
revoke all on table public.maternelle_materiel_circuit from public, anon, authenticated;
revoke all on table public.maternelle_circuit_evenements from public, anon, authenticated;

create or replace function public.est_membre_actif_circuit_maternelle(p_profils text[])
returns boolean
language sql stable security definer set search_path=public,pg_temp
as $$
  select exists (
    select 1 from public.users u
     where u.auth_user_id=auth.uid() and u.actif=true
       and (lower(coalesce(u.role,''))=any(p_profils)
         or lower(coalesce(u.fonction,''))=any(p_profils))
  );
$$;

create or replace function public.calculer_points_circuit_maternelle(p_preparation_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp
as $$
declare
  v_p public.preparations%rowtype;
  v_cfg public.maternelle_circuit_config%rowtype;
  v_debut timestamptz;
  v_avance numeric;
  v_maintenant timestamptz := now();
  v_prep numeric;
  v_contrib numeric;
  v_assistante numeric;
  v_surv numeric;
  v_admin numeric;
  v_nb integer;
  v_terminees integer;
  v_surv_ok integer;
  v_admin_nb integer;
  v_admin_ok integer;
  v_contribution_le timestamptz;
  v_materiel_prevu boolean;
  v_responsabilites jsonb := '[]'::jsonb;
begin
  select * into v_p from public.preparations where id=p_preparation_id;
  select * into v_cfg from public.maternelle_circuit_config where id=true;
  if v_p.id is null then raise exception 'preparation_introuvable' using errcode='P0002'; end if;

  v_debut := case when v_p.date_cours is not null and v_p.heure_cours is not null
    then (v_p.date_cours::text || ' ' || v_p.heure_cours::text)::timestamp at time zone 'Africa/Bamako'
    else null end;
  v_avance := case when v_debut is not null and v_p.heure_depot is not null
    then extract(epoch from (v_debut-v_p.heure_depot))/3600.0 else null end;

  v_prep := case
    when v_avance is null then null
    when v_avance < v_cfg.heures_minimum then 0
    when v_avance >= v_cfg.heures_points_pleins then v_cfg.points_preparation
    else round(greatest(0, v_cfg.points_preparation-(v_cfg.heures_points_pleins-v_avance)),2)
  end;

  select min(c.submitted_at) into v_contribution_le
    from public.maternelle_contributions_assistantes c
   where c.preparation_id=p_preparation_id;
  v_contrib := case
    when v_avance is not null and v_avance < v_cfg.heures_minimum then null
    when v_contribution_le is not null and (v_debut is null or v_contribution_le <= v_debut) then v_cfg.points_contribution
    when v_debut is not null and v_maintenant > v_debut then 0
    else null end;

  v_materiel_prevu := length(btrim(coalesce(v_p.contenu->>'materiel',''))) > 0;

  select count(*),
         count(*) filter (where c.statut='installe' and c.confirme_le <= v_debut),
         count(*) filter (where c.surveillant_le is not null and c.surveillant_le <= v_debut
           and c.statut in ('escalade_administration','non_fourni','livre_assistante','installe')),
         count(*) filter (where c.statut in ('escalade_administration','retour_surveillance','non_fourni') or c.administratif_le is not null),
         count(*) filter (where c.decision_administration='fourni' and c.administratif_le <= v_debut)
    into v_nb,v_terminees,v_surv_ok,v_admin_nb,v_admin_ok
    from public.maternelle_materiel_circuit c
   where c.preparation_id=p_preparation_id;

  v_assistante := case
    when v_avance is not null and v_avance < v_cfg.heures_minimum then null
    when v_nb=0 and not v_materiel_prevu then null
    when v_nb=0 and v_debut is not null and v_maintenant > v_debut then 0
    when v_nb=0 then null
    when v_terminees=v_nb then v_cfg.points_materiel_assistante
    when v_debut is not null and v_maintenant > v_debut then 0
    else null end;
  v_surv := case
    when v_nb=0 then null
    when v_surv_ok=v_nb then v_cfg.points_surveillance
    when v_debut is not null and v_maintenant > v_debut then 0
    else null end;
  v_admin := case
    when v_admin_nb=0 then null
    when v_admin_ok=v_admin_nb then v_cfg.points_administration
    when v_debut is not null and v_maintenant > v_debut then 0
    else null end;

  -- Une responsabilité n'est désignée qu'une fois l'échéance passée. Elle
  -- suit le dernier passage de relais réellement inachevé, jamais la personne
  -- qui a correctement transmis la demande au maillon suivant.
  if v_debut is not null and v_maintenant > v_debut then
    if v_avance is null or v_avance < v_cfg.heures_minimum then
      v_responsabilites := jsonb_build_array('enseignant');
    else
      select coalesce(jsonb_agg(distinct responsable) filter (where responsable is not null),'[]'::jsonb)
        into v_responsabilites
        from (
          select case
            when c.statut='demande_assistante' then 'surveillant'
            when c.statut in ('escalade_administration','non_fourni') then 'responsable_administratif'
            when c.statut='retour_surveillance' then 'surveillant'
            when c.statut='livre_assistante' then 'assistante'
            else null end responsable
          from public.maternelle_materiel_circuit c where c.preparation_id=p_preparation_id
          union all
          select 'assistante' where v_contribution_le is null or (v_materiel_prevu and v_nb=0)
        ) r;
    end if;
  end if;

  return jsonb_build_object(
    'preparation',v_prep,'contribution_assistante',v_contrib,
    'materiel_assistante',v_assistante,'surveillance',v_surv,'administration',v_admin,
    'avance_heures',case when v_avance is null then null else round(v_avance,2) end,
    'cours_le',v_debut,
    'responsabilites',v_responsabilites,
    'maximums',jsonb_build_object(
      'preparation',v_cfg.points_preparation,'contribution_assistante',v_cfg.points_contribution,
      'materiel_assistante',v_cfg.points_materiel_assistante,
      'surveillance',v_cfg.points_surveillance,'administration',v_cfg.points_administration
    )
  );
end;
$$;

create or replace function public.lire_circuit_assistantes_maternelle()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp
as $$
declare
  v_moi public.users%rowtype;
  v_langue text;
  v_resultat jsonb;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null then raise exception 'authentification_requise' using errcode='42501'; end if;
  if v_moi.role not in ('directeur','responsable_administratif','surveillant','professeur') then
    raise exception 'profil_non_autorise' using errcode='42501';
  end if;
  if v_moi.role='professeur' and lower(coalesce(v_moi.fonction,'')) not like 'assistante-%-mat' then
    raise exception 'assistante_maternelle_requise' using errcode='42501';
  end if;
  v_langue := case when v_moi.langue='en' or lower(coalesce(v_moi.fonction,'')) like '%-en-%' then 'en' else 'fr' end;

  select jsonb_build_object(
    'profil',jsonb_build_object('id',v_moi.id,'role',v_moi.role,'fonction',v_moi.fonction,'langue',v_langue),
    'config',(select to_jsonb(c)-'id'-'updated_by' from public.maternelle_circuit_config c where c.id=true),
    'preparations',coalesce(jsonb_agg(obj order by (obj->>'date_cours')::date desc, obj->>'heure_cours') filter (where obj is not null),'[]'::jsonb)
  ) into v_resultat
  from (
    select jsonb_build_object(
      'id',p.id,'date_cours',p.date_cours,'heure_cours',p.heure_cours,
      'heure_depot',p.heure_depot,'matiere',p.matiere,'groupe',p.groupe,
      'status',p.status,'contenu',coalesce(p.contenu,'{}'::jsonb),
      'enseignant',jsonb_build_object('id',ens.id,'nom',trim(coalesce(ens.prenom,'')||' '||coalesce(ens.nom,'')),'langue',coalesce(ens.langue,'fr')),
      'contribution',(select to_jsonb(c) from public.maternelle_contributions_assistantes c
                       where c.preparation_id=p.id and (v_moi.role<>'professeur' or c.assistante_id=v_moi.id)
                       order by c.updated_at desc limit 1),
      'materiels',coalesce((select jsonb_agg(to_jsonb(mc)||jsonb_build_object(
          'stock_nom',m.nom,'stock_disponible',m.quantite,'demande_statut',d.statut
        ) order by mc.created_at)
        from public.maternelle_materiel_circuit mc
        left join public.materiels m on m.id=mc.materiel_id
        left join public.demandes_materiel d on d.id=mc.demande_materiel_id
       where mc.preparation_id=p.id and (v_moi.role<>'professeur' or mc.assistante_id=v_moi.id)),'[]'::jsonb),
      'points',public.calculer_points_circuit_maternelle(p.id)
    ) obj
    from public.preparations p
    join public.users ens on ens.id=p.user_id
   where lower(coalesce(p.groupe,'')) in ('ps','gs','petite section','grande section')
     and lower(coalesce(p.status,'')) not in ('','brouillon')
     and (v_moi.role<>'professeur' or
          (case when ens.langue='en' or lower(coalesce(ens.fonction,'')) like '%-en-%' then 'en' else 'fr' end)=v_langue)
  ) s;
  return v_resultat;
end;
$$;

create or replace function public.enregistrer_contribution_assistante(
  p_preparation_id uuid, p_comprehension text, p_role_propose text, p_apport_propose text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_moi public.users%rowtype; v_id uuid;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null or lower(coalesce(v_moi.fonction,'')) not like 'assistante-%-mat' then
    raise exception 'assistante_maternelle_requise' using errcode='42501'; end if;
  if not exists(select 1 from public.preparations p join public.users e on e.id=p.user_id
    where p.id=p_preparation_id and lower(coalesce(p.groupe,'')) in ('ps','gs','petite section','grande section')
      and (case when e.langue='en' or lower(coalesce(e.fonction,'')) like '%-en-%' then 'en' else 'fr' end)=
          (case when v_moi.langue='en' or lower(coalesce(v_moi.fonction,'')) like '%-en-%' then 'en' else 'fr' end))
  then raise exception 'preparation_non_accessible' using errcode='42501'; end if;
  insert into public.maternelle_contributions_assistantes(preparation_id,assistante_id,comprehension,role_propose,apport_propose)
  values(p_preparation_id,v_moi.id,btrim(p_comprehension),btrim(p_role_propose),btrim(p_apport_propose))
  on conflict(preparation_id,assistante_id) do update set
    comprehension=excluded.comprehension,role_propose=excluded.role_propose,
    apport_propose=excluded.apport_propose,updated_at=now()
  returning id into v_id;
  insert into public.maternelle_circuit_evenements(preparation_id,auteur_id,auteur_role,evenement,details)
  values(p_preparation_id,v_moi.id,'assistante','contribution_enregistree',jsonb_build_object('contribution_id',v_id));
  return jsonb_build_object('ok',true,'id',v_id);
end;
$$;

create or replace function public.demander_materiel_assistante(p_preparation_id uuid,p_elements jsonb)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_moi public.users%rowtype; v_p public.preparations%rowtype; v_e jsonb; v_lib text; v_qte integer; v_mat uuid; v_dem uuid; v_circuit uuid; v_ids jsonb:='[]'::jsonb;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null or lower(coalesce(v_moi.fonction,'')) not like 'assistante-%-mat' then raise exception 'assistante_maternelle_requise' using errcode='42501'; end if;
  select p.* into v_p from public.preparations p where p.id=p_preparation_id and lower(coalesce(p.groupe,'')) in ('ps','gs','petite section','grande section');
  if v_p.id is null then raise exception 'preparation_introuvable' using errcode='P0002'; end if;
  if not exists(select 1 from public.users e where e.id=v_p.user_id and
    (case when e.langue='en' or lower(coalesce(e.fonction,'')) like '%-en-%' then 'en' else 'fr' end)=
    (case when v_moi.langue='en' or lower(coalesce(v_moi.fonction,'')) like '%-en-%' then 'en' else 'fr' end))
  then raise exception 'preparation_non_accessible' using errcode='42501'; end if;
  if not exists(select 1 from public.maternelle_contributions_assistantes c
    where c.preparation_id=v_p.id and c.assistante_id=v_moi.id)
  then raise exception 'contribution_assistante_requise'; end if;
  if jsonb_typeof(p_elements)<>'array' or jsonb_array_length(p_elements)=0 or jsonb_array_length(p_elements)>30 then raise exception 'liste_materiel_invalide'; end if;
  for v_e in select value from jsonb_array_elements(p_elements) loop
    v_lib:=btrim(v_e->>'libelle'); v_qte:=greatest(1,least(999,coalesce((v_e->>'quantite')::integer,1)));
    if v_lib='' or length(v_lib)>180 then raise exception 'libelle_materiel_invalide'; end if;
    if exists(select 1 from public.maternelle_materiel_circuit c where c.preparation_id=v_p.id and c.assistante_id=v_moi.id and lower(btrim(c.libelle))=lower(v_lib))
    then raise exception 'materiel_deja_demande: %',v_lib; end if;
    select m.id into v_mat from public.materiels m where m.actif=true and lower(btrim(m.nom))=lower(v_lib) limit 1;
    insert into public.demandes_materiel(demandeur_id,materiel_id,libelle,quantite,groupe,motif)
    values(v_moi.id,v_mat,v_lib,v_qte,v_p.groupe,'Préparation maternelle '||v_p.id::text) returning id into v_dem;
    insert into public.maternelle_materiel_circuit(preparation_id,assistante_id,demande_materiel_id,materiel_id,libelle,quantite)
    values(v_p.id,v_moi.id,v_dem,v_mat,v_lib,v_qte)
    on conflict(preparation_id,assistante_id,libelle) do update set quantite=excluded.quantite,updated_at=now()
    returning id into v_circuit;
    insert into public.maternelle_circuit_evenements(preparation_id,materiel_circuit_id,auteur_id,auteur_role,evenement,details)
    values(v_p.id,v_circuit,v_moi.id,'assistante','materiel_demande',jsonb_build_object('libelle',v_lib,'quantite',v_qte));
    v_ids:=v_ids||jsonb_build_array(v_circuit);
  end loop;
  return jsonb_build_object('ok',true,'ids',v_ids);
end;
$$;

create or replace function public.traiter_materiel_surveillance(p_circuit_id uuid,p_action text,p_quantite_livree integer default null,p_commentaire text default null)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_moi public.users%rowtype; v_c public.maternelle_materiel_circuit%rowtype; v_qte integer;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null or v_moi.role<>'surveillant' then raise exception 'surveillant_requis' using errcode='42501'; end if;
  select * into v_c from public.maternelle_materiel_circuit where id=p_circuit_id for update;
  if v_c.id is null then raise exception 'demande_introuvable' using errcode='P0002'; end if;
  if p_action not in ('livrer','escalader') then raise exception 'action_invalide'; end if;
  if p_action='escalader' then
    update public.maternelle_materiel_circuit set statut='escalade_administration',surveillant_id=v_moi.id,surveillant_le=now(),commentaire_surveillance=nullif(btrim(p_commentaire),'') ,updated_at=now() where id=p_circuit_id;
    update public.demandes_materiel set statut='validee',traite_par=v_moi.id,traite_le=now(),commentaire_traitement='Transmise au responsable administratif : '||coalesce(p_commentaire,'') where id=v_c.demande_materiel_id;
  else
    v_qte:=coalesce(p_quantite_livree,v_c.quantite);
    if v_qte<1 or v_qte>v_c.quantite then raise exception 'quantite_livree_invalide'; end if;
    if v_c.materiel_id is not null then
      insert into public.mouvements_stock(materiel_id,quantite,motif,commentaire,demande_id,saisi_par)
      values(v_c.materiel_id,-v_qte,'livraison','Préparation maternelle',v_c.demande_materiel_id,v_moi.id);
    end if;
    update public.maternelle_materiel_circuit set statut='livre_assistante',surveillant_id=v_moi.id,surveillant_le=now(),quantite_livree=v_qte,commentaire_surveillance=nullif(btrim(p_commentaire),''),updated_at=now() where id=p_circuit_id;
    update public.demandes_materiel set statut='livree',quantite_livree=v_qte,traite_par=v_moi.id,traite_le=now(),commentaire_traitement=p_commentaire where id=v_c.demande_materiel_id;
  end if;
  insert into public.maternelle_circuit_evenements(preparation_id,materiel_circuit_id,auteur_id,auteur_role,evenement,details)
  values(v_c.preparation_id,v_c.id,v_moi.id,'surveillant',case when p_action='livrer' then 'materiel_livre' else 'materiel_escalade' end,jsonb_build_object('quantite',p_quantite_livree,'commentaire',p_commentaire));
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.traiter_materiel_administration(p_circuit_id uuid,p_decision text,p_commentaire text default null)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_moi public.users%rowtype; v_c public.maternelle_materiel_circuit%rowtype;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null or v_moi.role not in ('responsable_administratif','directeur') then raise exception 'administration_requise' using errcode='42501'; end if;
  if p_decision not in ('fourni','commande','non_fourni') then raise exception 'decision_invalide'; end if;
  select * into v_c from public.maternelle_materiel_circuit where id=p_circuit_id and statut='escalade_administration' for update;
  if v_c.id is null then raise exception 'demande_non_escaladee' using errcode='P0002'; end if;
  update public.maternelle_materiel_circuit set
    statut=case when p_decision='fourni' then 'retour_surveillance' when p_decision='non_fourni' then 'non_fourni' else 'escalade_administration' end,
    administratif_id=v_moi.id,administratif_le=now(),decision_administration=p_decision,
    commentaire_administration=nullif(btrim(p_commentaire),''),updated_at=now()
  where id=p_circuit_id;
  insert into public.maternelle_circuit_evenements(preparation_id,materiel_circuit_id,auteur_id,auteur_role,evenement,details)
  values(v_c.preparation_id,v_c.id,v_moi.id,'responsable_administratif','decision_administration',jsonb_build_object('decision',p_decision,'commentaire',p_commentaire));
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.confirmer_materiel_assistante(p_circuit_id uuid,p_recu boolean,p_installe boolean,p_commentaire text default null)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_moi public.users%rowtype; v_c public.maternelle_materiel_circuit%rowtype;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null or lower(coalesce(v_moi.fonction,'')) not like 'assistante-%-mat' then raise exception 'assistante_maternelle_requise' using errcode='42501'; end if;
  select * into v_c from public.maternelle_materiel_circuit where id=p_circuit_id and assistante_id=v_moi.id and statut='livre_assistante' for update;
  if v_c.id is null then raise exception 'livraison_non_confirmable' using errcode='P0002'; end if;
  update public.maternelle_materiel_circuit set recu_assistante=p_recu,installe_assistante=p_installe,
    confirme_le=now(),commentaire_assistante=nullif(btrim(p_commentaire),''),
    statut=case when p_recu and p_installe then 'installe' else 'livre_assistante' end,updated_at=now()
  where id=p_circuit_id;
  insert into public.maternelle_circuit_evenements(preparation_id,materiel_circuit_id,auteur_id,auteur_role,evenement,details)
  values(v_c.preparation_id,v_c.id,v_moi.id,'assistante','reception_confirmee',jsonb_build_object('recu',p_recu,'installe',p_installe,'commentaire',p_commentaire));
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.configurer_bareme_assistantes_maternelle(p_config jsonb)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_moi public.users%rowtype; v_c public.maternelle_circuit_config%rowtype;
begin
  select u.* into v_moi from public.users u where u.auth_user_id=auth.uid() and u.actif=true limit 1;
  if v_moi.id is null or v_moi.role<>'directeur' then raise exception 'direction_requise' using errcode='42501'; end if;
  update public.maternelle_circuit_config set
    points_preparation=coalesce((p_config->>'points_preparation')::numeric,points_preparation),
    heures_points_pleins=coalesce((p_config->>'heures_points_pleins')::numeric,heures_points_pleins),
    heures_minimum=coalesce((p_config->>'heures_minimum')::numeric,heures_minimum),
    points_contribution=coalesce((p_config->>'points_contribution')::numeric,points_contribution),
    points_materiel_assistante=coalesce((p_config->>'points_materiel_assistante')::numeric,points_materiel_assistante),
    points_surveillance=coalesce((p_config->>'points_surveillance')::numeric,points_surveillance),
    points_administration=coalesce((p_config->>'points_administration')::numeric,points_administration),
    updated_by=v_moi.id,updated_at=now()
  where id=true returning * into v_c;
  insert into public.maternelle_circuit_evenements(preparation_id,auteur_id,auteur_role,evenement,details)
  values(null,v_moi.id,'directeur','bareme_modifie',p_config);
  return to_jsonb(v_c)-'updated_by';
end;
$$;

grant execute on function public.lire_circuit_assistantes_maternelle() to authenticated;
grant execute on function public.enregistrer_contribution_assistante(uuid,text,text,text) to authenticated;
grant execute on function public.demander_materiel_assistante(uuid,jsonb) to authenticated;
grant execute on function public.traiter_materiel_surveillance(uuid,text,integer,text) to authenticated;
grant execute on function public.traiter_materiel_administration(uuid,text,text) to authenticated;
grant execute on function public.confirmer_materiel_assistante(uuid,boolean,boolean,text) to authenticated;
grant execute on function public.configurer_bareme_assistantes_maternelle(jsonb) to authenticated;

revoke all on function public.est_membre_actif_circuit_maternelle(text[]) from public,anon,authenticated;
revoke all on function public.calculer_points_circuit_maternelle(uuid) from public,anon,authenticated;
revoke all on function public.lire_circuit_assistantes_maternelle() from public,anon;
revoke all on function public.enregistrer_contribution_assistante(uuid,text,text,text) from public,anon;
revoke all on function public.demander_materiel_assistante(uuid,jsonb) from public,anon;
revoke all on function public.traiter_materiel_surveillance(uuid,text,integer,text) from public,anon;
revoke all on function public.traiter_materiel_administration(uuid,text,text) from public,anon;
revoke all on function public.confirmer_materiel_assistante(uuid,boolean,boolean,text) from public,anon;
revoke all on function public.configurer_bareme_assistantes_maternelle(jsonb) from public,anon;

commit;

-- Contrôle : les quatre objets doivent exister et le barème doit être 20/10/10/10/10.
select points_preparation,points_contribution,points_materiel_assistante,
       points_surveillance,points_administration,heures_points_pleins,heures_minimum
  from public.maternelle_circuit_config where id=true;
