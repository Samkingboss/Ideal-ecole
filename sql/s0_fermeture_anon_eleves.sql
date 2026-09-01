-- ═══════════════════════════════════════════════════════════════════════
-- S0 · CONFINEMENT D'URGENCE — fermer public.eleves à `anon`
--
-- ⚠ NE PAS EXÉCUTER AVANT :
--    1. le diagnostic sql/s0_diagnostic_eleves_classes.sql ;
--    2. le déploiement de pedago-archive avec sa session — sinon cette
--       page lira zéro élève.
--
-- ── Ce que cette migration fait, et ce qu'elle ne fait pas ────────────
--
-- ELLE FAIT : couper l'accès direct d'`anon` à `eleves` et à `classes`.
-- ELLE NE FAIT PAS : toucher aux droits d'`authenticated`. Les trois
-- écritures directes du frontend — DirecteurApp INSERT, SurveillantApp
-- UPDATE points_discipline, CartesScolaires UPDATE photo_url — continuent
-- de fonctionner exactement comme aujourd'hui.
--
-- C'est délibéré. Activer la RLS avec une seule policy SELECT casserait ces
-- trois écritures le jour même. La séquence est : couper internet d'abord,
-- reconstruire les autorisations `authenticated` ensuite, par RPC, écran
-- par écran, et n'activer la RLS stricte qu'à la fin.
--
-- ── Pourquoi les GRANTS et pas la RLS ─────────────────────────────────
--
-- Un `revoke` de privilège est plus simple qu'une policy, et il est
-- inconditionnel : aucun prédicat à écrire juste, aucun effet de bord sur
-- les rôles voisins. Pour un coupe-circuit, c'est la bonne outil.
--
-- La RLS viendra au cran suivant, quand les policies pourront être écrites
-- avec les prédicats des rôles réels — et testées rôle par rôle.
--
-- ⚠ AUCUNE DONNÉE N'EST TOUCHÉE. Aucun UPDATE, aucun DELETE, aucune
-- migration de valeur. La photo base64 existante reste où elle est ; elle
-- cesse simplement d'être atteignable de l'extérieur.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── 1 · eleves ─────────────────────────────────────────────────────────
--
-- `revoke all … from anon` retire SELECT, INSERT, UPDATE, DELETE et le
-- reste, quelle que soit l'origine du droit.
--
-- `from public` en plus : si le diagnostic (bloc C) montre un privilège
-- accordé à PUBLIC, `anon` en hérite et la révocation d'`anon` seule ne
-- fermerait rien. Le passer inconditionnellement ne coûte rien quand
-- PUBLIC n'a aucun droit — la commande réussit sans effet.
--
-- ⚠ `authenticated` n'est PAS touché.

revoke all on table public.eleves from anon;
revoke all on table public.eleves from public;

-- ── 2 · classes ────────────────────────────────────────────────────────
--
-- L'écriture anonyme sur la grille des classes n'est justifiable par rien :
-- mesurée à 23502, elle est aujourd'hui accordée.
--
-- La LECTURE l'est-elle ? Non. `public/inscription.html:695-709` propose sa
-- liste de classes EN DUR — Petite Section, Grande Section, CP1…CM2 — et ne
-- lit jamais la table. Les deux seuls lecteurs hors React sont dans
-- `pedago-archive`, qui porte désormais la session.
--
-- Aucune page publique ne dépend donc du SELECT anon sur `classes`.

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
-- ET, connecté : tableau de bord Direction, surveillant, conseiller,
-- certificats, cartes scolaires, rapports.html, pedago-archive.
-- ═══════════════════════════════════════════════════════════════════════
