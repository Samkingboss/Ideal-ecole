-- Migration de public.creer_inscription(jsonb) vers les chemins Storage.
--
-- Le bucket `inscriptions` est privé depuis le 19 août 2026. Les URL
-- publiques ne résolvent plus, et la lecture passe par createSignedUrl, qui
-- exige un chemin relatif. Les colonnes existent déjà : `photo_chemin` et
-- `signature_chemin` sur `inscriptions`, `chemin` sur `documents_inscription`.
-- La fonction, elle, écrit encore des URL publiques.
--
-- ── Pourquoi une substitution plutôt qu'une réécriture ────────────────
--
-- La fonction fait 8 670 caractères : validations, verrou consultatif du
-- matricule, insertion des responsables, génération du matricule, insertion
-- de l'inscription, boucle des pièces. La retaper à la main pour n'en changer
-- que six fragments, c'est prendre un risque de transcription sur le seul
-- rempart transactionnel du dossier d'inscription.
--
-- Ce script lit la définition déployée, applique six substitutions dont les
-- ancres sont complètes et uniques, et n'exécute qu'ensuite. Tout ce qui
-- n'est pas ces six fragments est identique par construction.
--
-- Simulation préalable exécutée le 19 août 2026 : six ancres à une occurrence
-- chacune, six lignes modifiées, aucune autre, nombre de lignes inchangé.
--
-- ── Ciblage de la fonction ────────────────────────────────────────────
--
-- Partout : `public.creer_inscription(jsonb)`::regprocedure, jamais un filtre
-- sur `proname` seul. Une surcharge homonyme ajoutée un jour — ne serait-ce
-- qu'un `creer_inscription(jsonb, uuid)` — rendrait un filtre par nom
-- ambigu, et le script pourrait lire une définition pour en remplacer une
-- autre. La signature complète lève l'ambiguïté.
--
-- ── Ce qui est préservé ───────────────────────────────────────────────
--
-- `pg_get_functiondef` restitue la signature, SECURITY DEFINER et le
-- SET search_path dans le texte lui-même : ils traversent la substitution
-- sans qu'on ait à les réécrire. CREATE OR REPLACE conserve par ailleurs le
-- propriétaire et les privilèges de la fonction remplacée.
--
-- ── Ce qui n'est pas touché ───────────────────────────────────────────
--
-- Aucune donnée. Les inscriptions et les documents existants gardent leurs
-- valeurs, y compris les URL publiques historiques. Seuls les dossiers créés
-- APRÈS cette migration auront `url` à NULL et pas d'URL publique.
-- Aucune policy, aucun objet Storage, aucun fichier frontend.


-- ══════════════════════════════════════════════════════════════════════
-- 0 · ÉTAT AVANT — à relever et conserver
-- ══════════════════════════════════════════════════════════════════════

-- 0.1 · Identité, sécurité et privilèges de la fonction
SELECT p.oid::regprocedure         AS fonction,
       pg_get_userbyid(p.proowner) AS proprietaire,
       p.prosecdef                 AS security_definer,
       p.proconfig                 AS configuration,
       p.proacl                    AS privileges,
       length(pg_get_functiondef(p.oid)) AS longueur
  FROM pg_proc p
 WHERE p.oid = 'public.creer_inscription(jsonb)'::regprocedure;

-- 0.2 · Volumétrie des données — À NOTER TELLE QUELLE.
--       La section 2.3 rejoue cette requête à l'identique : les deux
--       résultats doivent coïncider ligne pour ligne. Aucune valeur n'est
--       attendue a priori — c'est l'égalité avant/après qui fait preuve,
--       pas un chiffre écrit d'avance.
SELECT (SELECT count(*) FROM public.inscriptions)          AS inscriptions,
       (SELECT count(*) FROM public.responsables)          AS responsables,
       (SELECT count(*) FROM public.documents_inscription) AS documents,
       (SELECT count(*) FROM public.documents_inscription
         WHERE url IS NOT NULL)                            AS documents_avec_url_historique;


-- ══════════════════════════════════════════════════════════════════════
-- 1 · APPLICATION
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

DO $patch$
DECLARE
  v_oid  regprocedure;
  d      text;
  cand   text;
  n      integer;
  i      integer;
  avant  text[];
  apres  text[];
