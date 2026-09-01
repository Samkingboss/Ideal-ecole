-- ═══════════════════════════════════════════════════════════════════════
-- S0 · CONFINEMENT D'URGENCE — fermer public.eleves et public.classes à `anon`
--
-- ⚠ NE PAS EXÉCUTER AVANT le déploiement de `pedago-archive` avec sa
--   session (commit « faire porter la session a pedago-archive »). Sans
--   lui, cette page lira zéro élève.
--
-- ── Ce que le diagnostic a établi ─────────────────────────────────────
--
--   eleves   relrowsecurity = TRUE,  relforcerowsecurity = false
--            policy `acces_ouvert_eleves` — ALL, roles {public},
--            qual = true, with_check = true
--            grants complets à anon, authenticated, service_role
--
--   classes  relrowsecurity = FALSE, relforcerowsecurity = false
--            policy `acces_classes` — SELECT, roles {public}, qual = true
--            grants complets à anon, authenticated, service_role
--
-- Les deux tables sont donc ouvertes pour DEUX raisons distinctes, et le
-- traitement diffère :
--
--   · eleves  : la RLS est ACTIVE. C'est la policy permissive qui laisse
--               tout passer. La supprimer ferme la table.
--   · classes : la RLS est INACTIVE. `acces_classes` ne s'applique donc
--               à rien aujourd'hui ; l'ouverture vient des seuls grants.
--               On la supprime quand même : elle rouvrirait la table le
--               jour où quelqu'un activerait la RLS.
--
-- ── ⚠ POURQUOI UNE POLICY EST AJOUTÉE SUR eleves ──────────────────────
--
-- `eleves` a la RLS ACTIVE. `acces_ouvert_eleves` est aujourd'hui la SEULE
-- chose qui laisse passer qui que ce soit — `anon` comme `authenticated`.
--
-- La supprimer sans rien mettre à la place laisserait la table avec RLS
-- active et AUCUNE policy. C'est exactement le motif que ce dépôt emploie
-- pour rendre une table totalement inatteignable : `users_secrets`,
-- `liens_publics_inscription`, `acces_personnel`, `personnel_contact`.
-- TOUS LES ÉCRANS AUTHENTIFIÉS liraient zéro élève — tableau de bord
-- Direction, surveillant, conseiller, certificats, cartes scolaires,
-- fiches de leçon, maternelle, rapports.html, pedago-archive.
--
-- La consigne « ne pas toucher authenticated en S0 » signifie : ne pas
-- DÉGRADER ses droits. `eleves_acces_authentifie` les PRÉSERVE à
-- l'identique — ALL, toutes les lignes — en changeant seulement le rôle
-- visé : `authenticated` au lieu de `public`.
--
-- Le prédicat reste volontairement `true`. Le resserrer vers
-- `ideal_role() is not null`, comme `users_personnel` et
-- `disciplines_personnel`, appartient au cran suivant : ce serait modifier
-- le comportement d'`authenticated`, et S0 n'est pas le moment.
--
-- ── Pourquoi les REVOKE en plus des policies ──────────────────────────
--
-- Deux verrous plutôt qu'un. La policy décide QUELLES LIGNES ; le grant
-- décide SI LA TABLE EST ATTEIGNABLE. Sans grant, `anon` reçoit 42501 —
-- un refus franc — plutôt qu'une liste vide qu'on pourrait prendre pour
-- une base sans élèves.
--
-- `from public` accompagne `from anon` : un privilège accordé à PUBLIC est
-- hérité par tous les rôles, et révoquer `anon` seul ne fermerait rien.
-- Le diagnostic montre qu'`authenticated` possède ses grants EN PROPRE :
-- révoquer PUBLIC ne les lui retire donc pas.
--
-- ⚠ AUCUNE DONNÉE N'EST TOUCHÉE. Aucun UPDATE, aucun DELETE, aucune
-- migration de valeur. La photo base64 existante reste où elle est ; elle
-- cesse simplement d'être atteignable de l'extérieur.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · eleves ─────────────────────────────────────────────────────────

drop policy if exists acces_ouvert_eleves on public.eleves;

-- Le comportement d'`authenticated` est conservé À L'IDENTIQUE : toutes
-- les opérations, toutes les lignes. Seul `public` — donc `anon` — sort.
create policy eleves_acces_authentifie
  on public.eleves
  for all
  to authenticated
  using (true)
  with check (true);

comment on policy eleves_acces_authentifie on public.eleves is
  'S0 · remplace acces_ouvert_eleves (ALL TO public) sans rien changer pour '
  'authenticated. Le resserrement vers ideal_role() appartient au cran suivant.';

revoke all on table public.eleves from anon;
revoke all on table public.eleves from public;

-- ── 2 · classes ────────────────────────────────────────────────────────
--
-- Aucune policy de remplacement : la RLS est INACTIVE sur cette table, donc
-- `authenticated` continue de lire par ses grants propres, sans policy.
-- En créer une serait sans effet aujourd'hui, et trompeur demain.
--
-- Aucune page publique ne dépend de cette table : `public/inscription.html`
-- lignes 695-709 propose sa liste de classes EN DUR — Petite Section,
-- Grande Section, CP1…CM2 — et ne lit jamais `public.classes`. Les deux
-- seuls lecteurs hors React sont dans `pedago-archive`, qui porte
-- désormais la session.

drop policy if exists acces_classes on public.classes;

revoke all on table public.classes from anon;
revoke all on table public.classes from public;

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- ATTENDU IMMÉDIATEMENT APRÈS COMMIT
--   scripts/gardes/recette-fermeture-eleves.mjs
--
--   R1  anon lit eleves                  26 lignes → 42501 ou 0 ligne
--   R2  anon filtre photo_url             1 ligne  → 42501 ou 0 ligne
--   R3  anon filtre parent_phone         14 lignes → 42501 ou 0 ligne
--   R4  anon filtre date_naissance       14 lignes → 42501 ou 0 ligne
--   R5  anon INSERT eleves               23502     → 42501
--   R6  anon UPDATE eleves               204       → 42501
--   R7  anon DELETE eleves               204       → 42501
--   R8  anon INSERT classes              23502     → 42501
--   R9  verifier_carte_scolaire          répond    → répond toujours
--   R10 creer_inscription_avec_suivi     répond    → répond toujours
--   T   témoin ideal_est                 répond    → répond toujours
--
-- ET, connecté — ce volet n'est pas automatisable, les codes ne quittent
-- pas la machine du directeur :
--   tableau de bord Direction · surveillant · conseiller · certificats ·
--   cartes scolaires · fiches de leçon · maternelle · rapports.html ·
--   pedago-archive
-- Chacun doit continuer d'afficher ses élèves. Un seul écran vide signale
-- que la policy `eleves_acces_authentifie` n'a pas pris.
-- ═══════════════════════════════════════════════════════════════════════
