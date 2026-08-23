---
name: migration-sql
description: Protocole de passation SQL vers le directeur — à utiliser dès qu'un changement touche le schéma, les droits, une RPC ou une politique Supabase. Couvre la sauvegarde, la séparation création/retrait, les assertions, le retour arrière et le format de consigne.
---

# Migration SQL IDEAL

## La contrainte

Je n'ai que la clé anonyme. Pas de `service_role`, pas de CLI, pas de chaîne de
connexion. Le DDL m'est impossible, le catalogue m'est fermé. **Tout SQL passe par
le directeur**, dans l'éditeur Supabase.

Ce n'est pas une précaution : c'est un fait d'accès. Ne jamais planifier une étape
en supposant que je pourrai l'exécuter.

## Format de consigne — quatre points, rien de plus

1. **ÉTAPE N — nom**
2. **Où :** Supabase → SQL Editor → nouvelle requête → coller → Run
3. Le bloc SQL exact
4. Le résultat attendu **en une ligne**, plus « ARRÊTE-TOI » si l'écart survient

Pas de rapport intermédiaire, pas de contexte. Toujours rappeler **où** coller.
Prévenir quand un script est censé se terminer par une erreur.

## Séquence obligatoire

```
1. Sauvegarde         → schéma non exposé, jamais un CSV
2. Script CRÉATION    → non destructif, additif seulement
3. Point de contrôle  → vérifier avant d'aller plus loin
4. Déploiement front  → la colonne existe encore : retour arrière trivial
5. Point de contrôle  → dernière chance de s'arrêter sans perte
6. Script RETRAIT     → ⚠ point de non-retour
7. Vérification
```

La séparation 2 / 6 est la sécurité de toute l'opération. Tant que seul le script
de création est appliqué, un retour arrière du frontend suffit.

## Règles non négociables

**Sauvegarder dans un schéma non exposé**, pas en CSV. Une table dans `sauvegarde.*`
est hors de portée de PostgREST — `PGRST106`. Un CSV crée une copie de plus des
secrets, en clair, sur un disque. Vérifier `information_schema.table_privileges`
pour `anon` : aucune ligne attendue.

**Assertions de volume avant tout retrait.** Le script de retrait compare la source
et la copie, et lève une exception au moindre écart. Une suppression sur recopie
incomplète est irréparable.

**Le retour arrière s'écrit et se teste avant la migration**, pas après. Le forfait
Supabase gratuit n'offre aucune restauration ponctuelle.

**Retour arrière apparié : SQL d'abord, frontend ensuite.** Vercel restaure le
frontend en un clic mais ne sait rien de la base. Repromouvoir d'abord placerait
l'ancien code face à un schéma absent — plus personne ne se connecte.

**Vérifier les contraintes avant d'écrire la fonction.** `users.code_acces` était
`NOT NULL` ; la RPC qui n'y écrivait plus aurait échoué en `23502`, et le défaut ne
serait apparu qu'après le déploiement.

## Déplacer un secret plutôt que révoquer sa colonne

`REVOKE SELECT (colonne)` casse tout `SELECT *` : PostgreSQL vérifie le droit
colonne par colonne et la requête entière échoue en `42501`. Il y avait cinq
`select('*')` sur `users`, dont l'écran de connexion.

Déplacer le secret dans une table à laquelle `anon` n'a aucun droit laisse
`select('*')` fonctionner partout — et surtout, aucune distraction future ne peut
le réexposer. La sécurité ne repose plus sur la vigilance.

## Fonctions et secrets

`SECURITY DEFINER` + `SET search_path TO 'public','pg_temp'`. Valider avant
d'écrire, jamais de bloc `EXCEPTION WHEN OTHERS` qui masquerait un échec partiel.
Retirer explicitement les clés sensibles du retour : `to_jsonb(u) - 'code_acces'`
fonctionne avant comme après la suppression de la colonne.

**PostgreSQL accorde `EXECUTE` à `PUBLIC` par défaut.** Une fonction qui génère ou
révèle un secret doit être révoquée dans la même transaction, sinon le script crée
une faille pire que celle qu'il referme.

## Ne jamais afficher un lot de secrets

Une grille de résultats se photographie. C'est arrivé deux fois. Une rotation
n'affiche que la liste des personnes concernées ; la consultation se fait **une
personne à la fois**, juste avant de lui parler.
