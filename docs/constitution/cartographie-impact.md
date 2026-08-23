# Cartographie d'impact — mission transversale

Établie le 23 août 2026, sur `main` à `c769a86`, arbre propre.
Aucune modification de code n'a été faite pour la produire.

Ce document répond à la consigne « ne commence pas par coder, commence par
comprendre ». Il ne propose pas de solutions : il établit **où sont réellement
les fractures**, ce qui existe déjà, et ce qui bloque quoi.

---

## Avertissement de méthode

Onze demandes ont été formulées. Elles ne correspondent **pas** à onze chantiers.
Elles se ramènent à **cinq fractures structurelles**, dont plusieurs sont partagées
par des demandes qui semblaient indépendantes.

Traiter les onze séparément produirait onze correctifs qui se contrediraient. Le
classement A–E qui suit porte donc sur les fractures, pas sur les intitulés.

---

## Fracture 1 · Deux paradigmes pédagogiques incompatibles

**VÉRIFIÉ.**

Le primaire et la maternelle ne décrivent pas l'enseignement dans le même
vocabulaire, et aucune traduction n'existe entre les deux.

| | Maternelle | Primaire |
|---|---|---|
| fichier | `src/lib/programmes/maternelle.js` | `src/lib/programmes/*.js` (22 manuels) |
| structure | section → trimestre → **domaine** → **compétence** | manuel → unité → **leçon** → **page** |
| unité de sens | un comportement observable — « Maîtrise la voyelle I et son son » | une page de livre — « p. 40 » |
| ancrage | **le calendrier** (trimestre) | **l'ordre du livre**, explicitement pas le calendrier |
| réponse à « que sait mon enfant ? » | directe | impossible |

`src/lib/programmes/index.js:63` le dit lui-même : « la leçon suivante est la
suivante du manuel, pas une date au calendrier ». C'est un choix juste pour le
pilotage de l'enseignant. Il rend le **rapport parent impossible à écrire dans la
même langue** des deux côtés de l'école.

**Conséquence directe :** le rapport hebdomadaire demandé ne peut pas être un
document unique tant que cette fracture existe. En maternelle il dirait « votre
enfant reconnaît désormais la lettre I » ; en primaire il ne pourrait dire que
« nous avons fait la page 40 ».

### Ce que la demande « les programmes ne doivent pas être structurés par Boscher » recouvre réellement

**Correction d'une prémisse.** La structure de données n'est **pas** Boscher-centrée,
et ne l'a jamais été. `index.js` indexe les manuels par le couple `(groupe, matière)` :

- 22 manuels, 5 groupes, 6 matières ;
- une matière peut déjà porter **plusieurs** manuels — l'anglais CM1-CM2 en a trois
  (Treasures, Spelling, Grammar) sous la même matière ;
- `src/pages/ProgrammeManuel.jsx` est **déjà** un écran matière-d'abord, alimenté par
  `affectations_matieres`, générique, avec états `chargement` / `erreur` distincts,
  et il expose déjà la liste `sansManuel` — les matières enseignées sans manuel.

L'abstraction demandée **existe**. Ce qui est Boscher-centré, c'est **un artefact
d'interface hérité** :

- `src/pages/SommaireBoscherDocument.jsx` (254 lignes) **recopie en dur** le sommaire
  Boscher dans du JSX. Il n'importe **rien** de `src/lib/programmes/`. Les mêmes pages
  4 à 72 existent déjà dans `src/lib/programmes/lecture-cp2.js`.
  → **deux sources de vérité pour une même donnée réelle de catégorie B.**
- `src/pages/ProfApp.jsx:565` lui donne un bouton dédié dans la barre enseignant.
  **Aucun des 21 autres manuels n'a d'équivalent.** C'est là, et là seulement, que
  Boscher tient lieu de structure.

### La preuve : les deux copies ont déjà divergé

Comparaison programmatique des 70 entrées codées en dur dans le JSX contre les 69
leçons de `lecture-cp2.js` :

