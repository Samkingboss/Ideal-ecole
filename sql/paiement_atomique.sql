-- ═══════════════════════════════════════════════════════════════════════
-- ENCAISSER SANS JAMAIS PERDRE UN PAIEMENT
-- ═══════════════════════════════════════════════════════════════════════
--
-- ── Le problème, mesuré ────────────────────────────────────────────────
--
-- Toute la comptabilité tient dans UNE ligne — `financement_params` où
-- `id = 'main'` — réécrite en entier à chaque modification.
--
--   Yacouba lit la version 10        Le directeur lit la version 10
--   encaisse 30 000  → écrit v11     encaisse 50 000 → écrit v11 bis
--                                     depuis SA copie de la v10
--   → les 30 000 ont disparu. Sans erreur. Sans message.
--
-- Reproduit deux fois avec deux navigateurs : 30 000 et 50 000 encaissés,
-- 30 000 en base.
--
-- ── Ce qui a déjà été fait côté client, et pourquoi cela ne suffit pas ──
--
-- Une écriture conditionnelle a été posée : « mets à jour seulement si
-- `updated_at` vaut encore ce que j'ai lu », sinon recharger et rejouer.
-- Prouvé en isolation : version périmée forcée, conflit détecté, paiement
-- rejoué, 30 000 + 11 000 = 41 000, rien de perdu.
--
-- Mais la fenêtre entre la relecture et la réécriture reste ouverte : deux
-- appareils peuvent encore s'y croiser. Un verrou côté navigateur ne
-- ferme pas une course entre deux téléphones.
--
-- ── Ce que fait cette fonction ─────────────────────────────────────────
--
-- Elle déplace l'ajout du paiement dans la base, où il devient indivisible.
-- `for update` verrouille la ligne : le second appelant attend, lit l'état
-- que le premier vient d'écrire, et ajoute son paiement par-dessus. Aucune
-- course, aucune relecture, aucun rejeu.
--
-- Le client n'envoie plus l'état entier : il envoie UN paiement.
--
-- ── Ce qu'elle ne fait pas ─────────────────────────────────────────────
--
-- Aucune table créée, aucune colonne ajoutée, aucune donnée déplacée.
-- Le document JSON reste la source ; c'est SA MODIFICATION qui devient
-- atomique. Les paramètres (charges, salaires, plan comptable) continuent
-- de passer par l'écriture globale : eux ne sont pas de l'argent reçu.
--
-- NON DESTRUCTIF. Réversible : `drop function` suffit, le client sait
-- encore écrire comme avant.

begin;

