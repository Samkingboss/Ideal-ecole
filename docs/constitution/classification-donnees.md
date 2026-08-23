# Classification des données IDEAL

Décision du promoteur, 23 août 2026. Rang 2 de la constitution.

**Corrige une formulation antérieure de ma part.** J'avais écrit « aucune donnée
réelle n'est en base ». C'était vrai des *identités* — élèves et personnel de test
— et faux de tout le reste. Les programmes, prévisions financières et référentiels
sont réels.

---

## La règle qui prime

> « créé pendant le développement » **≠** « donnée de test »

Cette déduction est **interdite**. Une donnée n'est jetable que si son caractère
fictif est **démontrable**. En cas de doute : **conserver**.

La future purge fonctionnera par **liste positive** des catégories prouvées
fictives — jamais par suppression de tout ce qui préexistait à la mise en
production.

---

## A · Identités et dossiers de test — supprimables plus tard

Fictifs, et démontrables comme tels :

- noms des élèves de test — `TEST-INTEGRATION`, personnages de fiction,
  âges incompatibles avec la classe demandée
- comptes du personnel servant de comptes de test
- dossiers individuels rattachés à ces personnes
- inscriptions fictives (les 7 dossiers `26-27 A001` à `A007`)
- présences et événements générés uniquement pour tester ces personnes
- historiques individuels dont l'origine de test est prouvable

**Aucune purge n'est autorisée aujourd'hui.** Ces données servent de fixtures :
tests, régressions, Auth, RLS, permissions, rôles, workflows.

## B · Données métier réelles — à protéger

Elles décrivent le fonctionnement prévu de l'école et **doivent survivre à la
purge des identités** :

- programmes pédagogiques (17 manuels transcrits, `src/lib/programmes/`)
- prévisions et données financières de référence (`financement_params`)
- référentiels — dont `allergenes`
- paramètres et configurations métier
- règles de fonctionnement, structures pédagogiques, modèles
- matières, organisation des cycles, `emploi_du_temps`, `affectations_matieres`
- configuration cantine et référentiel alimentaire
- paramètres administratifs

## C · Architecture et infrastructure — à conserver

Schéma, migrations, fonctions SQL, RPC, politiques RLS, structure Auth, audit,
Hooks, Loops, gardes, tests, Skills, `CLAUDE.md`, constitution V2.1, décisions
métier, scripts, modèles de documents, règles de sécurité, mécanismes de
synchronisation.

## D · Identités et comptes — à trancher séparément

Quels comptes correspondront à des personnes réelles : **décision du promoteur**,
jamais automatique.

---

## Comptes de test, données réelles : la combinaison à surveiller

Les comptes sont fictifs ; certaines données auxquelles ils accèdent sont réelles.

**Un test d'authentification ou de RLS ne doit jamais modifier une donnée métier
réelle sous prétexte que l'utilisateur du test est fictif.**

Pour tout test destructif :

1. créer des enregistrements explicitement dédiés — des fixtures ;
2. préférer une transaction annulée (le test 3B de la phase 0 en est le modèle) ;
3. marquer clairement les données temporaires ;
4. vérifier leur disparition après le test.

Les Loops et gardes ne mutent jamais programmes pédagogiques, prévisions
financières ni configurations réelles. Les sondes réseau restent en lecture seule.

---

## La future purge — procédure imposée

Non exécutable pendant la phase 3.

```
INVENTAIRE → CLASSIFICATION → SAUVEGARDE → SIMULATION À BLANC
→ LISTE DES ÉLÉMENTS À SUPPRIMER → CONTRÔLE DES DÉPENDANCES
→ AUTORISATION EXPLICITE DU PROMOTEUR → PURGE
→ CONTRÔLE D'INTÉGRITÉ → TEST DE L'APPLICATION
```

Elle doit impérativement préserver la catégorie B.

---

## Conséquence pour l'authentification

Les identités actuelles étant fictives, il est inutile de bâtir une migration
complexe pour les préserver historiquement. Mais l'**architecture** doit être
celle qui accueillera les vraies identités :

> identités de test aujourd'hui → **même architecture Auth** → identités réelles demain

La phase 3 ne sera pas refaite à la mise en production.
