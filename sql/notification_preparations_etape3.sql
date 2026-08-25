-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 — TESTS A, D, F, E, B, C
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Pourquoi cette version n'utilise plus de table temporaire ──────────
--
-- La première tentative rangeait les résultats dans `_resultats`, une TEMP
-- TABLE, et le SELECT final répondait 42P01 « relation does not exist ».
--
-- Une table temporaire vit dans le schéma `pg_temp_N` de la session. Un
-- rôle qui n'a pas USAGE sur ce schéma ne la voit pas — et PostgreSQL
-- n'annonce pas « permission refusée » : il SAUTE simplement le schéma
-- pendant la résolution du nom, et conclut que la table n'existe pas.
-- 42P01, pas 42501. Les tests endossent `authenticated` puis `anon` ; il
-- suffit qu'un `reset role` n'ait pas repris effet pour que la table
-- devienne invisible sans jamais avoir disparu.
--
-- `on commit drop` ajoutait une seconde fragilité : si l'éditeur ne tient
-- pas une transaction unique sur l'ensemble du script, la table est
-- détruite dès la fin de sa propre instruction.
--
-- Les deux causes tiennent au même choix : faire dépendre les résultats
-- d'un OBJET DE SCHÉMA, dont la visibilité change avec le rôle et la
-- transaction. On les range désormais dans un PARAMÈTRE DE SESSION : ce
-- n'est pas un objet, aucun rôle n'a besoin de droits dessus, et
-- `set_config(..., true)` le limite à la transaction.
--
-- Tous les tests tiennent en outre dans UN SEUL bloc `do`, donc une seule
-- instruction : plus rien ne dépend de ce qui survit d'une instruction à
-- l'autre.
--
-- Aucun COMMIT. Aucune policy. Aucun GRANT. Aucune fixture persistante.

begin;

do $$
declare
  res        jsonb := '[]'::jsonb;
  r          jsonb;
  v          text;
  ok         boolean;
  v_args     text;
  v_boites   integer;
  ORNELLA    constant text := 'e9ce36c7-4fce-41e1-8dac-29234253fdb9';
  BINTOU     constant text := '4825b2a2-3f4b-4aab-aa66-b356285cff99';
  PREP_MOI   constant uuid := '9a0dae7e-048b-41e0-b620-228371c3cd50';
  PREP_AUTRE constant uuid := '9a2ab973-11bf-439d-96d5-9bea0f5b7c88';
  ID_CYCLE0  constant text := 'prep-9a0dae7e-048b-41e0-b620-228371c3cd50-0';