| | |
|---|---|
| titres identiques | 52 |
| titres divergents | **18** |
| leçons absentes du document imprimé | aucune |

**Rectification.** Une première passe avait annoncé deux leçons manquantes. C'était
un défaut de mon extraction — les titres contenant une apostrophe échappée
échappaient au motif. Aucune leçon ne manque. Le reste du constat tient, et il est
plus net que le chiffre erroné ne le laissait croire.

La divergence est systématique et orientée : **le document imprimé est la copie
appauvrie.** Sur les quatorze morceaux choisis des pages 59 à 72, il a perdu
**toutes les attributions d'auteur** que le fichier de données conserve :

```
p. 61   imprimé  « Le petit Poucet »
        données  « Le petit Poucet (d'après Charles Perrault) »
p. 67   imprimé  « La chèvre de M. Seguin »
        données  « La chèvre de M. Seguin (Alphonse Daudet) »
p. 69   imprimé  « Le petit sapin »
        données  « Le petit sapin (d'après Hans Christian Andersen) »
p. 71   imprimé  « Jean et Jeanne à la pêche »
        données  « Jean et Jeanne à la pêche (Anatole France) »
```

Perrault, Daudet, Andersen, Verhaeren, Van Lerberghe, Delarue-Mardrus, Anatole
France, Paul Fort, les Margueritte, le Roman de Renart : dix attributions
disparaissent du seul document que l'enseignant a réellement en main. Sur un
programme de lecture, ce n'est pas une perte cosmétique.

Ce n'est donc plus un risque de divergence : **la divergence a eu lieu**, et elle
s'est faite au détriment du document distribué. C'est l'argument décisif contre la
duplication, et il vaut pour les 21 autres manuels : tout document pédagogique qui
recopie son contenu au lieu de le lire finira au même endroit.

**Trous de couverture, visibles seulement dans une vue matière-d'abord :**
CE1-CE2 n'a pas de manuel de Lecture ; CM1-CM2 n'a ni Français, ni Maths (fr), ni
Science. La vue livre-d'abord ne les montre pas ; `ProgrammeManuel` les montre déjà
via `sansManuel`.

---

## Fracture 2 · Le registre de vie scolaire n'a pas d'entrée

**VÉRIFIÉ — deux méthodes indépendantes, même résultat.**

`presences_eleves` n'est **écrite nulle part**. Ni dans `src/`, ni dans `public/`.
Aucun `insert`, `upsert`, `update` ou `delete`. La table est en lecture seule de fait,
et contient 2 lignes.

Elle est pourtant lue à trois endroits :

- `src/pages/ConseillerApp.jsx:59` — statistiques de retards du trimestre ;
- `src/pages/ConseillerApp.jsx:115` — tableau de bord du jour ;
- `public/rapports.html`.

**Le conseiller de vie scolaire pilote un tableau de bord alimenté par une table que
rien ne remplit.** Il affichera 0 retard indéfiniment, et rien ne distingue ce 0 d'une
journée réellement sans retard. La correction Phase 2 a rendu visible l'erreur *réseau*
sur cet écran ; elle ne pouvait rien contre l'absence de source.

Par contraste, `disciplines` **a** ses voies d'écriture — `ProfApp.jsx:402` et
`SignalementIncident.jsx:43`. Les incidents fonctionnent. C'est l'assiduité qui manque.

Le V2.1 §7 exige pourtant : « Les présences alimentent automatiquement les rapports,
tableaux de bord et effectifs de cantine. » La fiche de domaine 5 avait relevé les
2 lignes ; elle n'avait pas établi qu'**aucune voie de saisie n'existe**.

**Conséquence :** le rapport hebdomadaire, la timeline 360° et l'effectif cantine
reposent tous les trois sur ce pilier absent. Construire le rapport avant la saisie,
c'est poser un toit sans mur.

---

## Fracture 3 · Une personne = un métier, décidé côté client

**VÉRIFIÉ.**

