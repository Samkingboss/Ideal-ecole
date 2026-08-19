-- Chemins Storage de la photo et de la signature d'inscription.
--
-- Le bucket `inscriptions` est passé en privé le 19 août 2026. Les colonnes
-- `photo_url` et `signature_url` contiennent des URL de la forme
-- /storage/v1/object/public/inscriptions/... : elles ne résolvent plus.
--
-- Les quatre pièces justificatives disposent déjà de `documents_inscription
-- .chemin`, ajouté à cette fin, et c'est aujourd'hui la seule référence de
-- fichier fiable du projet. La photo et la signature n'ont pas d'équivalent :
-- leur chemin n'existe qu'incidemment, noyé dans une URL devenue inutilisable.
--
-- Ces deux colonnes leur donnent la même référence explicite, condition pour
-- que le frontend puisse appeler createSignedUrl.
--
-- Rien n'est supprimé : `photo_url` et `signature_url` sont conservées comme
-- donnée historique. Le code cessera simplement de les lire.
--
-- ── Tout ou rien ──────────────────────────────────────────────────────
--
-- Colonnes, commentaires et remplissage tiennent dans une seule transaction.
-- Le remplissage est encadré par un bloc DO qui compte les lignes touchées :
-- si l'un des deux UPDATE n'en affecte pas exactement une, il lève une
-- exception, la transaction est avortée, et le COMMIT final ne valide rien —
-- ni les colonnes, ni les commentaires, ni les données.
--
-- Un UPDATE 0 n'est pas un détail : il signifierait que l'identifiant ne
-- correspond plus, ou qu'un chemin était déjà renseigné. Dans les deux cas il
-- faut comprendre avant d'écrire.

BEGIN;

-- ── 1 · Les colonnes ──────────────────────────────────────────────────
--
-- Nullables, sans valeur par défaut : un dossier peut légitimement n'avoir
-- ni photo ni signature.

ALTER TABLE public.inscriptions
  ADD COLUMN IF NOT EXISTS photo_chemin     text,
  ADD COLUMN IF NOT EXISTS signature_chemin text;

COMMENT ON COLUMN public.inscriptions.photo_chemin IS
  'Chemin relatif dans le bucket « inscriptions », ex. photos/{uuid}.jpg. '
  'Source de vérité pour createSignedUrl. photo_url reste historique.';

COMMENT ON COLUMN public.inscriptions.signature_chemin IS
  'Chemin relatif dans le bucket « inscriptions », ex. signatures/{uuid}.png. '
  'Source de vérité pour createSignedUrl. signature_url reste historique.';


-- ── 2 · Remplissage contrôlé des dossiers existants ───────────────────
--
-- Deux dossiers au 19 août 2026. Les quatre chemins ci-dessous ne sont pas
-- déduits d'un gabarit : ils ont été extraits des URL réellement stockées,
-- puis vérifiés un par un contre le bucket — les quatre objets existent et
-- se signent.
--
-- Valeurs écrites en clair plutôt que par un découpage de chaîne : deux
-- lignes se relisent, une expression régulière sur des URL se relit mal.
--
-- `WHERE ... IS NULL` rend le script rejouable : une seconde exécution
-- n'écraserait pas un chemin déjà renseigné. Elle échouerait franchement,
-- par le contrôle de ROW_COUNT, plutôt que de passer inaperçue.

DO $$
DECLARE
  n_a001 integer;
  n_a002 integer;
BEGIN
  UPDATE public.inscriptions
     SET photo_chemin     = 'photos/3ef3b7dd-9226-4240-9506-4970f10559bd.jpg',
         signature_chemin = 'signatures/3ef3b7dd-9226-4240-9506-4970f10559bd.png'
   WHERE id = 'faf9c506-3a98-4ad6-ac30-f40635366490'   -- 26-27 A001
     AND photo_chemin IS NULL
     AND signature_chemin IS NULL;

  GET DIAGNOSTICS n_a001 = ROW_COUNT;

  IF n_a001 <> 1 THEN
    RAISE EXCEPTION 'Remplissage A001 : % ligne(s) affectée(s) au lieu d''une seule.', n_a001
      USING DETAIL = 'Dossier 26-27 A001, id faf9c506-3a98-4ad6-ac30-f40635366490.',
            HINT   = '0 : identifiant introuvable, ou photo_chemin / signature_chemin déjà renseigné. Vérifier avant de rejouer.';
  END IF;

  UPDATE public.inscriptions
     SET photo_chemin     = 'photos/460a45a4-46a6-42ab-ab01-46cc9e6bc638.jpg',
         signature_chemin = 'signatures/460a45a4-46a6-42ab-ab01-46cc9e6bc638.png'
   WHERE id = '177fd229-5ee3-42a5-9d8b-92cfbb2b142d'   -- 26-27 A002
     AND photo_chemin IS NULL
     AND signature_chemin IS NULL;

  GET DIAGNOSTICS n_a002 = ROW_COUNT;

  IF n_a002 <> 1 THEN
    RAISE EXCEPTION 'Remplissage A002 : % ligne(s) affectée(s) au lieu d''une seule.', n_a002
      USING DETAIL = 'Dossier 26-27 A002, id 177fd229-5ee3-42a5-9d8b-92cfbb2b142d.',
            HINT   = '0 : identifiant introuvable, ou photo_chemin / signature_chemin déjà renseigné. Vérifier avant de rejouer.';
  END IF;

  RAISE NOTICE 'Remplissage conforme : A001 % ligne, A002 % ligne.', n_a001, n_a002;
END
$$;

COMMIT;


-- ── 3 · Vérification, après le COMMIT ─────────────────────────────────
--
-- Attendu : deux lignes, quatre chemins renseignés, et concordance partout —
-- le chemin doit correspondre au suffixe de l'URL historique.

SELECT matricule,
       photo_chemin,
       signature_chemin,
       photo_url     LIKE '%' || photo_chemin     AS photo_concorde,
       signature_url LIKE '%' || signature_chemin AS signature_concorde
  FROM public.inscriptions
 ORDER BY matricule;

-- Aucun dossier ne doit rester sans chemin alors qu'il a une URL.
SELECT count(*) AS incoherences
  FROM public.inscriptions
 WHERE (photo_url     IS NOT NULL AND photo_chemin     IS NULL)
    OR (signature_url IS NOT NULL AND signature_chemin IS NULL);
-- attendu : 0