begin
  -- ── A · l'enseignante propriétaire notifie sa préparation ────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || ORNELLA || '"}', true);
  r := null;
  begin
    r := public.notifier_preparation(PREP_MOI);
    v := r::text;
  exception when others then
    v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  res := res || jsonb_build_array(jsonb_build_object(
    'ordre', 1, 'test', 'A · la propriétaire notifie sa préparation',
    'attendu', 'cree=true · evenement=depot · cycle=0 · 2 boîtes servies',
    'obtenu', v,
    'verdict', case when coalesce(r->>'cree','') = 'true'
                     and coalesce(r->>'evenement','') = 'depot'
                     and coalesce(r->>'cycle','') = '0'
                     and jsonb_array_length(coalesce(r->'deposee_chez','[]'::jsonb)) = 2
                    then 'PASS' else 'FAIL' end));

  -- ── D · double appel sur le même cycle ───────────────────────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || ORNELLA || '"}', true);
  r := null;
  begin
    r := public.notifier_preparation(PREP_MOI);
    v := r::text;
  exception when others then
    v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  res := res || jsonb_build_array(jsonb_build_object(
    'ordre', 2, 'test', 'D · double appel, même cycle',
    'attendu', 'cree=false · deposee_chez=[] · deja_notifiee=2',
    'obtenu', v,
    'verdict', case when coalesce(r->>'cree','') = 'false'
                     and jsonb_array_length(coalesce(r->'deposee_chez','[]'::jsonb)) = 0
                     and jsonb_array_length(coalesce(r->'deja_notifiee','[]'::jsonb)) = 2
                    then 'PASS' else 'FAIL' end));

  -- ── F · le destinataire est décidé par le serveur ────────────────────
  -- Deux preuves : la signature n'offre aucun paramètre de destinataire,
  -- et la notification est arrivée dans les DEUX boîtes de direction sans
  -- que personne ne les ait nommées.
  select pg_get_function_arguments(p.oid) into v_args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'notifier_preparation';

  select count(*) into v_boites
    from public.app_state a
   where a.app = 'notifications'
     and a.key in ('notifs_directeur', 'notifs_responsable_administratif')
     and exists (select 1 from jsonb_array_elements(a.value) n
                  where n->>'id' = ID_CYCLE0);

  res := res || jsonb_build_array(jsonb_build_object(
    'ordre', 3, 'test', 'F · destinataire décidé côté serveur',
    'attendu', 'signature=(p_preparation_id uuid) · boîtes servies=2',
    'obtenu', 'signature=(' || coalesce(v_args,'ABSENTE') || ') · boîtes servies=' || v_boites,
    'verdict', case when v_args = 'p_preparation_id uuid' and v_boites = 2
                    then 'PASS' else 'FAIL' end));

  -- ── FIXTURE · une demande de correction, annulée par le rollback ─────
  update public.preparations
     set historique_statuts = coalesce(historique_statuts, '[]'::jsonb)
       || jsonb_build_array(jsonb_build_object(
            'le', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'par', '00000000-0000-0000-0000-000000000000',
            'action', 'correction_demandee',
            'statut', 'a_corriger',
            'par_nom', 'FIXTURE DE TEST',
            'commentaire', 'FIXTURE — annulée par le rollback'))
   where id = PREP_MOI;

  -- ── E · nouveau cycle après correction ───────────────────────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || ORNELLA || '"}', true);
  r := null;
  begin
    r := public.notifier_preparation(PREP_MOI);
    v := r::text;
  exception when others then
    v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  res := res || jsonb_build_array(jsonb_build_object(
    'ordre', 4, 'test', 'E · nouveau cycle après correction',
    'attendu', 'cree=true · evenement=resoumission · cycle=1 · identifiant ≠ celui de A',
    'obtenu', v,
    'verdict', case when coalesce(r->>'cree','') = 'true'
                     and coalesce(r->>'evenement','') = 'resoumission'
                     and coalesce(r->>'cycle','') = '1'
                     and coalesce(r->>'notification','') <> ID_CYCLE0
                    then 'PASS' else 'FAIL' end));

  -- ── B · une préparation qui ne lui appartient pas ────────────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || BINTOU || '"}', true);
  ok := false;
  begin
    r := public.notifier_preparation(PREP_AUTRE);
    v := 'ACCEPTÉ — ' || r::text;
  exception
    when insufficient_privilege then
      v := 'refusé · ' || sqlstate || ' · ' || sqlerrm; ok := true;
    when others then
      v := 'refusé pour une autre raison · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  res := res || jsonb_build_array(jsonb_build_object(
    'ordre', 5, 'test', 'B · préparation d''une autre enseignante',
    'attendu', 'refus 42501 · preparation_d_un_autre_enseignant',
    'obtenu', v,
    'verdict', case when ok then 'PASS' else 'FAIL' end));

  -- ── C · session anonyme ──────────────────────────────────────────────
  execute 'set local role anon';
  ok := false;
  begin
    r := public.notifier_preparation(PREP_MOI);
    v := 'ACCEPTÉ — ' || r::text;
  exception when others then
    v := 'refusé · ' || sqlstate || ' · ' || sqlerrm; ok := true;
  end;
  execute 'reset role';
  res := res || jsonb_build_array(jsonb_build_object(
    'ordre', 6, 'test', 'C · session anonyme',
    'attendu', 'refus — anon n''a pas EXECUTE sur la fonction',
    'obtenu', v,
    'verdict', case when ok then 'PASS' else 'FAIL' end));

  -- Les résultats ne sont pas un objet de schéma : aucun rôle n'a besoin
  -- de droits pour les relire, et la transaction les emporte.
  perform set_config('ideal.resultats_tests', res::text, true);
end
$$;

-- Le rôle est explicitement rendu avant la lecture : c'est la précaution
-- qui manquait à la version précédente.
reset role;

select (t->>'ordre')::int as n,
       t->>'test'     as test,
       t->>'verdict'  as verdict,
       t->>'attendu'  as attendu,
       t->>'obtenu'   as obtenu
  from jsonb_array_elements(current_setting('ideal.resultats_tests')::jsonb) t
 order by 1;

rollback;