`src/App.jsx:161-177` route par une chaîne de `if / else if` qui retourne **une seule**
application, à partir d'**un seul** rôle dérivé :

```
if (poste commence par maitresse-/assistante-) → ProfApp
if (r === 'directeur' || r === 'responsable_administratif') → DirecteurApp
if (r === 'professeur') → ProfApp
if (r === 'surveillant') → SurveillantApp
if (r === 'conseiller_vie_scolaire') → ConseillerApp
if (r === 'cuisiniere') → CuisiniereApp
```

Un directeur qui enseigne obtient `DirecteurApp` et **ne peut jamais atteindre**
`ProfApp`. Il n'existe aucun mécanisme de bascule.

**Plus grave que l'ergonomie :** le rôle est recomposé **dans le navigateur** à partir
de trois champs — `users.role`, `users.fonction`, `users.custom_role` — et
`src/App.jsx:140-142` **réécrit** `u.role` en `'cuisiniere'`. Le serveur, lui, ne connaît
que `users.role` : `ideal_role()` (`sql/phase3_1_socle_auth.sql:193`) lit cette colonne
et rien d'autre.

**Client et serveur divergent déjà aujourd'hui** pour la cuisinière. Ajouter le
multi-rôle par-dessus cette dérivation client-side reviendrait à bâtir les permissions
sur la couche que la Phase 3 vient précisément de retirer de l'autorité.

Le multi-rôle n'est donc pas une fonctionnalité d'interface. C'est une reprise du
modèle d'identité : **une identité, un profil, N responsabilités**, arbitrées côté
serveur. Il ne peut pas précéder la RLS ; il en fait partie.

---

## Fracture 4 · Le contact parent ne laisse aucune trace

**VÉRIFIÉ.**

Dix points d'appel WhatsApp dans sept fichiers, tous en `window.open` :

| fichier | ligne |
|---|---|
| `src/pages/ProfApp.jsx` | 478 |
| `src/pages/InscriptionsValidation.jsx` | 84 |
| `src/pages/DevoirsDocument.jsx` | 137 |
| `public/rapports.html` | 1026 |
| `public/inscription.html` | 1709-1710 |
| `public/comptabilite.html` | 6752, 7035 |
| `public/pedago-archive/app.js` | 1224 |

**Aucun n'enregistre quoi que ce soit.** Le message part, et l'école n'en garde rien.

`src/pages/DevoirsDocument.jsx:137` code encore **un numéro personnel en dur**
(`22390190007`) — contradiction directe avec le V2.1 §8, déjà consignée en fiche de
domaine 6.

**Conséquence :** « suivi des appels aux parents » n'est pas une fonctionnalité neuve.
C'est **le côté écriture manquant de dix actions qui existent déjà**. La demande et la
dette `messages_parents` — consignée après le correctif messagerie — sont le même
chantier. Il ne faut pas les traiter deux fois.

---

## Fracture 5 · L'agenda existe, mais il est nu

**VÉRIFIÉ.**

La table `evenements` existe et est déjà branchée :

- écrite en un point — `src/pages/DirecteurApp.jsx:675` ;
- lue par `DirecteurApp.jsx:306` et `ProfApp.jsx:195`.

Mais le formulaire (`DirecteurApp.jsx:119`) ne produit que trois champs :
`{ titre, date_event, description }`. Ni type, ni audience, ni classe concernée, ni
personne concernée, ni niveau de confidentialité, ni décision, ni action.

Le libellé d'exemple du formulaire est « Réunion Parents-Profs » : **les réunions sont
déjà là conceptuellement**, sans rien pour les porter.

**Conséquence :** « agenda global », « réunions avec décision → action » et
« anniversaires » ne demandent probablement pas trois tables. Ils demandent que
`evenements` cesse d'être un pense-bête. Reste à établir ce que la table porte
réellement en base — inventaire en cours.

---

## Fracture 6 · Vingt-sept documents officiels, un seul gabarit, dix-sept noms d'école

