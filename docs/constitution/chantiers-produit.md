# Chantiers produit — exigences enregistrées, hors périmètre immédiat

Exigences du promoteur à conserver et à traiter dans la phase indiquée. Ne pas
les implémenter par anticipation ; ne pas les perdre non plus.

---

## Principe UX durable

> **UNE INFORMATION → UNE SAISIE → PLUSIEURS RESTITUTIONS**

IDEAL doit réduire le travail administratif du personnel, pas l'augmenter. Toute
évolution qui impose une double saisie contredit ce principe et la règle d'or du
V2.1.

---

## Fiche parent dérivée de la préparation — phase pédagogique

**Aucune ressaisie.** La fiche destinée au parent se déduit de la préparation déjà
saisie par l'enseignant.

### Maternelle

- préparation de la maîtresse saisie une fois ;
- fiche parent journalière globale, personnalisée par enfant ;
- design adapté et imprimable ;
- matières regroupées ;
- objectifs et progression par séquence.

### Primaire

- préparation saisie une fois ;
- fiche parent générée automatiquement par matière ;
- présentation sobre et imprimable ;
- titre de la leçon · points importants · objectif · ce que l'enfant doit savoir
  ou être capable de faire · progression de la séquence.

Forme attendue :

```
Mathématiques
Reconnaître les nombres 0 et 1
Séquence 2 / 4

Objectif :
À la fin de cette progression, l'enfant devra être capable de reconnaître
les chiffres 0 et 1 et d'associer les quantités correspondantes.
```

**Lien avec le V2.1 :** §10 et §11 pour les préparations, §8 pour le canal
parental, §12 pour la présentation imprimable.

---

## Maternelle — l'horodatage ne doit pas être punitif

Le réseau malien rend fragile toute règle fondée sur l'heure exacte
d'enregistrement serveur.

**Règle cible :** la préparation doit être **soumise dans la journée concernée**.
Une synchronisation tardive causée par une panne ne doit pas faire passer un
travail réellement effectué dans la journée pour un retard.

Le système devra distinguer, quand l'architecture le permettra :

```
moment de saisie locale  ≠  moment de synchronisation serveur
```

Cela suppose d'horodater côté client et de conserver les deux dates. À traiter
dans le chantier pédagogique, pas avant.

---

## Chantier performance et résilience réseau

IDEAL sera utilisée là où la connexion est lente, instable ou absente. Contrainte
**structurelle**, pas confort.

### Traité en phase 3

- session Auth persistante, jeton renouvelé en tâche de fond ;
- pas de reconnexion inutile après une coupure ;
- pas de requête préalable avant la connexion — l'adresse Auth est déterministe.

### Traité en phase 2

- distinction chargement / erreur / vide légitime ;
- aucun faux « 0 élève » sur une panne.

### À traiter — chantier dédié

- **états manquants** : `OFFLINE` et `SESSION EXPIRÉE` ne sont pas encore
  distingués de l'erreur réseau générique ;
- chargement progressif : `DirecteurApp` lance 13 requêtes au montage, dont
  plusieurs pour des onglets jamais ouverts ;
- réduction des requêtes inutiles ;
- cache sûr des données de référence en lecture seule — programmes, classes,
  matières, allergènes changent rarement ;
- **conservation du travail non synchronisé** : aujourd'hui une préparation ou
  une fiche perdue en cours de saisie est perdue ;
- reprise de synchronisation après reconnexion ;
- sortie des images base64 d'`app_state` — 3,26 Mo dans une seule ligne, chargés
  intégralement à chaque lecture.

**Ne pas transformer une phase en refonte offline-first.** Chaque phase traite ce
que son objectif exige, et consigne le reste ici.