BEGIN
  -- Les six ancres. Rangs 1 à 3 relevés dans la définition déployée ;
  -- rangs 4 à 6 issus du bloc « B3 AJOUT » ajouté le 19 août. Toutes
  -- validées à une occurrence unique par la simulation.
  avant := ARRAY[
    $a$photo_url, signature_url, annee_scolaire, type_inscription$a$,
    $a$nullif(btrim(coalesce(fic ->> 'photo_url', '')), '')$a$,
    $a$nullif(btrim(coalesce(fic ->> 'signature_url', '')), '')$a$,
    $a$or nullif(btrim(coalesce(v_doc ->> 'url', '')), '') is null then$a$,
    $a$using detail = 'Chaque document exige au minimum un type et une URL.';$a$,
    $a$btrim(v_doc ->> 'url'),$a$
  ];
  apres := ARRAY[
    $a$photo_chemin, signature_chemin, annee_scolaire, type_inscription$a$,
    $a$nullif(btrim(coalesce(fic ->> 'photo_chemin', '')), '')$a$,
    $a$nullif(btrim(coalesce(fic ->> 'signature_chemin', '')), '')$a$,
    $a$or nullif(btrim(coalesce(v_doc ->> 'chemin', '')), '') is null then$a$,
    $a$using detail = 'Chaque document exige au minimum un type et un chemin Storage.';$a$,
    $a$null,$a$
  ];

  -- to_regprocedure renvoie NULL plutôt que de lever : on maîtrise le message.
  v_oid := to_regprocedure('public.creer_inscription(jsonb)');

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'public.creer_inscription(jsonb) introuvable — rien à migrer.'
      USING HINT = 'Vérifier la signature exacte : SELECT oid::regprocedure FROM pg_proc WHERE proname = ''creer_inscription'';';
  END IF;

  d := pg_get_functiondef(v_oid::oid);
  cand := d;

  -- Chaque ancre est comptée sur le texte en cours, pas sur l'original :
  -- une substitution qui ferait apparaître l'ancre suivante serait détectée.
  FOR i IN 1 .. array_length(avant, 1) LOOP
    n := (length(cand) - length(replace(cand, avant[i], ''))) / length(avant[i]);
    IF n <> 1 THEN
      RAISE EXCEPTION 'Ancre % : % occurrence(s) au lieu d''une seule. Rien n''a été écrit.', i, n
        USING DETAIL = avant[i],
              HINT   = '0 : la définition déployée diffère de celle auditée. Plus de 1 : substitution ambiguë. Relancer la simulation.';
    END IF;
    cand := replace(cand, avant[i], apres[i]);
  END LOOP;

  -- ── Garde-fous de sortie, avant toute écriture ──────────────────────

  -- La liste de colonnes de l'INSERT, pas seulement les clés JSON.
  IF position($a$photo_chemin, signature_chemin, annee_scolaire, type_inscription$a$ IN cand) = 0 THEN
    RAISE EXCEPTION 'La liste de colonnes de l''INSERT ne porte pas les nouveaux chemins. Abandon.';
  END IF;

  IF position($a$photo_url, signature_url, annee_scolaire, type_inscription$a$ IN cand) > 0 THEN
    RAISE EXCEPTION 'La liste de colonnes de l''INSERT porte encore photo_url / signature_url. Abandon.';
  END IF;

  -- Les valeurs lues dans `fic`.
  IF position($a$fic ->> 'photo_chemin'$a$ IN cand) = 0
     OR position($a$fic ->> 'signature_chemin'$a$ IN cand) = 0 THEN
    RAISE EXCEPTION 'Les nouvelles clés fic sont absentes de la candidate. Abandon.';
  END IF;

  IF position($a$fic ->> 'photo_url'$a$ IN cand) > 0
     OR position($a$fic ->> 'signature_url'$a$ IN cand) > 0
     OR position($a$btrim(v_doc ->> 'url'),$a$ IN cand) > 0 THEN
    RAISE EXCEPTION 'Une ancienne référence d''URL subsiste dans la candidate. Abandon.';
  END IF;

  IF cand !~ 'SECURITY DEFINER' OR cand !~ 'search_path' THEN
    RAISE EXCEPTION 'SECURITY DEFINER ou search_path absent de la candidate. Abandon.';
  END IF;

  IF array_length(string_to_array(d, E'\n'), 1)
     <> array_length(string_to_array(cand, E'\n'), 1) THEN
    RAISE EXCEPTION 'Le nombre de lignes a changé — la substitution a débordé. Abandon.';
  END IF;

  RAISE NOTICE 'Six substitutions appliquées sur %. Longueur % → % (delta %).',
               v_oid, length(d), length(cand), length(cand) - length(d);

  EXECUTE cand;