**VÉRIFIÉ** — inventaire exhaustif de `src/` et `public/`.

L'école produit **27 documents** destinés à être imprimés, exportés ou envoyés.
Mesurés sur cinq critères — en-tête, pied, logo, mesures papier déclarées,
typographie commune :

| | nombre |
|---|---|
| conformes | **2** |
| partiels | 15 |
| non conformes | 9 |
| hors gabarit | 1 |

Les deux seuls documents conformes sont `src/pages/DocumentPrintStudio.jsx` — le
moteur lui-même — et le PDF d'inscription (`public/inscription.html:1733`, jsPDF
vectoriel, le seul vrai PDF du dépôt).

### Un système partagé existe, et couvre 4 documents sur 27

`DocumentPrintStudio.jsx` (631 lignes) est réel et bon : `A4 = {210, 297, marge 14}`
— le seul jeu de mesures papier nommé du dépôt —, un en-tête et un pied uniques avec
pagination « page X sur Y » et date d'édition, un sceau typographique, une pagination
qui ne coupe aucun bloc, treize accents de provenance.

Il n'est consommé que par `RecouvrementDocument`, `DevoirsDocument`,
`SommaireBoscherDocument` et `DirecteurApp:2341`. **Et même chez ces quatre, le
partage s'arrête à la coque** : aucun ne respecte l'accent de sa provenance dans son
corps.

`src/components/` **ne contient qu'un seul fichier** — `ui/AccordionCard.jsx`. Il
n'existe ni module de charte, ni jetons documentaires partagés, ni composant d'en-tête
réutilisable. L'en-tête de `BulletinPrimaire.jsx:95-106` et celui de
`DossierPersonnel.jsx:610-621` sont **identiques à la valeur près**, sans composant
commun.

### Correction d'une prémisse : `CartesScolaires.jsx` n'est pas une charte utilisable

Elle a été désignée comme « référence de charte validée ». Le fichier **déclare** une
charte qu'il **n'applique pas** :

- ses constantes `CARTE_L`, `CARTE_H`, `ECHELLE`, `PX_MM` et l'objet `C` ne sont
  **pas exportés** — aucun autre fichier ne peut les importer ;
- sur les **sept** couleurs de `C`, **quatre ne sont jamais employées** (`marine`,
  `bleuClr`, `ambre`, `gris` : zéro occurrence) et deux ne servent que dans le
  placeholder de photo manquante ;
- toutes les surfaces visibles de la carte sont en hexadécimal littéral ;
- **le bleu déclaré (`C.bleu = #174E9E`) n'est pas le bleu employé (`#174E72`)** ;
- `C` est une **recopie manuelle** de la palette jsPDF de `public/inscription.html:1785-1793`
  — correspondance exacte sur six valeurs, mais dans un autre langage, un autre
  fichier, sans lien. Deux exemplaires d'une même charte dérivent déjà.

Ce qui y est juste et réutilisable : `CARTE_L = 54`, `CARTE_H = 85.6`, `PX_MM = 96/25.4`
— des faits physiques du format ID-1. Rien de plus.

### Ce qui diverge

- **Six palettes complètes** mutuellement incompatibles, plus les treize accents du
  moteur. `--blue`, `--green`, `--orange`, `--red` sont définis **quatre fois avec des
  valeurs différentes** : un même nom de jeton ne désigne pas la même couleur d'un
  fichier à l'autre.
- **Huit piles typographiques.** `src/index.css` impose `DM Sans`, `src/App.css`
  impose `Segoe UI` — dans la même application. `ConseillerApp.jsx:495` déclare
  `Inter`, qui n'est chargée nulle part côté React : repli silencieux.
- **Sept régimes de marge** et **cinq unités simultanées** — mm, cm, px, pt, rem.
- **Dix-sept variantes littérales du nom de l'école**, dont `ÉCOLE IDÉAL`
  (`ConseillerApp.jsx:518`, accent erroné, unique dans le dépôt) et `IDEAL Ecole`,
  sans accent, servant de paraphe manuscrit du directeur (`comptabilite.html:7946`). La forme canonique — la seule cohérente — est celle du
  moteur : **« École Internationale Bilingue IDEAL »**.

