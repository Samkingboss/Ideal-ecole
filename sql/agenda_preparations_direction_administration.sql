-- Double casquette pedagogique : Directeur et Responsable administratif.
--
-- Ces deux comptes peuvent recevoir des matieres dans affectations_matieres.
-- Cette migration leur ouvre uniquement les fonctions personnelles deja
-- protegees par auth.uid() : agenda, rappels, brouillons et nettoyage de leurs
-- propres sequences. Elle ne donne aucun acces aux donnees d'un autre compte.
--
-- TRANSACTIONNEL · aucune donnee modifiee · les droits EXECUTE sont conserves.

begin;

do $migration$
declare
  r record;
  v_oid regprocedure;
  v_definition text;
  v_nombre integer;
begin
  for r in
    select * from (values
      ('public.lire_brouillon_preparation(date,text)',
       'v_prof.role <> ''professeur''',
       'v_prof.role not in (''professeur'',''directeur'',''responsable_administratif'')'),
      ('public.sauver_brouillon_preparation(date,text,jsonb,bigint)',
       'v_prof.role <> ''professeur''',
       'v_prof.role not in (''professeur'',''directeur'',''responsable_administratif'')'),
      ('public.supprimer_brouillon_preparation(date,text)',
       'v_prof.role <> ''professeur''',
       'v_prof.role not in (''professeur'',''directeur'',''responsable_administratif'')'),
      ('public.nettoyer_sequences_preparation(uuid[],date,smallint,smallint)',
       'v_prof.role <> ''professeur''',
       'v_prof.role not in (''professeur'',''directeur'',''responsable_administratif'')'),
      ('public.lire_mon_agenda(timestamptz,timestamptz)',
       'v_user.role <> ''professeur''',
       'v_user.role not in (''professeur'',''directeur'',''responsable_administratif'')'),
      ('public.sauver_mon_evenement_agenda(uuid,text,text,timestamptz,integer)',
       'v_user.role <> ''professeur''',
       'v_user.role not in (''professeur'',''directeur'',''responsable_administratif'')'),
      ('public.supprimer_mon_evenement_agenda(uuid)',
       'v_user.role <> ''professeur''',
       'v_user.role not in (''professeur'',''directeur'',''responsable_administratif'')'),
      ('public.traiter_mes_rappels_agenda()',
       'v_user.role <> ''professeur''',
       'v_user.role not in (''professeur'',''directeur'',''responsable_administratif'')')
    ) as f(signature, ancienne_garde, nouvelle_garde)
  loop
    v_oid := to_regprocedure(r.signature);
    if v_oid is null then
      raise exception 'fonction_requise_absente: %', r.signature;
    end if;

    v_definition := pg_get_functiondef(v_oid);

    -- Idempotence : une fonction deja migree est acceptee sans la reecrire.
    if strpos(v_definition, r.nouvelle_garde) > 0 then
      continue;
    end if;

    v_nombre := (length(v_definition) - length(replace(v_definition, r.ancienne_garde, '')))
                / length(r.ancienne_garde);
    if v_nombre <> 1 then
      raise exception 'garde_inattendue: % (% occurrence(s))', r.signature, v_nombre;
    end if;

    execute replace(v_definition, r.ancienne_garde, r.nouvelle_garde);
  end loop;
end
$migration$;

commit;

-- Controle attendu : huit lignes, toutes a true.
select p.proname as fonction,
       strpos(
         p.prosrc,
         'not in (''professeur'',''directeur'',''responsable_administratif'')'
       ) > 0 as roles_enseignants_ouverts
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'lire_brouillon_preparation',
     'sauver_brouillon_preparation',
     'supprimer_brouillon_preparation',
     'nettoyer_sequences_preparation',
     'lire_mon_agenda',
     'sauver_mon_evenement_agenda',
     'supprimer_mon_evenement_agenda',
     'traiter_mes_rappels_agenda'
   )
 order by p.proname;
