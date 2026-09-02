-- Modification administrative d'un dossier et retour de validation Direction.
-- Nouvelle surface uniquement : aucun droit direct n'est ajouté aux tables.

begin;

create or replace function public.modifier_inscription_administration(
  p_inscription_id uuid,
  p_modifications jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_ins public.inscriptions%rowtype;
  v_el jsonb := coalesce(p_modifications -> 'eleve', '{}'::jsonb);
  v_r1 jsonb := coalesce(p_modifications -> 'responsable1', '{}'::jsonb);
  v_classe_id public.classes.id%type;
  v_parent_phone text;
begin
  if not public.ideal_est(array['responsable_administratif']) then
    raise exception 'modification_inscription_reservee_administration';
  end if;
  if jsonb_typeof(v_el) <> 'object' or jsonb_typeof(v_r1) <> 'object' then
    raise exception 'modifications_invalides';
  end if;
  if nullif(btrim(v_el ->> 'nom'), '') is null
     or nullif(btrim(v_el ->> 'prenom'), '') is null
     or nullif(btrim(v_el ->> 'date_naissance'), '') is null
     or nullif(btrim(v_el ->> 'classe_demandee'), '') is null
     or nullif(btrim(v_r1 ->> 'nom'), '') is null
     or nullif(btrim(v_r1 ->> 'prenom'), '') is null
     or nullif(btrim(v_r1 ->> 'tel1'), '') is null then
    raise exception 'champs_obligatoires_manquants';
  end if;

  select * into v_ins
    from public.inscriptions
   where id = p_inscription_id
   for update;
  if not found then raise exception 'inscription_introuvable'; end if;

  if v_ins.statut = 'validee' then
    select c.id into v_classe_id
      from public.classes c
     where lower(regexp_replace(c.nom, '\s+bilingue\s*$', '', 'i')) =
           lower(regexp_replace(btrim(v_el ->> 'classe_demandee'), '\s+bilingue\s*$', '', 'i'))
     order by c.ordre nulls last
     limit 1;
    if v_classe_id is null then
      raise exception 'classe_introuvable' using detail = v_el ->> 'classe_demandee';
    end if;
  end if;

  update public.responsables set
    nom = btrim(v_r1 ->> 'nom'),
    prenom = btrim(v_r1 ->> 'prenom'),
    lien_parente = nullif(btrim(coalesce(v_r1 ->> 'lien_parente', '')), ''),
    tel1 = btrim(v_r1 ->> 'tel1'),
    whatsapp = nullif(btrim(coalesce(v_r1 ->> 'whatsapp', '')), ''),
    email = nullif(btrim(coalesce(v_r1 ->> 'email', '')), ''),
    adresse = nullif(btrim(coalesce(v_r1 ->> 'adresse', '')), ''),
    profession = nullif(btrim(coalesce(v_r1 ->> 'profession', '')), ''),
    situation_matrimoniale = nullif(btrim(coalesce(v_r1 ->> 'situation_matrimoniale', '')), '')
  where id = v_ins.responsable1_id;
  if not found then raise exception 'responsable_principal_introuvable'; end if;

  v_parent_phone := coalesce(nullif(btrim(v_r1 ->> 'whatsapp'), ''), btrim(v_r1 ->> 'tel1'));

  update public.inscriptions set
    nom = btrim(v_el ->> 'nom'), prenom = btrim(v_el ->> 'prenom'),
    sexe = nullif(btrim(coalesce(v_el ->> 'sexe', '')), ''),
    date_naissance = (v_el ->> 'date_naissance')::date,
    lieu_naissance = nullif(btrim(coalesce(v_el ->> 'lieu_naissance', '')), ''),
    groupe_sanguin = nullif(btrim(coalesce(v_el ->> 'groupe_sanguin', '')), ''),
    nationalite = nullif(btrim(coalesce(v_el ->> 'nationalite', '')), ''),
    langue_maison = nullif(btrim(coalesce(v_el ->> 'langue_maison', '')), ''),
    ancienne_ecole = nullif(btrim(coalesce(v_el ->> 'ancienne_ecole', '')), ''),
    classe_precedente = nullif(btrim(coalesce(v_el ->> 'classe_precedente', '')), ''),
    classe_demandee = btrim(v_el ->> 'classe_demandee'),
    adresse = nullif(btrim(coalesce(v_el ->> 'adresse', '')), ''),
    cantine = coalesce((v_el ->> 'cantine')::boolean, false),
    allergies = nullif(btrim(coalesce(v_el ->> 'allergies', '')), ''),
    restrictions = nullif(btrim(coalesce(v_el ->> 'restrictions', '')), ''),
    transport = coalesce((v_el ->> 'transport')::boolean, false),
    droit_image = coalesce((v_el ->> 'droit_image')::boolean, false)
  where id = v_ins.id;

  if v_ins.statut = 'validee' then
    update public.eleves set
      nom = btrim(v_el ->> 'nom'), prenom = btrim(v_el ->> 'prenom'),
      sexe = nullif(btrim(coalesce(v_el ->> 'sexe', '')), ''),
      date_naissance = (v_el ->> 'date_naissance')::date,
      classe_id = v_classe_id, parent_phone = v_parent_phone
    where id = v_ins.eleve_id or inscription_id = v_ins.id;
    if not found then raise exception 'eleve_valide_introuvable'; end if;
  end if;

  return jsonb_build_object('ok', true, 'inscription_id', v_ins.id,
    'eleve_synchronise', v_ins.statut = 'validee');
end;
$function$;

revoke all on function public.modifier_inscription_administration(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.modifier_inscription_administration(uuid,jsonb)
  to authenticated;

create or replace function public.reserver_validation_inscription_direction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if new.statut = 'validee' and old.statut is distinct from 'validee'
     and not public.ideal_est(array['directeur']) then
    raise exception 'validation_reservee_direction';
  end if;
  return new;
end;
$function$;

drop trigger if exists inscription_validation_reservee_direction on public.inscriptions;
create trigger inscription_validation_reservee_direction
before update of statut on public.inscriptions
for each row execute function public.reserver_validation_inscription_direction();

create or replace function public.notifier_ra_inscription_validee()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_cle constant text := 'notifs_responsable_administratif';
  v_liste jsonb;
  v_reste jsonb;
  v_notif jsonb;
begin
  if new.statut is distinct from 'validee'
     or old.statut is not distinct from 'validee'
     or new.signature_directeur_chemin is null then
    return new;
  end if;

  v_notif := jsonb_build_object(
    'id', 'insc-validee-' || new.id::text,
    'titre', '✅ Inscription définitivement acceptée',
    'message', btrim(coalesce(new.prenom, '') || ' ' || coalesce(new.nom, ''))
      || ' — dossier ' || coalesce(new.matricule, '?')
      || '. Vous pouvez maintenant informer le parent ou tuteur légal.',
    'date', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lu', false, 'type', 'inscription_validee',
    'tabTarget', 'eleves', 'ref', new.id::text
  );

  perform pg_advisory_xact_lock(hashtext('app_state:notifications:' || v_cle)::bigint);
  select a.value into v_liste from public.app_state a
   where a.app = 'notifications' and a.key = v_cle;
  if jsonb_typeof(coalesce(v_liste, 'null'::jsonb)) is distinct from 'array' then
    v_liste := '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(x.e), '[]'::jsonb) into v_reste
    from (select e from jsonb_array_elements(v_liste) e
           where (e ->> 'id') is distinct from (v_notif ->> 'id') limit 49) x;
  insert into public.app_state(app, key, value, updated_at)
  values ('notifications', v_cle, jsonb_build_array(v_notif) || v_reste, now())
  on conflict (app, key) do update
    set value = excluded.value, updated_at = excluded.updated_at;

  begin
    perform public.emettre_notification_push(
      array['responsable_administratif'],
      v_notif ->> 'titre', v_notif ->> 'message',
      '/?notificationTab=eleves&notificationRef=' || new.id::text,
      'ideal-inscription-validee-' || new.id::text
    );
  exception when others then
    raise warning 'push validation inscription non mis en file : %', sqlerrm;
  end;
  return new;
end;
$function$;

drop trigger if exists inscription_validee_notifier_ra on public.inscriptions;
create trigger inscription_validee_notifier_ra
after update of statut on public.inscriptions
for each row execute function public.notifier_ra_inscription_validee();

do $verif$
declare v_src text;
begin
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='modifier_inscription_administration';
  if strpos(v_src, $q$ideal_est(array['responsable_administratif'])$q$) = 0 then
    raise exception 'GARDE RA ABSENTE';
  end if;
  if has_function_privilege('anon', 'public.modifier_inscription_administration(uuid,jsonb)', 'execute') then
    raise exception 'ANON PEUT MODIFIER UN DOSSIER';
  end if;
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='reserver_validation_inscription_direction';
  if strpos(v_src, $q$ideal_est(array['directeur'])$q$) = 0 then
    raise exception 'VALIDATION NON RESERVEE AU DIRECTEUR';
  end if;
end;
$verif$;

commit;
