-- Retour arriere de agenda_preparations_direction_administration.sql.
-- Retire uniquement la double casquette des deux roles administratifs.
-- Les agendas, brouillons et preparations deja enregistres sont conserves.

begin;

do $rollback$
declare
  r record;
  v_oid regprocedure;
  v_definition text;
  v_nombre integer;
begin
  for r in
    select * from (values
      ('public.lire_brouillon_preparation(date,text)', 'v_prof'),
      ('public.sauver_brouillon_preparation(date,text,jsonb,bigint)', 'v_prof'),
      ('public.supprimer_brouillon_preparation(date,text)', 'v_prof'),
      ('public.nettoyer_sequences_preparation(uuid[],date,smallint,smallint)', 'v_prof'),
      ('public.lire_mon_agenda(timestamptz,timestamptz)', 'v_user'),
      ('public.sauver_mon_evenement_agenda(uuid,text,text,timestamptz,integer)', 'v_user'),
      ('public.supprimer_mon_evenement_agenda(uuid)', 'v_user'),
      ('public.traiter_mes_rappels_agenda()', 'v_user')
    ) as f(signature, variable_role)
  loop
    v_oid := to_regprocedure(r.signature);
    if v_oid is null then
      raise exception 'fonction_requise_absente: %', r.signature;
    end if;

    v_definition := pg_get_functiondef(v_oid);
    v_nombre := (length(v_definition) - length(replace(
      v_definition,
      r.variable_role || '.role not in (''professeur'',''directeur'',''responsable_administratif'')',
      ''
    ))) / length(r.variable_role || '.role not in (''professeur'',''directeur'',''responsable_administratif'')');

    if v_nombre = 0 and strpos(v_definition, r.variable_role || '.role <> ''professeur''') > 0 then
      continue;
    end if;
    if v_nombre <> 1 then
      raise exception 'garde_inattendue: % (% occurrence(s))', r.signature, v_nombre;
    end if;

    execute replace(
      v_definition,
      r.variable_role || '.role not in (''professeur'',''directeur'',''responsable_administratif'')',
      r.variable_role || '.role <> ''professeur'''
    );
  end loop;
end
$rollback$;

commit;
