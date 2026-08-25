# Audit de sécurité Supabase — comportement réel

Mené à la clé publiable, celle qu'embarque le navigateur de tout visiteur.
Aucune conclusion tirée d'un nom de politique : chaque ligne est une mesure.

## Méthode

Le catalogue n'est pas lisible avec cette clé — `pg_policies`, `pg_class` et
la spécification OpenAPI exigent `service_role`. L'inventaire est donc bâti
depuis le dépôt : tout nom de table cité dans `src/`, `public/` ou `sql/`,
puis sondé un par un. **42 tables** répondent.

Les écritures sont testées sans rien détruire : un `UPDATE` réécrit une
colonne **à sa valeur actuelle** — s'il renvoie une ligne, le droit d'écrire
est prouvé et rien n'a changé.

## TABLES

| | |
|---|---|
| Tables exposées par l'API | **42** |
| Lisibles par `anon` | **26** |
| Modifiables par `anon` | **25** — toutes les lisibles sauf `journal_audit` |
| Fermées | 16, dont les six déjà traitées |

### Fermé et vérifié

`financement_params`, `inscriptions`, `responsables`, `documents_inscription`,
`users`, `disciplines` — toutes à zéro ligne pour `anon`. Plus
`absences_enseignants`, `allergenes`, `comprehensions`, `manquements`,
`maternelle_alertes_accompagnement`, `maternelle_lectures_assistantes`,
`maternelle_rondes_classes`, `progressions`, `sanctions_personnel` (vides ou
fermées), et `users_secrets` (401).

### Encore ouvert — lecture ET écriture

| Table | Lignes | Données exposées |
|---|---|---|
| `eleves` | 12 | **identité enfant, contact parent, santé, discipline, photo** |
| `devoirs` | 15 | identité, pièces jointes |
| `preparations` | 24 | contenu pédagogique, `url_doc` |
| `app_state` | 33 | **notifications internes, dont celles de la direction** |
| `emploi_du_temps` | 240 | organisation |
| `journal_audit` | 79 | **traces d'audit** — lecture seule, écriture refusée |
| `recrees` | 25 | surveillance |
| `checkpoints` | 20 | suivi pédagogique |
| `performances` | 16 | évaluation du personnel |
| `materiels` | 16 | stock |
| `periodes`, `matieres`, `classes`, `objectifs`, `parametres`, `parametres_mois`, `planifications`, `presences_eleves`, `prof_classes`, `mouvements_stock`, `demandes_materiel`, `documents`, `evenements`, `affectations_matieres`, `maternelle_preparations`, `maternelle_controles_materiel` | 1 à 41 | référentiels et données de service |

## STOCKAGE — deux expositions, de natures différentes

Cinq buckets. Deux ne diffèrent que par une majuscule.

| bucket | public | contenu |
|---|---|---|
| `devoirs` | **true** | 22 fichiers — pièces jointes des devoirs |
| `documents` | **true** | vide |
| `preparations` | **true** | vide |
| `Inscriptions` | **true** | **vide — doublon** de `inscriptions`, créé trois jours plus tôt |
| `inscriptions` | false | photos, signatures, actes de naissance |

### A · `devoirs` est un bucket PUBLIC

Un fichier réel, téléchargé **sans aucune clé**, depuis n'importe où :

```
GET /storage/v1/object/public/devoirs/migration/1783032894322_01.jpg
→ 200 · 172 381 o · image/jpeg · 1170×1566
```

Ce n'est pas une question de politique : le bucket porte `public = true`. Il
se ferme **dans le tableau de bord Storage**, sans SQL et sans propriétaire.

`documents` et `preparations` sont publics aussi, actuellement vides — le
premier fichier déposé y serait public.

`Inscriptions` avec une majuscule est un **doublon vide**, public, créé le
28/06 — trois jours avant `inscriptions`. Rien ne l'écrit : le code utilise la
minuscule partout. À supprimer, sinon un dépôt s'y égarera un jour.

### B · `inscriptions` est PRIVÉ, mais une politique laisse `anon` lire

