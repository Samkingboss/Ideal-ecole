-- ═══════════════════════════════════════════════════════════════════════
-- SALAIRES · ÉDITION RÉSERVÉE AU DIRECTEUR
-- ═══════════════════════════════════════════════════════════════════════
--
-- La grille `rh/postes` est la source affichée dans la comptabilité du
-- Responsable administratif. La fiche `rh/personnel` contient les salaires
-- individuels utilisés notamment pour plafonner les avances.
--
-- L'interface masque déjà les éditeurs au Responsable administratif. Ces
-- triggers portent la même règle dans PostgreSQL : une requête fabriquée à
-- la main ne peut donc pas contourner l'écran.
--
-- Non destructif : aucune ligne métier n'est modifiée par cette migration.

begin;

do $$
begin
  if to_regclass('public.app_state') is null then
    raise exception 'public.app_state absente';
  end if;
  if to_regclass('public.financement_params') is null then
    raise exception 'public.financement_params absente';
  end if;
  if to_regprocedure('public.ideal_est(text[])') is null then
    raise exception 'public.ideal_est(text[]) absente';
  end if;
end $$;

create or replace function public.proteger_salaires_app_state()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_app text := coalesce(new.app, old.app);
  v_key text := coalesce(new.key, old.key);
begin
  if v_app = 'rh' and v_key in ('postes', 'personnel') then
    -- Le propriétaire SQL et la clé serveur restent disponibles pour les
    -- opérations techniques. Toute session applicative doit être Directeur.
    if current_user not in ('postgres', 'service_role', 'supabase_admin')
       and not public.ideal_est(array['directeur']) then
      raise insufficient_privilege
        using message = 'Modification des salaires reservee au Directeur';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists app_state_salaires_direction_seule on public.app_state;
create trigger app_state_salaires_direction_seule
before insert or update or delete on public.app_state
for each row execute function public.proteger_salaires_app_state();

create or replace function public.proteger_salaires_financement_ra()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ancien jsonb := to_jsonb(old.state_json);
  v_nouveau jsonb := to_jsonb(new.state_json);
  v_charge_ancienne jsonb;
  v_charge_nouvelle jsonb;
begin
  if public.ideal_est(array['responsable_administratif']) then
    select element into v_charge_ancienne
      from jsonb_array_elements(coalesce(v_ancien->'charges', '[]'::jsonb)) element
     where element->>'id' = 'salaires' limit 1;
    select element into v_charge_nouvelle
      from jsonb_array_elements(coalesce(v_nouveau->'charges', '[]'::jsonb)) element
     where element->>'id' = 'salaires' limit 1;

    if v_nouveau->'salaires' is distinct from v_ancien->'salaires'
       or v_nouveau->'paies' is distinct from v_ancien->'paies'
       or v_charge_nouvelle is distinct from v_charge_ancienne then
      raise insufficient_privilege
        using message = 'Modification des salaires et de la paie reservee au Directeur';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists financement_salaires_direction_seule on public.financement_params;
create trigger financement_salaires_direction_seule
before update on public.financement_params
for each row execute function public.proteger_salaires_financement_ra();

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.app_state'::regclass
       and tgname = 'app_state_salaires_direction_seule'
       and not tgisinternal
  ) then
    raise exception 'Trigger app_state salarial non installe';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.financement_params'::regclass
       and tgname = 'financement_salaires_direction_seule'
       and not tgisinternal
  ) then
    raise exception 'Trigger financement salarial non installe';
  end if;
end $$;

commit;

-- Contrôle après exécution : deux lignes doivent apparaître.
select c.relname as table_, t.tgname as protection
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where t.tgname in (
   'app_state_salaires_direction_seule',
   'financement_salaires_direction_seule'
 ) and not t.tgisinternal
 order by c.relname;
