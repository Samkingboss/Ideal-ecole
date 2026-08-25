-- ═══════════════════════════════════════════════════════════════════════
-- PREUVES FONCTIONNELLES DE `enregistrer_paiement`
-- ═══════════════════════════════════════════════════════════════════════
--
-- Tout est entre begin et rollback : RIEN n'est écrit.
-- L'identité est endossée comme le fait PostgREST — `set local role` plus
-- `request.jwt.claims` — sans aucun mot de passe.
-- Les résultats vont dans un paramètre de session, pas dans une table
-- temporaire : un rôle sans USAGE sur `pg_temp` ne la verrait pas.
--
-- Ce bloc prouve : paiement partiel, second versement, idempotence, total
-- dérivé, refus d'un rôle non autorisé, refus d'un montant invalide.
--
-- Il NE prouve PAS la concurrence : deux transactions simultanées exigent
-- deux connexions, ce qu'un onglet d'éditeur SQL ne peut pas fournir.

begin;

do $$
declare
  res      jsonb := '[]'::jsonb;
  r        jsonb;
  v        text;
  ok       boolean;
  v_paye   numeric;
  YACOUBA  constant text := '5f92ec77-9127-422f-91f6-ebb022b986aa';
  ORNELLA  constant text := 'e9ce36c7-4fce-41e1-8dac-29234253fdb9';
  MAT      constant text := '26-27 A008';
  n        integer := 0;
  base     numeric;
