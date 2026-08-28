-- Notification étroite : demande de correction -> propriétaire réel.
-- Rollback : drop function if exists public.notifier_correction_preparation(uuid);

begin;

create or replace function public.notifier_correction_preparation(p_preparation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi public.users;
  v_prep public.preparations;
  v_cycle integer;
  v_cible text;
  v_id text;
  v_titre text := '📝 Correction demandée';
  v_message text;
  v_notif jsonb;
  v_liste jsonb;
  v_cree boolean := false;
begin
  select u.* into v_moi from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true limit 1;
  if v_moi.id is null then raise exception 'session_non_authentifiee' using errcode='28000'; end if;
  if v_moi.role <> 'directeur' then raise exception 'correction_reservee_au_directeur' using errcode='42501'; end if;

  select p.* into v_prep from public.preparations p where p.id = p_preparation_id;
  if v_prep.id is null then raise exception 'preparation_introuvable' using errcode='P0002'; end if;
  if v_prep.status <> 'a_corriger' then raise exception 'correction_non_demandee' using errcode='22023'; end if;

  select count(*)::integer into v_cycle
    from jsonb_array_elements(coalesce(v_prep.historique_statuts, '[]'::jsonb)) e
   where e->>'action' = 'correction_demandee';
  if v_cycle < 1 then raise exception 'historique_correction_absent' using errcode='22023'; end if;

  v_cible := v_prep.user_id::text;
  v_id := 'prep-correction-' || p_preparation_id::text || '-' || v_cycle::text;
  v_message := 'Une correction a été demandée pour votre préparation de '
    || coalesce(v_prep.matiere, 'cours') || ' du '
    || coalesce(to_char(v_prep.date_cours, 'DD/MM/YYYY'), 'date non précisée') || '.';
  v_notif := jsonb_build_object(
    'id',v_id, 'titre',v_titre, 'message',v_message,
    'date',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lu',false, 'type','preparation', 'tabTarget','mespreps',
    'ref',p_preparation_id::text, 'evenement','correction_demandee', 'cycle',v_cycle
  );

  perform pg_advisory_xact_lock(hashtext('notifs_' || v_cible));
  select value into v_liste from public.app_state
   where app='notifications' and key='notifs_' || v_cible;
  v_liste := coalesce(v_liste, '[]'::jsonb);
  if jsonb_typeof(v_liste) <> 'array' then v_liste := '[]'::jsonb; end if;

  if not exists (select 1 from jsonb_array_elements(v_liste) n where n->>'id'=v_id) then
    v_liste := jsonb_build_array(v_notif) || v_liste;
    if jsonb_array_length(v_liste) > 50 then
      v_liste := (select coalesce(jsonb_agg(x.e order by x.i),'[]'::jsonb)
        from (select e,i from jsonb_array_elements(v_liste) with ordinality t(e,i) order by i limit 50) x);
    end if;
    insert into public.app_state(app,key,value,updated_at)
      values('notifications','notifs_' || v_cible,v_liste,now())
      on conflict(app,key) do update set value=excluded.value,updated_at=excluded.updated_at;
    v_cree := true;
  end if;

  if v_cree then
    begin
      perform public.emettre_notification_push(
        p_cibles=>array[v_cible], p_titre=>v_titre, p_message=>v_message,
        p_url=>'/?notificationTab=mespreps&notificationRef=' || p_preparation_id::text,
        p_tag=>'ideal-' || v_id
      );
    exception when others then null;
    end;
  end if;
  return jsonb_build_object('cree',v_cree,'notification',v_id,'proprietaire',v_cible,'preparation',p_preparation_id);
end
$function$;

revoke all on function public.notifier_correction_preparation(uuid) from public, anon;
grant execute on function public.notifier_correction_preparation(uuid) to authenticated;

commit;
