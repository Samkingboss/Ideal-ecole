-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 — TESTS DE SÉCURITÉ, D'IDEMPOTENCE ET DE CYCLE
-- ═══════════════════════════════════════════════════════════════════════
-- Tout est entre begin et rollback : RIEN n'est écrit.
-- Chaque test range son résultat dans une table temporaire ; la grille
-- finale s'affiche juste avant le rollback.
-- Aucun mot de passe, aucune policy touchée, aucun GRANT touché.

begin;

create temp table _resultats (
  ordre int, test text, attendu text, obtenu text, verdict text
) on commit drop;

create temp table _avant on commit drop as
  select key, jsonb_array_length(value) as entrees, updated_at
    from public.app_state
   where app = 'notifications'
     and key in ('notifs_directeur', 'notifs_responsable_administratif');

-- ── A · l'enseignante propriétaire notifie sa préparation ──────────────
do $$
declare r jsonb; v text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"e9ce36c7-4fce-41e1-8dac-29234253fdb9"}', true);
  begin
    r := public.notifier_preparation('9a0dae7e-048b-41e0-b620-228371c3cd50');
    v := r::text;
  exception when others then v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  insert into _resultats values (1, 'A · propriétaire notifie sa préparation',
    'cree=true, evenement=depot, cycle=0, deposee_chez=2 boîtes', v,
    case when r->>'cree' = 'true' and r->>'evenement' = 'depot'
              and r->>'cycle' = '0' then 'PASS' else 'FAIL' end);
end $$;

-- ── D · double appel sur le même cycle ─────────────────────────────────
do $$
declare r jsonb; v text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"e9ce36c7-4fce-41e1-8dac-29234253fdb9"}', true);
  begin
    r := public.notifier_preparation('9a0dae7e-048b-41e0-b620-228371c3cd50');
    v := r::text;
  exception when others then v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  insert into _resultats values (2, 'D · double appel, même cycle',
    'cree=false, deposee_chez=[], deja_notifiee=2 boîtes', v,
    case when r->>'cree' = 'false'
              and jsonb_array_length(r->'deja_notifiee') = 2 then 'PASS' else 'FAIL' end);
end $$;

-- ── F · le destinataire est décidé par le serveur ──────────────────────
-- Deux preuves : la signature n'offre aucun paramètre de destinataire, et
-- la notification est bien arrivée dans les DEUX boîtes de direction sans
-- que personne ne les ait nommées.
do $$
declare v_args text; v_boites int; v_id text;
begin
  select pg_get_function_arguments(p.oid) into v_args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'notifier_preparation';

  v_id := 'prep-9a0dae7e-048b-41e0-b620-228371c3cd50-0';

  select count(*) into v_boites
    from public.app_state a
   where a.app = 'notifications'
     and a.key in ('notifs_directeur', 'notifs_responsable_administratif')
     and exists (select 1 from jsonb_array_elements(a.value) n where n->>'id' = v_id);

  insert into _resultats values (3, 'F · destinataire décidé côté serveur',
    'signature = (p_preparation_id uuid) et 2 boîtes servies',
    'signature=(' || v_args || ') · boîtes servies=' || v_boites,
    case when v_args = 'p_preparation_id uuid' and v_boites = 2
         then 'PASS' else 'FAIL' end);
end $$;

-- ── FIXTURE · une demande de correction, annulée par le rollback ───────
update public.preparations
   set historique_statuts = coalesce(historique_statuts, '[]'::jsonb)
     || jsonb_build_array(jsonb_build_object(
          'le', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'par', '00000000-0000-0000-0000-000000000000',
          'action', 'correction_demandee',
          'statut', 'a_corriger',
          'par_nom', 'FIXTURE DE TEST',
          'commentaire', 'FIXTURE — annulée par le rollback'))
 where id = '9a0dae7e-048b-41e0-b620-228371c3cd50';

-- ── E · nouveau cycle après correction ─────────────────────────────────
do $$
declare r jsonb; v text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"e9ce36c7-4fce-41e1-8dac-29234253fdb9"}', true);
  begin
    r := public.notifier_preparation('9a0dae7e-048b-41e0-b620-228371c3cd50');
    v := r::text;
  exception when others then v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  insert into _resultats values (4, 'E · nouveau cycle après correction',
    'cree=true, evenement=resoumission, cycle=1, identifiant différent de A', v,
    case when r->>'cree' = 'true' and r->>'evenement' = 'resoumission'
              and r->>'cycle' = '1'
              and r->>'notification' <> 'prep-9a0dae7e-048b-41e0-b620-228371c3cd50-0'
         then 'PASS' else 'FAIL' end);
end $$;

-- ── B · une préparation qui ne lui appartient pas ──────────────────────
do $$
declare r jsonb; v text; ok boolean := false;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"4825b2a2-3f4b-4aab-aa66-b356285cff99"}', true);
  begin
    r := public.notifier_preparation('9a2ab973-11bf-439d-96d5-9bea0f5b7c88');
    v := 'ACCEPTÉ — ' || r::text;
  exception when insufficient_privilege then
    v := 'refusé · 42501 · ' || sqlerrm; ok := true;
  when others then
    v := 'refusé · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  insert into _resultats values (5, 'B · préparation d''une autre enseignante',
    'refus 42501 · preparation_d_un_autre_enseignant', v,
    case when ok then 'PASS' else 'FAIL' end);
end $$;

-- ── C · session anonyme ────────────────────────────────────────────────
do $$
declare r jsonb; v text; ok boolean := false;
begin
  execute 'set local role anon';
  begin
    r := public.notifier_preparation('9a0dae7e-048b-41e0-b620-228371c3cd50');
    v := 'ACCEPTÉ — ' || r::text;
  exception when others then
    v := 'refusé · ' || sqlstate || ' · ' || sqlerrm; ok := true;
  end;
  execute 'reset role';
  insert into _resultats values (6, 'C · session anonyme',
    'refus — anon n''a pas EXECUTE', v,
    case when ok then 'PASS' else 'FAIL' end);
end $$;

-- ── GRILLE ─────────────────────────────────────────────────────────────
select ordre, test, attendu, obtenu, verdict
  from _resultats order by ordre;

rollback;

-- ── G · rien n'a persisté ──────────────────────────────────────────────
-- À exécuter APRÈS le rollback. Les deux boîtes doivent être exactement
-- dans l'état d'avant : même nombre d'entrées, même `updated_at`.
select key,
       jsonb_array_length(value) as entrees,
       updated_at,
       (select count(*) from jsonb_array_elements(value) n
         where n->>'ref' = '9a0dae7e-048b-41e0-b620-228371c3cd50') as traces_de_test
  from public.app_state
 where app = 'notifications'
   and key in ('notifs_directeur', 'notifs_responsable_administratif')
 order by key;

-- La fixture de correction ne doit pas subsister non plus.
select id,
       jsonb_array_length(coalesce(historique_statuts, '[]'::jsonb)) as evenements,
       (select count(*) from jsonb_array_elements(coalesce(historique_statuts,'[]'::jsonb)) e
         where e->>'par_nom' = 'FIXTURE DE TEST') as fixtures_restantes
  from public.preparations
 where id = '9a0dae7e-048b-41e0-b620-228371c3cd50';