### Doublons et code mort découverts au passage

- **Deux cartes scolaires officielles coexistent** : `CartesScolaires.jsx`
  (ID-1 54 × 85,6 mm portrait, vrai QR vers `/fiche.html`) et
  `comptabilite.html:7880` (380 × 240 px paysage, **QR décoratif en SVG statique, non
  fonctionnel**, palette sans aucune couleur commune). Formats, orientations et
  palettes incompatibles.
- `BulletinPrimaire.jsx` **n'est monté nulle part** — orphelin.
- `BulletinPrimaire.css` (218 lignes) **n'est importé par aucun fichier**, et porte
  pourtant la seule définition A4 propre du dépôt côté React, dans une palette
  (`#14213D` / `#FCA311`) introuvable ailleurs. Code mort.
- `DevoirsDocument.jsx:137` code toujours un numéro personnel en dur — déjà relevé
  en fracture 4.

### Deux décisions métier que je ne peux pas prendre

1. **Quelle est la forme canonique du nom de l'école ?** Dix-sept variantes circulent
   sur des documents officiels. Ni le V2.1 ni `decisions.md` ne tranchent.
2. **Laquelle des deux cartes scolaires fait foi ?** Elles ne sont pas
   interchangeables : l'une porte un QR de vérification fonctionnel, l'autre non.

Aucune harmonisation ne peut commencer avant ces deux réponses — toute la charte en
découle.

---

## Fracture 7 · Le dossier et l'élève ne sont pas reliés — la fracture qui porte tout le reste

**VÉRIFIÉ en base, ce jour.**

| constat | valeur |
|---|---|
| `eleves` | 12 lignes |
| dont `inscription_id` renseigné | **0 / 12** |
| dont `matricule` renseigné | **0 / 12** |
| dont `date_naissance` renseignée | **0 / 12** |
| `inscriptions` | 7 lignes |
| dont `date_naissance` renseignée | **7 / 7** |
| dont `eleve_id` renseigné | **0 / 7** |
| dont statut ≠ `en_attente` | **0 / 7** |
| `responsables` | 12 lignes |

Les deux moitiés du dossier d'un enfant existent et **ne se touchent pas**. Les dates
de naissance, les responsables légaux, les allergies, le matricule : tout est du côté
`inscriptions`. Les élèves des classes sont de l'autre côté, sans lien.

### La cause, et ce qu'elle n'est pas

Ce n'est **pas** un défaut de code. `valider_inscription_direction`
(`sql/phase1_2_fonctions_cantine.sql:316-324`) fait exactement ce qu'il faut : il
insère dans `eleves` avec `inscription_id`, `matricule`, `date_naissance`, `sexe`,
`classe_id`, et gère le conflit sur matricule.

**Les sept inscriptions sont toutes `en_attente`. La fonction n'a jamais été exécutée
de bout en bout.** Les douze élèves présents datent d'avant le pipeline d'inscription
et ont été créés par une autre voie.

### Ce que cela invalide dans mon rapport précédent

**Le correctif messagerie parents ne résout aucun responsable sur le jeu de données
actuel.** J'ai vérifié la requête exacte de `ProfApp.jsx` contre la production :

```
eleves actifs renvoyés          : 12
eleves avec un dossier résolu   : 0
eleves avec au moins un responsable : 0
```

La requête est syntaxiquement juste et la jointure `eleves_inscription_id_fkey` est la
bonne. Elle ne ramène rien parce que la clé est NULL partout. L'enseignant verra ses
élèves et l'état « aucun responsable » pour chacun.

J'avais vérifié la correction de la requête et les états d'erreur de connexion ; je
n'avais pas vérifié qu'un responsable se résolvait réellement sur les données en
place. Le code est bon, la chaîne de données est vide. **Le correctif fonctionnera
pour tout élève créé par validation, et pour aucun des douze élèves hérités.**

