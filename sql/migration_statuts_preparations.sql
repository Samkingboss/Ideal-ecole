-- Normalisation des 17 statuts de préparation.
--
-- Mapping validé par le promoteur le 18 août 2026, déduit des données :
--
--     acceptable        →  deposee      14 dossiers
--     depose            →  en_retard     2 dossiers
--     rejeté (retard)   →  en_retard     1 dossier
--                                       ──
--                                       17
--
-- Aucun dossier ne devient brouillon, a_corriger ni validee : les 17 lignes
-- ont `note_directeur`, `corrige_par`, `corrige_le` et `commentaire_directeur`
-- vides, donc aucune n'a jamais été contrôlée par un humain. Écrire `validee`
-- inventerait une validation qui n'a pas eu lieu.
--
-- Les deux `depose` deviennent `en_retard` parce qu'elles ont été déposées le
-- 12 août pour des cours du 10 août — 51 h et 55 h après le début du cours.
-- Sous la règle validée (`heures_avant_cours = 0`), elles sont en retard ;
-- l'ancien libellé était simplement muet sur la ponctualité.
--
-- Ce script n'écrit QUE deux colonnes : `status` et `historique_statuts`.
-- `note_ia` et `commentaire_ia` sont conservées telles quelles — ce sont des
-- données historiques d'échec d'analyse, pas des validations pédagogiques.
-- `retard_minutes` n'est pas renseignée : évolution séparée, sur décision du
-- promoteur.
--
-- Structures lues dans le dépôt, non supposées :
--   · table  public.preparations, 23 colonnes
--   · colonne historique_statuts jsonb not null default '[]'::jsonb
--     (sql/preparations_workflow.sql:122)
--   · forme d'une entrée, fixée par ajouterHistorique() dans
--     src/lib/preparations.js : { statut, action, commentaire, le, par, par_nom }


-- ════════════════════════════════════════════════════════════════════════
--  ÉTAPE A — AUDIT AVANT MIGRATION
--  N'écrit rien. Si les comptes ne sont pas exactement 14 / 2 / 1 = 17,
--  NE PAS exécuter l'étape C.
-- ════════════════════════════════════════════════════════════════════════

-- A.1 — Les 17 lignes, une par une.
select
  id,
  status                                   as ancien_statut,
  heure_depot,
  date_cours,
  heure_cours,
  note_ia,
  commentaire_ia,
  case when contenu is not null then 'fiche' else 'fichier' end as voie,
  (note_directeur is null and corrige_par is null
   and corrige_le is null and commentaire_directeur is null)    as jamais_controlee
from public.preparations
order by status, date_cours, heure_cours;

-- A.2 — Tous les comptages en une seule ligne de résultat.
--       Le SQL Editor n'affiche que la grille de la dernière instruction :
--       regrouper évite de perdre les contrôles précédents.
--
--       Attendu exactement :
--         total 17 | acceptable 14 | depose 2 | rejete_retard 1
--         deja_normalisees 0 | migrations_anterieures 0
--
--       Si un seul chiffre diffère, NE PAS exécuter l'étape C.
select
  count(*)                                            as total,
  count(*) filter (where status = 'acceptable')       as acceptable,
  count(*) filter (where status = 'depose')           as depose,
  count(*) filter (where status = 'rejeté (retard)')  as rejete_retard,
  count(*) filter (where status in ('brouillon','deposee','en_retard',
                                    'a_corriger','validee'))          as deja_normalisees,
  count(*) filter (where historique_statuts
                         @> '[{"action":"migration"}]'::jsonb)        as migrations_anterieures
from public.preparations;

-- A.3 — Le détail par statut, si vous voulez le voir ventilé.
select status as ancien_statut, count(*) as lignes
  from public.preparations
 group by status
 order by count(*) desc;

-- A.3 — Total attendu : 17.
select count(*) as total from public.preparations;

-- A.4 — Aucune ligne ne doit déjà porter un statut de la nouvelle
--       nomenclature. Attendu : 0.
select count(*) as deja_normalisees
  from public.preparations
 where status in ('brouillon','deposee','en_retard','a_corriger','validee');

-- A.5 — Aucune trace de migration antérieure. Attendu : 0.
select count(*) as migrations_anterieures
  from public.preparations
 where historique_statuts @> '[{"action":"migration"}]'::jsonb;