```
GET /object/public/inscriptions/photos/26-27 A002.jpg  → 400   (sans clé)
GET /object/inscriptions/photos/26-27 A002.jpg         → 200   (clé publiable)
     34 241 o · JPEG
GET /object/inscriptions/documents/…/acte_naissance.png→ 200
    420 881 o · PNG 1170×2532
```

Le drapeau du bucket est bon. C'est une **politique `SELECT` permissive** sur
`storage.objects` qui ouvre `anon`. Son nom reste à relever : je ne
proposerai aucun `drop` sur un nom supposé.

### Ce que le catalogue confirme

`rls_active = true` sur `storage.objects` **et** sur `storage.buckets` —
d'où le `404 Bucket not found` que renvoie l'API des buckets à `anon`, et
le `400` de la route publique sur un bucket privé.



Le bucket `inscriptions` n'est « privé » qu'au sens où la route `/public/`
est fermée (400). **La clé publique, elle, y a un accès complet.**

Mesuré :

```
list inscriptions/            → documents, photos, signatures
list inscriptions/photos      → 26-27 A002.jpg, 30f5a6ca….jpg, …
GET  photos/26-27 A002.jpg    → 200 · 34 241 o · JPEG image data
GET  signatures/26-27 A002.png→ 200 · 55 696 o · PNG 900×660
GET  documents/…/acte_naissance.png → 200 · 420 881 o · PNG 1170×2532
POST /object/sign/…           → une URL signée est délivrée
```

**La photo d'un enfant, la signature manuscrite de son parent et son acte de
naissance sont téléchargeables avec la seule clé publique.** Le nom du fichier
porte le matricule ou l'identifiant du dossier, et la liste les donne tous.

Fermer `documents_inscription` a retiré les métadonnées ; **les fichiers, eux,
sont restés accessibles.**

Écriture : `upload` refusé (403 · new row violates…), `delete` refusé.
La lecture seule est ouverte — c'est déjà tout ce qu'il faut.

## RPC EXÉCUTABLES PAR `anon`

| Fonction | Rend | Verdict |
|---|---|---|
| `creer_inscription(p_dossier)` | dépose un dossier | **légitime** — la surface publique voulue |
| `verifier_carte_scolaire(matricule, nom)` | prénom, nom, classe, année | **légitime** — rien que la carte ne porte |
| `ideal_profil()` | ligne nulle sans session | légitime |
| `ideal_role()`, `ideal_est_direction()` | `null`, `false` | légitime |
| `effectif_cantine_du_jour(p_date)` | **effectifs réels de la cantine** | **à restreindre** — donnée d'établissement, sans raison d'être publique |
| `generer_code_acces` | — | correctement refusé à `anon` |

## CLASSEMENT

### P0 — exposition de données personnelles d'enfants

1. **Bucket `inscriptions`** — photos, signatures, actes de naissance,
   carnets de vaccination téléchargeables à la clé publique.
2. **`eleves`** — 12 lignes : nom, prénom, date de naissance, adresse,
   allergies, contact parent, points de discipline. **Modifiable.**

### P1 — données internes exposées et modifiables

3. `app_state` — notifications de la direction, lisibles et **modifiables**.
4. `preparations`, `devoirs` — contenu pédagogique, modifiable.
5. `performances` — évaluation du personnel.
6. `journal_audit` — 79 traces lisibles. L'écriture est refusée, ce qui est
   juste : un journal qu'on peut réécrire ne prouve rien.

### P2 — référentiels

7. `classes`, `matieres`, `periodes`, `emploi_du_temps`, `materiels`,
   `parametres`, et les autres tables de service. Peu sensibles en lecture,
   mais **toutes modifiables** : un tiers peut changer l'emploi du temps.

## Ce qui reste vrai après tout ce chantier

Les six tables fermées l'ont été correctement, et les deux surfaces publiques
fonctionnent. Mais **25 tables restent modifiables par la clé publique**, et
les documents d'identité des enfants sont téléchargeables.

L'alerte du 23/08 est donc **partiellement corrigée** : le plus visible est
fermé, le plus grave — les fichiers — ne l'est pas.