### Pourquoi c'est la fracture centrale

Quatre des fonctionnalités demandées reposent **toutes** sur ce même lien :

| fonctionnalité demandée | dépend de |
|---|---|
| anniversaires | `eleves.date_naissance` ← validation |
| suivi des appels aux parents | `eleves → inscriptions → responsables` ← validation |
| timeline élève 360° | même chaîne |
| rapport hebdomadaire | même chaîne, pour l'adresser au bon responsable |

**Aucune ne demande de nouveau schéma.** Elles demandent que le pipeline tourne.

**Conséquence pratique :** faire passer **une** inscription par la validation, de bout
en bout, prouverait la chaîne entière et débloquerait quatre demandes d'un coup. C'est
l'acte au plus fort levier de toute la mission. Il crée une donnée en production et
relève donc de votre autorisation.

---

## Fracture 8 · Le substrat existe plus souvent qu'on ne le croit

**VÉRIFIÉ en base.** Contrairement à ce que la liste des demandes laissait attendre,
**très peu de tables nouvelles sont nécessaires.**

### `presences_eleves` — le schéma est complet, seule la saisie manque

```
id · eleve_id · date_jour · statut · minutes_retard · justification
   · heure_arrivee · heure_depart · retard_matin · retard_soir · created_at
```

Justification, retard matin/soir séparés, heures d'arrivée et de départ : la table
répond déjà au §7 du V2.1. **Rien à ajouter au schéma.** Il manque un écran de saisie,
et lui seul (fracture 2).

### `evenements` — trop pauvre pour l'usage demandé

```
id · titre · date_event · description · created_at
```

Deux lignes. Pour porter l'agenda global, les réunions, les décisions, les actions et
la confidentialité, il manque : type, heure, lieu, audience, niveau de
confidentialité, et le rattachement à une classe, un élève ou une personne. C'est
**une extension de table, pas une table nouvelle** — et c'est le seul schéma qu'il
faille réellement faire évoluer.

### Timeline 360° — deux sources seulement, dont une vide

Tables portant à la fois `eleve_id` et une date :

| table | date | lignes |
|---|---|---|
| `presences_eleves` | `date_jour` | 2 — **jamais écrite** |
| `disciplines` | `date_incident` | 4 — écrite, fonctionne |
| `inscriptions` | `date_signature` | 7 — non reliées |
| `progressions` | — | **0** |
| `comprehensions` | — | **0** |

`devoirs` est au niveau de la classe, pas de l'élève. `checkpoints` (20 lignes) passe
par `planifications`, dont il n'existe **qu'une seule ligne**, et `objectifs` n'en
compte qu'une — ce qui confirme la dette d'objectifs orphelins déjà consignée.

**La timeline n'a donc aujourd'hui qu'une seule source vivante : les incidents.** Ce
n'est pas un problème d'agrégation, c'est un problème d'alimentation.

### `users` — deux colonnes fantômes dans le routeur

Colonnes réelles :

```
id · role · prenom · nom · email · telephone · residence
   · situation_matrimoniale · langue · actif · created_at
   · fonction · identifiant · auth_user_id
```

**`custom_role` n'existe pas. `poste_id` n'existe pas.** Or `src/App.jsx` les lit tous
les deux — `App.jsx:140`, `:164`, `:124`, `:182` — et `App.jsx:70` inscrit
`custom_role` dans la liste blanche de session.

Ces tests sont donc **toujours faux**. La réaffectation `u.role = 'cuisiniere'` de
`App.jsx:141` ne se déclenche jamais… et n'a aucune raison de se déclencher :
`cuisiniere` **est déjà une valeur de `users.role`** en base. Le mécanisme entier est
du code mort bâti sur deux colonnes qui n'ont jamais existé.