begin
  -- État de départ, pour que les écarts soient lisibles.
  select coalesce((s->>'paye')::numeric, 0) into base
    from public.financement_params fp,
         jsonb_array_elements(fp.state_json->'students') s
   where fp.id = 'main' and s->>'matricule' = MAT;

  -- ── 1 · paiement partiel par le responsable administratif ────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || YACOUBA || '"}', true);
  begin
    r := public.enregistrer_paiement(MAT, 200000, 'Espèces',
           'Droits d''Inscription + Fournitures', 'TEST-REC-1', '25/08/2026 à 10h00');
    v := r::text;
  exception when others then v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  n := n + 1;
  res := res || jsonb_build_array(jsonb_build_object('ordre', n,
    'test', '1 · paiement partiel par le responsable administratif',
    'attendu', 'cree=true · paye=' || (base + 200000)::text || ' · auteur Yacouba',
    'obtenu', v,
    'verdict', case when coalesce(r->>'cree','') = 'true'
                     and (r->>'paye')::numeric = base + 200000
                     and r->>'par' = 'Yacouba OUANGRAOUA'
                    then 'PASS' else 'FAIL' end));

  -- ── 2 · second versement, cumul ──────────────────────────────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || YACOUBA || '"}', true);
  begin
    r := public.enregistrer_paiement(MAT, 150000, 'Wave',
           'Scolarité - Trimestre 1', 'TEST-REC-2', '25/08/2026 à 10h05');
    v := r::text;
  exception when others then v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  n := n + 1;
  res := res || jsonb_build_array(jsonb_build_object('ordre', n,
    'test', '2 · second versement, cumul',
    'attendu', 'cree=true · paye=' || (base + 350000)::text || ' · la première opération subsiste',
    'obtenu', v,
    'verdict', case when coalesce(r->>'cree','') = 'true'
                     and (r->>'paye')::numeric = base + 350000
                    then 'PASS' else 'FAIL' end));

  -- ── 3 · idempotence : le MÊME reçu renvoyé ───────────────────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || YACOUBA || '"}', true);
  begin
    r := public.enregistrer_paiement(MAT, 150000, 'Wave',
           'Scolarité - Trimestre 1', 'TEST-REC-2', '25/08/2026 à 10h05');
    v := r::text;
  exception when others then v := 'REFUSÉ · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  n := n + 1;
  res := res || jsonb_build_array(jsonb_build_object('ordre', n,
    'test', '3 · même reçu renvoyé — retry, réponse perdue',
    'attendu', 'cree=false · raison=deja_enregistre · paye INCHANGÉ',
    'obtenu', v,
    'verdict', case when coalesce(r->>'cree','') = 'false'
                     and r->>'raison' = 'deja_enregistre'
                     and (r->>'paye')::numeric = base + 350000
                    then 'PASS' else 'FAIL' end));

  -- ── 4 · le total est DÉRIVÉ de l'historique, pas tenu à la main ──────
  select coalesce(sum((h->>'amount')::numeric), 0) into v_paye
    from public.financement_params fp,
         jsonb_array_elements(fp.state_json->'students') s,
         jsonb_array_elements(s->'history') h
   where fp.id = 'main' and s->>'matricule' = MAT
     and coalesce((h->>'cancelled')::boolean, false) = false;
  n := n + 1;
  res := res || jsonb_build_array(jsonb_build_object('ordre', n,
    'test', '4 · le total est dérivé de l''historique',
    'attendu', 'somme des opérations = champ paye',
    'obtenu', 'somme=' || v_paye::text || ' · paye=' || (r->>'paye'),
    'verdict', case when v_paye = (r->>'paye')::numeric then 'PASS' else 'FAIL' end));

  -- ── 5 · une enseignante ne peut pas encaisser ────────────────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || ORNELLA || '"}', true);
  ok := false;
  begin
    r := public.enregistrer_paiement(MAT, 99000, 'Espèces',
           'Régularisation Globale', 'TEST-REC-INTERDIT', '25/08/2026 à 11h00');
    v := 'ACCEPTÉ — ' || r::text;
  exception when insufficient_privilege then
    v := 'refusé · ' || sqlstate || ' · ' || sqlerrm; ok := true;
  when others then
    v := 'refusé pour une autre raison · ' || sqlstate || ' · ' || sqlerrm;
  end;
  execute 'reset role';
  n := n + 1;
  res := res || jsonb_build_array(jsonb_build_object('ordre', n,
    'test', '5 · une enseignante tente d''encaisser',
    'attendu', 'refus 42501 · encaissement_reserve_a_la_direction',
    'obtenu', v,
    'verdict', case when ok then 'PASS' else 'FAIL' end));

  -- ── 6 · session anonyme ──────────────────────────────────────────────
  execute 'set local role anon';
  ok := false;
  begin
    r := public.enregistrer_paiement(MAT, 1000, 'Espèces', 'x', 'TEST-REC-ANON', 'x');
    v := 'ACCEPTÉ — ' || r::text;
  exception when others then
    v := 'refusé · ' || sqlstate || ' · ' || sqlerrm; ok := true;
  end;
  execute 'reset role';
  n := n + 1;
  res := res || jsonb_build_array(jsonb_build_object('ordre', n,
    'test', '6 · session anonyme',
    'attendu', 'refus — anon n''a pas EXECUTE',
    'obtenu', v,
    'verdict', case when ok then 'PASS' else 'FAIL' end));

  -- ── 7 · montant invalide ─────────────────────────────────────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{"sub":"' || YACOUBA || '"}', true);
  ok := false;
  begin
    r := public.enregistrer_paiement(MAT, 0, 'Espèces', 'x', 'TEST-REC-ZERO', 'x');
    v := 'ACCEPTÉ — ' || r::text;
  exception when others then v := 'refusé · ' || sqlstate || ' · ' || sqlerrm; ok := true;
  end;
  execute 'reset role';
  n := n + 1;
  res := res || jsonb_build_array(jsonb_build_object('ordre', n,
    'test', '7 · montant nul ou négatif',
    'attendu', 'refus · montant_invalide',
    'obtenu', v,
    'verdict', case when ok then 'PASS' else 'FAIL' end));

  perform set_config('ideal.resultats_paiement', res::text, true);
end
$$;

reset role;

select (t->>'ordre')::int as n,
       t->>'test'    as test,
       t->>'verdict' as verdict,
       t->>'attendu' as attendu,
       t->>'obtenu'  as obtenu
  from jsonb_array_elements(current_setting('ideal.resultats_paiement')::jsonb) t
 order by 1;

rollback;