-- ════════════════════════════════════════════════════════════════════════
--  ÉTAPE B — SNAPSHOT AVANT MIGRATION
--  À exécuter et à conserver (export CSV depuis le SQL Editor) avant
--  l'étape C. N'écrit rien, ne supprime rien.
-- ════════════════════════════════════════════════════════════════════════

-- B.1 — Snapshot lisible, toutes colonnes utiles à un contrôle d'intégrité.
select
  id, user_id, classe_id, groupe, matiere, sequence,
  status                      as statut_avant,
  date_cours, heure_cours, heure_depot,
  note_ia, commentaire_ia,
  note_directeur, commentaire_directeur, corrige_par, corrige_le,
  url_doc,
  contenu,
  retard_minutes,
  pieces_jointes, historique_statuts, appreciations, verrouillee_le
from public.preparations
order by id;

-- B.2 — Empreinte des colonnes qui ne doivent PAS bouger. Notez la valeur :
--       elle devra être identique après migration (§ E.7).
select md5(string_agg(
         id::text
         || '|' || coalesce(note_ia::text, '~')
         || '|' || coalesce(commentaire_ia, '~')
         || '|' || coalesce(contenu::text, '~')
         || '|' || coalesce(url_doc, '~')
         || '|' || coalesce(heure_depot::text, '~')
         || '|' || coalesce(retard_minutes::text, '~')
         || '|' || coalesce(user_id::text, '~')
         || '|' || coalesce(classe_id::text, '~')
         || '|' || coalesce(date_cours::text, '~')
         || '|' || coalesce(heure_cours::text, '~')
         || '|' || coalesce(matiere, '~')
         || '|' || coalesce(groupe, '~')
         || '|' || coalesce(sequence::text, '~')
         || '|' || coalesce(note_directeur::text, '~')
         || '|' || coalesce(commentaire_directeur, '~')
         || '|' || coalesce(corrige_par::text, '~')
         || '|' || coalesce(corrige_le::text, '~')
         || '|' || coalesce(pieces_jointes::text, '~')
         || '|' || coalesce(appreciations::text, '~')
         || '|' || coalesce(verrouillee_le::text, '~')
       , E'\n' order by id)) as empreinte_colonnes_intouchables
  from public.preparations;


-- ════════════════════════════════════════════════════════════════════════
--  ÉTAPE C — MIGRATION
--
--  Tout tient dans un seul bloc DO. Un bloc DO est atomique : la moindre
--  RAISE EXCEPTION annule l'intégralité de ce qu'il a écrit. Le BEGIN/COMMIT
--  qui l'entoure rend la transaction explicite et ne dépend pas du
--  comportement de l'éditeur SQL.
--
--  Le bloc refuse de travailler si l'état de départ n'est pas exactement
--  celui qui a été validé.
-- ════════════════════════════════════════════════════════════════════════

begin;