Cela **simplifie** la fracture 3 : il n'y a pas de dérivation client à démanteler, il
y a du code mort à retirer. Le rôle serveur et le rôle client sont d'accord ; c'est le
détour qui est fictif.

Rôles réellement en base — six valeurs, treize comptes :

```
professeur 6 · responsable_administratif 2 · surveillant 2
directeur 1 · conseiller_vie_scolaire 1 · cuisiniere 1
```

`fonction` n'est renseignée que pour **un** compte sur treize (`bnabo2`,
`maitresse-fr-mat`) — c'est pourtant elle qui pilote le routage maternelle.

### Multi-rôles — aucune donnée à préserver

- `prof_classes` : 12 lignes, **toutes** tenues par un `professeur` ;
- `affectations_matieres` : 41 lignes, **aucune** tenue par un non-professeur.

Aucun directeur n'a d'affectation pédagogique aujourd'hui. Le multi-rôle n'a donc
aucun existant à migrer — **mais 20 des 41 affectations ont un `prof_id` qui ne
résout vers aucun utilisateur.** Anomalie d'intégrité à traiter avant de bâtir des
permissions dessus.

### Bilan : tables nouvelles réellement indispensables

| besoin | verdict |
|---|---|
| présences / retards | `presences_eleves` **suffit** |
| anniversaires | `eleves.date_naissance` **suffit** |
| timeline 360° | **aucune table** — une vue de lecture sur l'existant |
| agenda global | `evenements` **étendue** |
| réunions, décisions, actions | `evenements` étendue **+ une table d'actions** |
| suivi des appels parents | **une table** — le `messages_parents` déjà en dette |
| multi-rôles | **une table** de responsabilités, ou une colonne tableau |
| rapport hebdomadaire | **aucune table** — agrégation |
| documents officiels | **aucune table** — un module de charte |

**Sur onze demandes : trois objets nouveaux, une extension.** Le reste est déjà là.

---

## Classement des travaux

Le classement porte sur les **fractures**, pas sur les onze intitulés : plusieurs
demandes se résolvent dans le même geste, et les traiter séparément produirait des
correctifs contradictoires.

### A — Corrections sans migration

Aucune écriture en base, aucun schéma touché. Réversibles par `git revert`.

| # | travail | fracture | preuve établie |
|---|---|---|---|
| A1 | Faire lire au sommaire Boscher `lecture-cp2.js` au lieu de son JSX codé en dur | 1 | 18 titres divergents, 10 auteurs perdus |
| A2 | Retirer `custom_role` et `poste_id` du routeur — colonnes inexistantes | 3, 8 | absentes du schéma `users` |
| A3 | Rendre l'écran vie scolaire honnête sur une source jamais alimentée | 2 | zéro voie d'écriture vers `presences_eleves` |
| A4 | Retirer le numéro personnel codé en dur de `DevoirsDocument.jsx:137` | 4 | contredit le V2.1 §8 |
| A5 | Corriger `ÉCOLE IDÉAL` → forme canonique (`ConseillerApp.jsx:518`) | 6 | orthographe unique et erronée |
| A6 | Statuer sur les orphelins `BulletinPrimaire.jsx` + `.css` | 6 | non montés, non importés |

**A1 est le plus rentable** : il supprime une source de vérité en double sur une
donnée réelle de catégorie B, et rend aux enseignants les attributions d'auteur que
le document imprimé avait perdues.

### B — Composants réutilisables

Sans migration eux aussi, mais ils changent la forme du code, pas seulement son
comportement. À ne pas entreprendre avant les deux décisions métier ci-dessous.

| # | travail | fracture |
|---|---|---|
| B1 | Un module de charte — jetons de couleur, typographie, mesures papier, nom canonique | 6 |
| B2 | Étendre `DocumentPrintStudio` de 4 documents vers les 15 « partiels » | 6 |
| B3 | Un composant d'en-tête unique, remplaçant les copies littérales | 6 |
| B4 | Une vue de lecture « timeline élève », agrégeant l'existant sans table nouvelle | 8 |

