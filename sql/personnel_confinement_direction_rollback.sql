-- ============================================================
-- ROLLBACK — confinement du cycle de vie des identités
--
-- ⚠ ATTENTION : CE ROLLBACK ROUVRE LA GESTION DU PERSONNEL À TOUT LE
-- MONDE, Y COMPRIS SANS SESSION. Il rétablit littéralement la faille :
--   · n'importe quel visiteur anonyme peut créer ou désactiver un compte ;
--   · n'importe quel compte authentifié peut se réattribuer un rôle
--     supérieur en s'appelant avec son propre identifiant.
-- À N'UTILISER QUE SI LA MIGRATION BLOQUE UN USAGE VITAL, ET POUR LE
-- TEMPS STRICTEMENT NÉCESSAIRE AU DIAGNOSTIC.
--
-- Cause la plus probable d'un blocage : `ideal_est(array['directeur'])`
-- rend `false` pour votre compte. AVANT DE ROULER CECI, exécutez
-- sql/personnel_confinement_directeur_verification.sql — si le lien
-- auth_user_id manque, le réparer est plus sûr que de tout rouvrir.
-- ============================================================

begin;

-- 1 · Les corps, sans la garde — identiques à phase0_1_creation.sql
--     Repris depuis ce fichier, section « Fonctions ». Pour éviter toute
--     divergence de recopie, la source d'autorité reste
--     sql/phase0_1_creation.sql : rejouez-en les deux CREATE OR REPLACE
--     (enregistrer_utilisateur, desactiver_utilisateur) tels quels.
--     Ne rejouez PAS le fichier entier : il contient d'autres objets.

\echo '>>> Rejouer ici les deux CREATE OR REPLACE de sql/phase0_1_creation.sql'
\echo '>>> (enregistrer_utilisateur, desactiver_utilisateur) — corps sans garde.'

-- 2 · Les privilèges d'origine, défaut PUBLIC compris
grant execute on function
  public.enregistrer_utilisateur(uuid,text,text,text,text,text,text,integer)
  to public, anon, authenticated;

grant execute on function
  public.desactiver_utilisateur(uuid)
  to public, anon, authenticated;

grant execute on function
  public.authentifier_par_code(text)
  to public, anon, authenticated;

commit;

-- Après ce rollback, la recette DOIT repasser au rouge. Si elle reste
-- verte, c'est que le rollback n'a pas pris — vérifiez-le avant de
-- conclure quoi que ce soit.