do $migration$
declare
  v_total        int;
  v_acceptable   int;
  v_depose       int;
  v_rejete       int;
  v_inattendus   int;
  v_deja         int;
  v_maj          int;
  v_hist         int;
  v_deposee      int;
  v_en_retard    int;
  v_restants     int;
  v_avant        text;
  v_apres        text;
  v_horodatage   text := to_char(now() at time zone 'utc',
                                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin

  -- ── C.1 IDEMPOTENCE ────────────────────────────────────────────────────
  -- Une migration déjà passée laisse une entrée `migration` dans
  -- l'historique. On sort sans rien écrire plutôt que de créer des doublons.
  select count(*) into v_deja
    from public.preparations
   where historique_statuts @> '[{"action":"migration"}]'::jsonb;

  if v_deja > 0 then
    raise notice '── Migration déjà effectuée sur % ligne(s). Aucune écriture. ──', v_deja;
    return;
  end if;

  -- Seconde barrière : si plus aucun ancien statut n'est présent, il n'y a
  -- rien à convertir, quelle qu'en soit la raison.
  select count(*) into v_restants
    from public.preparations
   where status in ('acceptable','depose','rejeté (retard)');

  if v_restants = 0 then
    raise notice '── Aucun ancien statut à convertir. Aucune écriture. ──';
    return;
  end if;

  -- ── C.2 L'ÉTAT DE DÉPART EST-IL CELUI QUI A ÉTÉ VALIDÉ ? ───────────────
  select count(*) into v_total from public.preparations;

  select
    count(*) filter (where status = 'acceptable'),
    count(*) filter (where status = 'depose'),
    count(*) filter (where status = 'rejeté (retard)'),
    count(*) filter (where status not in ('acceptable','depose','rejeté (retard)'))
  into v_acceptable, v_depose, v_rejete, v_inattendus
  from public.preparations;

  if v_total <> 17 then
    raise exception 'ARRÊT : % lignes dans preparations, 17 attendues.', v_total;
  end if;
  if v_acceptable <> 14 then
    raise exception 'ARRÊT : % lignes « acceptable », 14 attendues.', v_acceptable;
  end if;
  if v_depose <> 2 then
    raise exception 'ARRÊT : % lignes « depose », 2 attendues.', v_depose;
  end if;
  if v_rejete <> 1 then
    raise exception 'ARRÊT : % lignes « rejeté (retard) », 1 attendue.', v_rejete;
  end if;
  if v_inattendus <> 0 then
    raise exception 'ARRÊT : % ligne(s) portent un statut hors du mapping validé.', v_inattendus;
  end if;

  -- ── C.3 EMPREINTE DES COLONNES INTOUCHABLES, AVANT ─────────────────────
  -- Calculée sur toute la table, pas seulement sur les lignes converties :
  -- elle prouve aussi qu'aucune autre ligne n'a bougé.
  select md5(string_agg(
           id::text
           || '|' || coalesce(note_ia::text, '~')
           || '|' || coalesce(commentaire_ia, '~')
           || '|' || coalesce(contenu::text, '~')
           || '|' || coalesce(url_doc, '~')
           || '|' || coalesce(heure_depot::text, '~')
           || '|' || coalesce(retard_minutes::text, '~')
           || '|' || coalesce(user_id::text, '~')
           || '|' || coalesce(classe_id::text, '~')
           || '|' || coalesce(date_cours::text, '~')
           || '|' || coalesce(heure_cours::text, '~')
           || '|' || coalesce(matiere, '~')
           || '|' || coalesce(groupe, '~')
           || '|' || coalesce(sequence::text, '~')
           || '|' || coalesce(note_directeur::text, '~')
           || '|' || coalesce(commentaire_directeur, '~')
           || '|' || coalesce(corrige_par::text, '~')
           || '|' || coalesce(corrige_le::text, '~')
           || '|' || coalesce(pieces_jointes::text, '~')
           || '|' || coalesce(appreciations::text, '~')
           || '|' || coalesce(verrouillee_le::text, '~')
         , E'\n' order by id))
    into v_avant
    from public.preparations;

  -- ── C.4 LA CONVERSION ──────────────────────────────────────────────────
  -- Deux colonnes écrites, pas une de plus. Dans un UPDATE, `status` à
  -- droite du `=` désigne l'ancienne valeur : le CASE et l'historique lisent
  -- donc bien le statut d'avant.
  update public.preparations
     set status = case status
                    when 'acceptable'      then 'deposee'
                    when 'depose'          then 'en_retard'
                    when 'rejeté (retard)' then 'en_retard'
                    -- Filet : sans ELSE, un CASE qui ne trouve rien renvoie
                    -- NULL et effacerait le statut. Le WHERE l'interdit
                    -- aujourd'hui ; si un jour WHERE et CASE divergeaient,
                    -- la ligne resterait inchangée au lieu d'être détruite.
                    else status
                  end,
         historique_statuts = coalesce(historique_statuts, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object(
             'statut',      case status
                              when 'acceptable' then 'deposee'
                              else 'en_retard'
                            end,
             'action',      'migration',
             'commentaire', 'Statut converti depuis « ' || status
                            || ' » lors de la normalisation du '
                            || to_char(now() at time zone 'utc', 'DD/MM/YYYY') || '.',
             'le',          v_horodatage,
             -- Typé explicitement : `jsonb_build_object` reçoit ses
             -- arguments en VARIADIC "any", et un NULL nu y arrive avec le
             -- type `unknown`. Le cast lève toute ambiguïté de résolution.
             'par',         null::uuid,
             'par_nom',     'Migration technique'
           ))
   where status in ('acceptable','depose','rejeté (retard)');

  get diagnostics v_maj = row_count;

  -- ── C.5 CONTRÔLES APRÈS ÉCRITURE, AVANT COMMIT ─────────────────────────
  if v_maj <> 17 then
    raise exception 'ARRÊT : % ligne(s) modifiée(s), 17 attendues. Annulation.', v_maj;
  end if;

  select count(*) into v_hist
    from public.preparations
   where historique_statuts @> '[{"action":"migration"}]'::jsonb;
  if v_hist <> 17 then
    raise exception 'ARRÊT : % entrée(s) d''historique créée(s), 17 attendues. Annulation.', v_hist;
  end if;

  select
    count(*) filter (where status = 'deposee'),
    count(*) filter (where status = 'en_retard'),
    count(*) filter (where status in ('acceptable','depose','rejeté (retard)'))
  into v_deposee, v_en_retard, v_restants
  from public.preparations;

  if v_deposee <> 14 then
    raise exception 'ARRÊT : % « deposee », 14 attendues. Annulation.', v_deposee;
  end if;
  if v_en_retard <> 3 then
    raise exception 'ARRÊT : % « en_retard », 3 attendues. Annulation.', v_en_retard;
  end if;
  if v_restants <> 0 then
    raise exception 'ARRÊT : % ancien(s) statut(s) subsistent. Annulation.', v_restants;
  end if;

  -- Aucun dossier ne doit avoir atterri sur un statut interdit par le mapping.
  select count(*) into v_inattendus
    from public.preparations
   where status in ('brouillon','a_corriger','validee');
  if v_inattendus <> 0 then
    raise exception 'ARRÊT : % ligne(s) sur un statut hors mapping. Annulation.', v_inattendus;
  end if;

  -- ── C.6 LES COLONNES INTOUCHABLES ONT-ELLES BOUGÉ ? ────────────────────
  select md5(string_agg(
           id::text
           || '|' || coalesce(note_ia::text, '~')
           || '|' || coalesce(commentaire_ia, '~')
           || '|' || coalesce(contenu::text, '~')
           || '|' || coalesce(url_doc, '~')
           || '|' || coalesce(heure_depot::text, '~')
           || '|' || coalesce(retard_minutes::text, '~')
           || '|' || coalesce(user_id::text, '~')
           || '|' || coalesce(classe_id::text, '~')
           || '|' || coalesce(date_cours::text, '~')
           || '|' || coalesce(heure_cours::text, '~')
           || '|' || coalesce(matiere, '~')
           || '|' || coalesce(groupe, '~')
           || '|' || coalesce(sequence::text, '~')
           || '|' || coalesce(note_directeur::text, '~')
           || '|' || coalesce(commentaire_directeur, '~')
           || '|' || coalesce(corrige_par::text, '~')
           || '|' || coalesce(corrige_le::text, '~')
           || '|' || coalesce(pieces_jointes::text, '~')
           || '|' || coalesce(appreciations::text, '~')
           || '|' || coalesce(verrouillee_le::text, '~')
         , E'\n' order by id))
    into v_apres
    from public.preparations;

  if v_apres is distinct from v_avant then
    raise exception 'ARRÊT : une colonne qui devait rester intacte a changé. Annulation.';
  end if;

  raise notice '── Migration vérifiée : 17 lignes converties, 14 deposee, 3 en_retard. ──';
  raise notice '── Empreinte des colonnes intouchables inchangée : % ──', v_avant;

end
$migration$;

commit;


-- ════════════════════════════════════════════════════════════════════════
--  ÉTAPE E — VÉRIFICATION APRÈS MIGRATION
--  À exécuter après le COMMIT, en relecture indépendante du script.
-- ════════════════════════════════════════════════════════════════════════

-- E.0 — Tous les contrôles en une seule ligne de résultat.
--
--       Attendu exactement :
--         total 17 | deposee 14 | en_retard 3
--         reste_acceptable 0 | reste_depose 0 | reste_rejete 0
--         statut_interdit 0 | entrees_migration 17 | retard_minutes_null 17
select
  count(*)                                              as total,
  count(*) filter (where status = 'deposee')            as deposee,
  count(*) filter (where status = 'en_retard')          as en_retard,
  count(*) filter (where status = 'acceptable')         as reste_acceptable,
  count(*) filter (where status = 'depose')             as reste_depose,
  count(*) filter (where status = 'rejeté (retard)')    as reste_rejete,
  count(*) filter (where status in ('brouillon','a_corriger','validee'))
                                                        as statut_interdit,
  count(*) filter (where historique_statuts
                         @> '[{"action":"migration"}]'::jsonb)
                                                        as entrees_migration,
  count(*) filter (where retard_minutes is null)        as retard_minutes_null
from public.preparations;

-- E.1 — Répartition ventilée.
select status, count(*) as lignes
  from public.preparations
 group by status
 order by count(*) desc;

-- E.2 — Anciens statuts restants. Attendu : 0 pour les trois.
select
  count(*) filter (where status = 'acceptable')      as reste_acceptable,
  count(*) filter (where status = 'depose')          as reste_depose,
  count(*) filter (where status = 'rejeté (retard)') as reste_rejete
from public.preparations;

-- E.3 — Statuts interdits par le mapping. Attendu : 0.
select count(*) as sur_statut_interdit
  from public.preparations
 where status in ('brouillon','a_corriger','validee');

-- E.4 — Entrées de migration dans l'historique. Attendu : 17.
select count(*) as entrees_migration
  from public.preparations
 where historique_statuts @> '[{"action":"migration"}]'::jsonb;

-- E.5 — Chaque conversion, lisible, avec l'ancien statut conservé.
select
  id,
  status as statut_actuel,
  h ->> 'statut'      as statut_inscrit,
  h ->> 'commentaire' as trace,
  h ->> 'le'          as migre_le,
  h ->> 'par_nom'     as par
from public.preparations,
     lateral jsonb_array_elements(historique_statuts) h
where h ->> 'action' = 'migration'
order by status, id;

-- E.6 — Un seul événement de migration par ligne : aucun doublon.
--       Attendu : aucune ligne renvoyée.
select id, count(*) as occurrences
  from public.preparations,
       lateral jsonb_array_elements(historique_statuts) h
 where h ->> 'action' = 'migration'
 group by id
having count(*) > 1;

-- E.7 — Empreinte des colonnes intouchables. Doit être IDENTIQUE à § B.2.
--       Couvre note_ia, commentaire_ia, contenu, url_doc, heure_depot et
--       retard_minutes, plus toutes les autres colonnes non concernées.
select md5(string_agg(
         id::text
         || '|' || coalesce(note_ia::text, '~')
         || '|' || coalesce(commentaire_ia, '~')
         || '|' || coalesce(contenu::text, '~')
         || '|' || coalesce(url_doc, '~')
         || '|' || coalesce(heure_depot::text, '~')
         || '|' || coalesce(retard_minutes::text, '~')
         || '|' || coalesce(user_id::text, '~')
         || '|' || coalesce(classe_id::text, '~')
         || '|' || coalesce(date_cours::text, '~')
         || '|' || coalesce(heure_cours::text, '~')
         || '|' || coalesce(matiere, '~')
         || '|' || coalesce(groupe, '~')
         || '|' || coalesce(sequence::text, '~')
         || '|' || coalesce(note_directeur::text, '~')
         || '|' || coalesce(commentaire_directeur, '~')
         || '|' || coalesce(corrige_par::text, '~')
         || '|' || coalesce(corrige_le::text, '~')
         || '|' || coalesce(pieces_jointes::text, '~')
         || '|' || coalesce(appreciations::text, '~')
         || '|' || coalesce(verrouillee_le::text, '~')
       , E'\n' order by id)) as empreinte_colonnes_intouchables
  from public.preparations;

-- E.8 — `retard_minutes` n'a pas été renseignée, conformément à la consigne.
--       Attendu : 17 lignes à NULL, comme avant.
select count(*) as retard_minutes_null
  from public.preparations
 where retard_minutes is null;

-- E.9 — `note_ia` intacte : 14 à 10, 1 à 5, 2 à NULL.
select coalesce(note_ia::text, 'NULL') as note_ia, count(*) as lignes
  from public.preparations
 group by note_ia
 order by count(*) desc;


-- ════════════════════════════════════════════════════════════════════════
--  RETOUR EN ARRIÈRE
--
--  Ce script n'a pas besoin de plan de rollback pendant son exécution : le
--  bloc DO est atomique, toute anomalie annule tout.
--
--  Pour revenir en arrière APRÈS un COMMIT réussi, l'ancien statut est
--  conservé dans le commentaire de chaque entrée de migration. La remise en
--  état se lit dans le snapshot § B.1, qui doit avoir été exporté avant.
--  Ne jamais reconstruire les anciens statuts « de tête » : le libellé exact
--  est « rejeté (retard) », accent et parenthèses compris.
-- ════════════════════════════════════════════════════════════════════════