`src/components/` ne contient qu'un fichier aujourd'hui. B1–B3 sont la première
brique réellement partagée du dépôt.

### C — Évolutions de schéma

Passent toutes par vous : je n'ai que la clé anon, aucun DDL possible.

| # | travail | objet |
|---|---|---|
| C1 | Écran de saisie des présences | **aucun schéma** — `presences_eleves` est déjà complète |
| C2 | Étendre `evenements` : type, heure, lieu, audience, confidentialité, rattachement | extension |
| C3 | Table des actions issues des réunions (décision → action → responsable → échéance) | table nouvelle |
| C4 | Table `messages_parents` — le côté écriture des 10 points d'appel WhatsApp | table nouvelle, **déjà en dette** |
| C5 | Responsabilités multiples par personne | table nouvelle ou colonne tableau |
| C6 | Assainir les 20 affectations dont le `prof_id` ne résout vers personne | correction de données |

C1 n'est pas une évolution de schéma malgré son emplacement ici : je le laisse en C
parce qu'il crée des écritures en production.

### D — Permissions et RLS

| # | travail |
|---|---|
| D1 | Sortir les codes en clair de `users_secrets` — **critère de sortie de la phase 3, non tenu** |
| D2 | RLS progressive par workflow, sur le socle `ideal_profil()` / `ideal_est()` |
| D3 | Multi-rôles arbitrés côté serveur (dépend de C5 et D2) |
| D4 | Confidentialité des réunions (dépend de C2, C3 et D2) |

### E — Dépendant d'une phase ultérieure

| # | travail | bloqué par |
|---|---|---|
| E1 | Rapport hebdomadaire par enfant | fractures 1, 2 et 7 — aucune de ses trois sources n'est alimentée |
| E2 | Réconcilier les deux paradigmes pédagogiques | décision métier, chantier à part entière |
| E3 | Harmoniser les 27 documents | deux décisions métier en attente |
| E4 | Trancher laquelle des deux cartes scolaires fait foi | décision métier |

---

## Ordre d'exécution proposé

Par dépendance, du plus sûr au plus engageant.

```
0.  Une inscription validée de bout en bout          ← votre autorisation
      débloque : anniversaires · timeline · appels parents · rapport
1.  A1 A2 A4 A5    corrections pures, réversibles
2.  A3 A6          après arbitrage sur les orphelins
3.  C6             assainir les affectations orphelines
4.  C1             écran de saisie des présences
5.  D1             sortir les codes en clair — clôt la phase 3
6.  B1 B2 B3       module de charte, après vos deux décisions
7.  C2 C4 C5       schéma : agenda, messages, responsabilités
8.  D2 D3 D4       RLS, puis multi-rôles, puis confidentialité
9.  B4 E1          timeline, puis rapport hebdomadaire
```

L'étape 0 n'est pas un préalable formel : c'est le seul acte qui transforme quatre
fonctionnalités « à construire » en fonctionnalités « à vérifier ».

---

## Ce que je ne peux pas décider

Trois arbitrages métier bloquent des lots entiers. Ni le V2.1 ni `decisions.md` ne les
tranchent.

1. **La forme canonique du nom de l'école.** Dix-sept variantes circulent sur des
   documents officiels. Toute la charte en découle. *(bloque B1, B2, B3, E3)*
2. **Laquelle des deux cartes scolaires fait foi.** Elles ne sont pas
   interchangeables : celle de `CartesScolaires.jsx` porte un QR de vérification
   fonctionnel, celle de `comptabilite.html` un QR décoratif inerte. *(bloque E4)*
3. **Valider une inscription en production.** L'acte crée un élève réel et relie le
   dossier. Irréversible sans suppression. *(bloque l'étape 0, donc quatre demandes)*

Une quatrième question, moins urgente : `bnabo` est inactif et `bnabo2` est
l'enseignante en poste. L'identifiant suffixé revient à la personne active. À corriger
quand vous le jugerez opportun.