END
$patch$;

COMMIT;


-- ══════════════════════════════════════════════════════════════════════
-- 2 · VÉRIFICATION APRÈS APPLICATION — lecture seule
-- ══════════════════════════════════════════════════════════════════════

-- 2.1 · Contenu de la fonction migrée
WITH f AS (
  SELECT pg_get_functiondef(oid) AS d
    FROM pg_proc
   WHERE oid = 'public.creer_inscription(jsonb)'::regprocedure
)
SELECT
  -- la liste de colonnes de l'INSERT
  position($a$photo_chemin, signature_chemin, annee_scolaire, type_inscription$a$ IN d) > 0
                                                        AS colonnes_chemins_presentes,
  position($a$photo_url, signature_url, annee_scolaire, type_inscription$a$ IN d) = 0
                                                        AS colonnes_url_absentes,
  -- les valeurs lues dans `fic`
  position($a$fic ->> 'photo_chemin'$a$     IN d) > 0    AS lit_photo_chemin,
  position($a$fic ->> 'signature_chemin'$a$ IN d) > 0    AS lit_signature_chemin,
  position($a$fic ->> 'photo_url'$a$        IN d) = 0    AS sans_photo_url,
  position($a$fic ->> 'signature_url'$a$    IN d) = 0    AS sans_signature_url,
  -- la boucle des pièces justificatives
  position($a$v_doc ->> 'chemin'$a$         IN d) > 0    AS valide_chemin_document,
  position($a$btrim(v_doc ->> 'url'),$a$    IN d) = 0    AS sans_url_document,
  position($a$type et une URL$a$            IN d) = 0    AS message_actualise,
  -- la sécurité
  position('SECURITY DEFINER' IN d)         > 0          AS security_definer,
  position('search_path'      IN d)         > 0          AS search_path_fige,
  length(d)                                              AS longueur
  FROM f;
-- attendu : les onze colonnes booléennes à true

-- 2.2 · Identité, sécurité et privilèges — À COMPARER À 0.1
SELECT p.oid::regprocedure         AS fonction,
       pg_get_userbyid(p.proowner) AS proprietaire,
       p.prosecdef                 AS security_definer,
       p.proconfig                 AS configuration,
       p.proacl                    AS privileges
  FROM pg_proc p
 WHERE p.oid = 'public.creer_inscription(jsonb)'::regprocedure;
-- attendu : proprietaire, security_definer, configuration et privileges
--           strictement identiques à ceux relevés en 0.1

-- 2.3 · Volumétrie des données — À COMPARER À 0.2
--       Requête rigoureusement identique à celle de la section 0.2.
--       Les deux résultats doivent coïncider. Aucune valeur n'est attendue
--       a priori : c'est l'égalité qui prouve que rien n'a bougé.
SELECT (SELECT count(*) FROM public.inscriptions)          AS inscriptions,
       (SELECT count(*) FROM public.responsables)          AS responsables,
       (SELECT count(*) FROM public.documents_inscription) AS documents,
       (SELECT count(*) FROM public.documents_inscription
         WHERE url IS NOT NULL)                            AS documents_avec_url_historique;


-- ══════════════════════════════════════════════════════════════════════
-- 3 · EXPORT POUR VERSIONNEMENT
-- ══════════════════════════════════════════════════════════════════════
--
-- La définition finale doit être archivée dans sql/creer_inscription.sql :
-- cette fonction n'a jamais été versionnée, et son absence du dépôt a coûté
-- plusieurs allers-retours. À exécuter après application.

SELECT pg_get_functiondef(oid)
  FROM pg_proc
 WHERE oid = 'public.creer_inscription(jsonb)'::regprocedure;
