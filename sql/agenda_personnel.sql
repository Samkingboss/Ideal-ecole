-- Agenda personnel des enseignants : événements privés et rappels ciblés.
begin;

create table if not exists public.agenda_personnel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  titre text not null check (length(trim(titre)) between 1 and 160),
  description text,
  commence_at timestamptz not null,
  rappel_minutes integer not null default 30 check (rappel_minutes between 0 and 10080),
  rappel_envoye_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agenda_personnel_user_date_idx
  on public.agenda_personnel (user_id, commence_at);

revoke all on public.agenda_personnel from public, anon, authenticated;
alter table public.agenda_personnel enable row level security;

create or replace function public.lire_mon_agenda(p_debut timestamptz, p_fin timestamptz)
returns setof public.agenda_personnel
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_user public.users;
begin
  select u.* into v_user from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_user.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_user.role <> 'professeur' then raise exception 'agenda_reserve_enseignant' using errcode='42501'; end if;
  return query select a.* from public.agenda_personnel a
   where a.user_id = v_user.id and a.commence_at >= p_debut and a.commence_at < p_fin
   order by a.commence_at;
end
$function$;

create or replace function public.sauver_mon_evenement_agenda(
  p_id uuid, p_titre text, p_description text, p_commence_at timestamptz, p_rappel_minutes integer
)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_user public.users; v_id uuid;
begin
  select u.* into v_user from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_user.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_user.role <> 'professeur' then raise exception 'agenda_reserve_enseignant' using errcode='42501'; end if;
  if p_commence_at is null or length(trim(coalesce(p_titre,''))) not between 1 and 160
     or p_rappel_minutes not between 0 and 10080 then
    raise exception 'evenement_agenda_invalide' using errcode='22023';
  end if;
  if p_id is null then
    insert into public.agenda_personnel(user_id,titre,description,commence_at,rappel_minutes)
    values(v_user.id,trim(p_titre),nullif(trim(coalesce(p_description,'')),''),p_commence_at,p_rappel_minutes)
    returning id into v_id;
  else
    update public.agenda_personnel set titre=trim(p_titre),
      description=nullif(trim(coalesce(p_description,'')),''), commence_at=p_commence_at,
      rappel_minutes=p_rappel_minutes, rappel_envoye_at=null, updated_at=now()
    where id=p_id and user_id=v_user.id returning id into v_id;
    if v_id is null then raise exception 'evenement_agenda_introuvable' using errcode='P0002'; end if;
  end if;
  return v_id;
end
$function$;

create or replace function public.supprimer_mon_evenement_agenda(p_id uuid)
returns boolean language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_user public.users; v_nombre integer;
begin
  select u.* into v_user from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_user.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_user.role <> 'professeur' then raise exception 'agenda_reserve_enseignant' using errcode='42501'; end if;
  delete from public.agenda_personnel where id=p_id and user_id=v_user.id;
  get diagnostics v_nombre = row_count;
  return v_nombre > 0;
end
$function$;

-- Appelée à l'ouverture de l'application puis chaque minute. Le verrou de ligne
-- et rappel_envoye_at garantissent un seul rappel, même avec plusieurs onglets.
create or replace function public.traiter_mes_rappels_agenda()
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_user public.users; r public.agenda_personnel; v_notifs jsonb; v_notif jsonb; v_nombre integer := 0;
begin
  select u.* into v_user from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_user.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_user.role <> 'professeur' then return 0; end if;
  for r in select * from public.agenda_personnel a where a.user_id=v_user.id
    and a.rappel_envoye_at is null
    and now() >= a.commence_at - make_interval(mins => a.rappel_minutes)
    and now() < a.commence_at + interval '24 hours' for update skip locked
  loop
    v_notif := jsonb_build_object('id','agenda-'||r.id::text,'titre','Rappel agenda',
      'message',r.titre||' · '||to_char(r.commence_at at time zone 'Africa/Bamako','DD/MM/YYYY HH24:MI'),
      'date',now(),'lu',false,'type','agenda','tabTarget','agenda','ref',r.id::text);
    select coalesce(a.value,'[]'::jsonb) into v_notifs from public.app_state a
      where a.app='notifications' and a.key='notifs_'||v_user.id::text for update;
    v_notifs := coalesce(v_notifs,'[]'::jsonb);
    if not exists(select 1 from jsonb_array_elements(v_notifs) n where n->>'id'='agenda-'||r.id::text) then
      insert into public.app_state(app,key,value,updated_at)
      values('notifications','notifs_'||v_user.id::text,jsonb_build_array(v_notif)||v_notifs,now())
      on conflict(app,key) do update set value=excluded.value,updated_at=excluded.updated_at;
      begin
        perform public.emettre_notification_push(array[v_user.id::text],'Rappel agenda',r.titre,
          '/?notificationTab=agenda&notificationRef='||r.id::text,'ideal-agenda-'||r.id::text);
      exception when others then null; -- la cloche reste enregistrée si le Web Push échoue
      end;
    end if;
    update public.agenda_personnel set rappel_envoye_at=now() where id=r.id;
    v_nombre := v_nombre + 1;
  end loop;
  return v_nombre;
end
$function$;

revoke all on function public.lire_mon_agenda(timestamptz,timestamptz) from public,anon;
revoke all on function public.sauver_mon_evenement_agenda(uuid,text,text,timestamptz,integer) from public,anon;
revoke all on function public.supprimer_mon_evenement_agenda(uuid) from public,anon;
revoke all on function public.traiter_mes_rappels_agenda() from public,anon;
grant execute on function public.lire_mon_agenda(timestamptz,timestamptz) to authenticated;
grant execute on function public.sauver_mon_evenement_agenda(uuid,text,text,timestamptz,integer) to authenticated;
grant execute on function public.supprimer_mon_evenement_agenda(uuid) to authenticated;
grant execute on function public.traiter_mes_rappels_agenda() to authenticated;

commit;