create or replace function public.enregistrer_paiement(
  p_matricule   text,
  p_montant     integer,
  p_mode        text,
  p_motif       text,
  p_recu        text,
  p_date_lisible text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi     public.users;
  v_etat    jsonb;
  v_eleves  jsonb;
  v_eleve   jsonb;
  v_index   integer := -1;
  v_i       integer;
  v_paiement jsonb;
  v_deja    boolean := false;
begin
  -- 1 · Qui encaisse. Lu dans le jeton, jamais reçu du client.
  select u.* into v_moi
    from public.users u
   where u.auth_user_id = auth.uid() and u.actif = true
   limit 1;

  if v_moi.id is null then
    raise exception 'session_non_authentifiee' using errcode = '28000';
  end if;

  -- 2 · Seule la direction encaisse. Un enseignant connecté ne peut pas.
  if not public.ideal_est(array['directeur', 'responsable_administratif']) then
    raise exception 'encaissement_reserve_a_la_direction' using errcode = '42501';
  end if;

  if p_montant is null or p_montant <= 0 then
    raise exception 'montant_invalide' using errcode = '22023';
  end if;

  -- 3 · LE VERROU. Tout ce qui suit est indivisible : un second appelant
  --     attend ici, puis repart de l'état que nous aurons écrit.
  select fp.state_json into v_etat
    from public.financement_params fp
   where fp.id = 'main'
     for update;

  if v_etat is null then
    raise exception 'comptabilite_introuvable' using errcode = 'P0002';
  end if;

  v_eleves := coalesce(v_etat->'students', '[]'::jsonb);

  -- 4 · Retrouver l'élève par son matricule, la seule clé stable.
  for v_i in 0 .. jsonb_array_length(v_eleves) - 1 loop
    if v_eleves->v_i->>'matricule' = p_matricule then
      v_index := v_i;
      v_eleve := v_eleves->v_i;
      exit;
    end if;
  end loop;

  if v_index < 0 then
    raise exception 'eleve_absent_de_la_comptabilite' using errcode = 'P0002';
  end if;

  -- 5 · Idempotence : ce reçu est-il déjà enregistré ? Un renvoi après une
  --     réponse perdue ne doit pas encaisser deux fois.
  select exists (
    select 1 from jsonb_array_elements(coalesce(v_eleve->'history', '[]'::jsonb)) h
     where h->>'receiptId' = p_recu
  ) into v_deja;

  if v_deja then
    return jsonb_build_object('ok', true, 'cree', false, 'raison', 'deja_enregistre',
                              'recu', p_recu,
                              'paye', coalesce((v_eleve->>'paye')::numeric, 0));
  end if;

  v_paiement := jsonb_build_object(
    'amount',  p_montant,
    'mode',    p_mode,
    'motif',   p_motif,
    'date',    p_date_lisible,
    'receiptId', p_recu,
    'le',      to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'par',     v_moi.id::text,
    'par_nom', trim(coalesce(v_moi.prenom,'') || ' ' || coalesce(v_moi.nom,'')),
    'par_role', v_moi.role
  );

  -- 6 · Ajouter le paiement et recalculer le total DEPUIS l'historique.
  --     `paye` cesse d'être un compteur tenu à la main : il est dérivé.
  v_eleve := jsonb_set(v_eleve, '{history}',
               coalesce(v_eleve->'history', '[]'::jsonb) || jsonb_build_array(v_paiement));
  v_eleve := jsonb_set(v_eleve, '{paye}', to_jsonb((
               select coalesce(sum((h->>'amount')::numeric), 0)
                 from jsonb_array_elements(v_eleve->'history') h
                where coalesce((h->>'cancelled')::boolean, false) = false)));

  v_etat := jsonb_set(v_etat, array['students', v_index::text], v_eleve);

  update public.financement_params
     set state_json = v_etat,
         updated_at = now()
   where id = 'main';

  return jsonb_build_object(
    'ok', true, 'cree', true, 'recu', p_recu,
    'paye', (v_eleve->>'paye')::numeric,
    'operations', jsonb_array_length(v_eleve->'history'),
    'par', v_paiement->>'par_nom'
  );
end
$function$;

comment on function public.enregistrer_paiement(text,integer,text,text,text,text) is
  'Ajoute UN paiement a la comptabilite, sous verrou de ligne. Le client '
  'n''envoie plus l''etat entier : deux encaissements simultanes ne peuvent '
  'plus s''ecraser. Auteur lu dans auth.uid(), total recalcule depuis '
  'l''historique, idempotent sur le numero de recu.';

revoke all on function public.enregistrer_paiement(text,integer,text,text,text,text)
  from public, anon;
grant execute on function public.enregistrer_paiement(text,integer,text,text,text,text)
  to authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- V1 — la fonction, sa sécurité, ses six paramètres.
select p.pronargs, pg_get_function_arguments(p.oid) as parametres,
       case when p.prosecdef then 'definer' else 'invoker' end as securite
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'enregistrer_paiement';
-- ATTENDU : 6 | p_matricule text, p_montant integer, p_mode text,
--               p_motif text, p_recu text, p_date_lisible text | definer

-- V2 — qui peut l'exécuter. `anon` ne doit PAS y figurer.
select grantee, privilege_type
  from information_schema.role_routine_grants
 where routine_schema = 'public' and routine_name = 'enregistrer_paiement'
 order by grantee;
-- ATTENDU : authenticated, postgres, service_role. Jamais anon, jamais PUBLIC.
