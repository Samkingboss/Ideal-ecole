# État des lieux — Plateforme École IDEAL

Document de reprise, à jour au **16 août 2026** (programme du manuel Maths CP1).
Il sert à poursuivre le travail dans une nouvelle conversation sans repartir de
zéro.

---

## 1. Le projet

**École Internationale Bilingue IDEAL**, Faladiè Sema, Bamako (Mali).
Directeur : Samuel Mogadzi. Rentrée visée : **2026-2027**.

| | |
|---|---|
| Dépôt local | `~/Desktop/ideal-ecole` |
| GitHub | `Samkingboss/Ideal-ecole`, branche `main` — **dépôt public** |
| Hébergement | Vercel — `ideal-ecole.vercel.app`, déploiement auto sur push |
| Base | Supabase `jircuneixzwsmtktxrkh` (offre **gratuite** : pas de restauration à un instant donné) |
| Stack | React + Vite (portail) et pages statiques dans `public/` |

**Attention réseau** : `pages.dev` (Cloudflare) est bloqué par le DNS malien.
`vercel.app`, `netlify.app` et `github.io` passent.

---

## 2. Les comptes et leur espace

| Rôle | Écran | Contenu |
|---|---|---|
| `directeur` | `DirecteurApp.jsx` | 6 sessions : Agenda, RH, Personnel, Pédagogie, Discipline, Synthèse |
| `responsable_administratif` | `DirecteurApp.jsx` (branche dédiée) | 3 sessions : Gestion Élèves, RH & Paie, Comptabilité |
| `professeur` | `ProfApp.jsx` | 6 sessions : Emploi du temps, Pédagogie, Ma Classe, Discipline, Perfs & Prime, Dossier RH |
| `conseiller_vie_scolaire` | `ConseillerApp.jsx` | Stats, Élèves (consultation seule), Pointage, Agenda, Rapports, Retards |
| `surveillant` | `SurveillantApp.jsx` | Pointage enseignants, Discipline |
| `cuisiniere` | `CuisiniereApp.jsx` | 5 sessions : Élèves cantine, Checking repas, Préparation menu, Affiche hebdo, Fiche du marché |

Pages statiques : `inscription.html` (dossiers élèves), `comptabilite.html`,
`rapports.html` (rapports hebdomadaires élèves), `pedago-archive/` (devoirs).
Chacune a un garde d'accès par rôle et, depuis peu, un bouton de déconnexion.

---

## 3. L'organisation pédagogique

Source : document **« Emploi du temps Primaire Ideal » v1.0** fourni par le
directeur (fichier `.docx` sur son Bureau).

- La journée compte **12 séquences de 30 minutes** : S1 08h00 … S6 11h00
  (bloc 1), S7 11h30 … S12 15h30 (bloc 2). Récréations (10h00, 15h00) et
  déjeuner (12h00) **ne sont pas** du temps d'enseignement.
- Temps réellement enseigné : **360 min/jour**, 30 h/semaine. *(La plateforme
  utilisait 480 avant correction — elle comptait les pauses.)*
- **6 classes**, mais **4 grilles** : CP1, CP2, CE1-CE2 et CM1-CM2 sont
  jumelées deux à deux.
- **Alternance hebdomadaire** : en semaine paire, les blocs matin et
  après-midi sont permutés (S1↔S7 … S6↔S12). Seule la grille des semaines
  impaires est stockée ; la permutation se calcule à la lecture.
- Charges visées : Faty 23 h, Ornella 20 h, Michel 20 h, Terfa 19 h,
  Catherine 18 h, Yacouba et Samuel 10 h (direction).
- Réunion d'équipe **chaque vendredi 12h–13h**.

Moteur : `src/lib/sequences.js`.

### Le programme des matières à manuel

Depuis le 16 août 2026, une matière peut suivre le sommaire d'un manuel.

- Un manuel est un **fichier versionné** dans `src/lib/programmes/`, repéré par
  le couple `(groupe, matière)` de l'emploi du temps. Pas de table : le
  sommaire d'un livre imprimé ne se saisit pas et ne doit pas pouvoir être
  supprimé. Ajouter un manuel = un fichier + une ligne dans `MANUELS`.
- Manuels enregistrés :
  - **Math CP — La méthode de Singapour**, pour Maths CP1 (`maths-cp1.js`) —
    7 unités, 57 entrées dont 7 bilans, pages 6 à 139. La numérotation est
    celle du livre, trous compris (8, 14, 24, 35, 43, 53 sont des ouvertures
    d'unité). Enseignant : Yacouba OUANG, 9 séquences/semaine.
  - **Mathématiques CP2 — La méthode de Singapour**, pour Maths CP2
    (`maths-cp2.js`) — second volume de la même collection : unités 8 à 17,
    leçons 65 à 127 sans trou, pages 7 à 112 (la pagination repart à 7).
    Chaque unité s'ouvre par « Observons l'image » et se ferme par « Ce que
    j'ai appris », et porte son domaine (Nombres et calculs, Grandeurs et
    mesures, Espace et géométrie). Enseignant : Yacouba OUANG,
    8 séquences/semaine.
  - **Pas à Pas, je lis — CP1**, pour Lecture CP1 (`lecture-cp1.js`) —
    24 étapes dont 2 mots outils, pages 5 à 129 sans trou. Enseignante :
    Ornella MOGADZI, 11 séquences/semaine.
  - **Méthode Boscher — La journée des tout petits**, pour Lecture CP2
    (`lecture-cp2.js`) — 6 phases, 69 entrées, **une par page**, de la page 4
    à la page 72. Les pages 1 à 3 (titre, crédits, préface) n'y sont pas :
    ce ne sont pas des séances, et le sommaire de l'école porte lui-même le
    programme sur les pages 4 à 72. Enseignante : Ornella MOGADZI,
    8 séquences/semaine.
  - **Les Petits Devoirs — Français** (La Librairie des Écoles), pour
    Français CP2 (`francais-cp2.js`) — 58 leçons numérotées, sans unités,
    pages 4 à 118 de deux en deux (une double page par leçon). Le mémento
    d'analyse grammaticale (p. 124) et les dictées (p. 126) n'y sont pas : ce
    ne sont pas des leçons numérotées, et les dictées sont un réservoir
    d'exercices où l'on puise toute l'année, pas une étape du parcours.
    Enseignante : Ornella MOGADZI, 4 h/semaine.
  - **Treasures — Grade 1** (Macmillan/McGraw-Hill), pour English CP1
    (`english-cp1.js`) — 6 volumes, 30 thèmes, **156 entrées**. Chaque thème
    compte cinq entrées dans le même ordre (Talk About It, Words to Know,
    lecture principale, lecture associée, atelier d'écriture) ; chaque volume
    se referme sur une Test Strategy, qui forme sa propre section. Les
    glossaires de fin de volume n'y sont pas. Enseignante : Juliette NGONE,
    6 h/semaine.
  - **Cambridge Primary Mathematics**, pour Mathematics CP1
    (`mathematics-cp1.js`) — 16 unités, 31 sections numérotées 1.1, 1.2, 2.1…
    Les pages de présentation (« How to use this book », « Thinking and
    Working Mathematically ») et les remerciements n'y sont pas.
    **Aucun enseignant n'est affecté à cette matière** (3 h 30/semaine) : le
    programme est prêt mais ne s'affiche dans aucun compte, l'écran listant les
    manuels à partir des affectations.
- **Deux structures de livre sont admises**, parce que deux livres ne se
  ressemblent pas : un manuel déclare soit `unites` (découpage numéroté, écran
  en accordéon), soit `lecons` (progression continue, liste). Un livre qui ne
  numérote pas ses étapes pose `numerote: false` ; ses étapes sont alors
  identifiées par leur **page de début**, pas par un rang. Cet identifiant est
  stable : corriger une plage plus tard ne renumérote pas les étapes déjà
  visées par des préparations déposées. Les deux réglages se combinent
  librement, et les quatre combinaisons sont en service : Singapour (unités +
  numéros), Boscher (unités sans numéros), Les Petits Devoirs (numéros sans
  unités), Pas à Pas (ni l'un ni l'autre).
- `situationDe()` produit la phrase qui situe une étape, et elle seule :
  « Unité 1 · leçon 2 · manuel p. 6 » chez Singapour, « Unité 1 · manuel p. 4 »
  chez Boscher, « manuel p. 36–41 » chez Pas à Pas. Ne jamais réécrire ce
  libellé à la main dans un écran : annoncer « leçon 4 » là où 4 est un numéro
  de page trompe l'enseignant.
- `rubrique` porte la mention imprimée au-dessus d'une unité : un domaine chez
  Singapour (Nombres et calculs…), une partie chez Boscher (Première partie —
  l'apprentissage syllabique), un volume chez Treasures.
- `libelleUnite` dit comment le livre appelle ses sections — « Unité » par
  défaut, « Thème » chez Treasures, dont les *Units* imprimées désignent les
  six volumes et non les sections de l'écran. Reprendre le mot « unité » y
  ferait contresens.
- **L'identifiant d'une entrée doit être unique sur tout le manuel.** Chez
  Treasures la page n'y suffit pas : les volumes 1 à 4 commencent tous page 6.
  On y identifie donc par `volume * 1000 + page`. Ce nombre ne s'affiche
  jamais.
- `code` porte la référence que le livre imprime lui-même quand elle n'est pas
  un simple numéro — « 9.2 » chez Cambridge. Elle s'affiche dans la pastille,
  dans la liste de la fiche et sur la fiche imprimée. L'identifiant interne
  reste un entier (`unité × 10 + section`) : une section décimale ferait un
  mauvais identifiant, 1.1 n'ayant pas de représentation binaire exacte.
- La fiche de préparation d'une matière à manuel **exige** une leçon, proposée
  par défaut à la suivante du livre. Le choix est écrit dans
  `preparations.contenu.programme` — donc **aucune migration** : la colonne
  `contenu` est déjà du JSONB.
- L'avancement n'est jamais déclaré : il se **déduit** des préparations
  déposées. Une leçon est traitée parce qu'une fiche la vise.
- Les matières sans manuel (Sport, Arts, Savoir-vivre…) gardent la préparation
  libre. `Mathematics` (CP1, anglais, 7 séquences/semaine) attend son manuel et
  n'a **toujours pas d'enseignant affecté**.

Moteur : `src/lib/programmes/index.js`. Écran : `ProgrammeManuel.jsx`.

### Refonte du français en CP2 — 16 août 2026

Sur décision du directeur, **Grammaire, Orthographe et Vocabulaire ont été
supprimées du CP2** : la classe ne garde que **Lecture et Français**. Leurs
8 créneaux (4 h/semaine) sont devenus des créneaux de **Français**, affectés à
Ornella MOGADZI. Le total du CP2 reste à 60 séquences, 30 h/semaine, et la
charge d'Ornella à 20 h — conforme au document officiel.

- L'**Écriture CP2** n'est pas concernée : elle garde ses 4 créneaux.
- Les trois matières **subsistent en CE1-CE2 et en CM1-CM2** (22 créneaux au
  total). Rien n'y a été touché.
- Aucune préparation ni fiche de fin de cours ne visait ces matières : la
  bascule n'a rien orphelin.
- Sauvegarde des 8 créneaux et des 3 affectations avant modification, hors
  dépôt. Le manuel `grammaire-cp2.js` a été supprimé du répertoire.
- Le programme de Français a été fourni le jour même : « Les Petits Devoirs —
  Français », même collection que la grammaire retirée.

---

## 4. État de la base

| Table | Lignes | Remarque |
|---|---|---|
| `users` | 8 | dont 3 professeurs, 1 cuisinière |
| `classes` | 8 | dont Petite et Grande Section (hors document) |
| `emploi_du_temps` | 240 | 4 groupes × 5 jours × 12 séquences |
| `affectations_matieres` | 49 | **aucune n'est encore attribuée** |
| `preparations` | 17 | |
| `prof_classes` | 6 | |
| `comprehensions` | 0 | |
| `absences_enseignants` | 0 | |
| `eleves`, `inscriptions`, `presences_eleves` | 0 | **purge volontaire des données de test** |

Scripts SQL dans `sql/` : `emploi_du_temps.sql`, `comprehensions.sql`,
`absences_enseignants.sql`, `preparations_formulaire.sql`. Tous **déjà
exécutés**.

---

## 5. Pièges vérifiés — à ne pas réapprendre

1. **DDL impossible par l'API.** Aucune RPC `exec_sql` ; la Management API
   refuse la clé `sb_secret_*`. Tout passe par le SQL Editor du dashboard,
   que le directeur ouvre lui-même (session GitHub, sur Opera).
2. **Supabase active RLS d'office sur toute nouvelle table**, sans politique :
   la lecture renvoie 200 et une liste vide, mais **toute écriture est
   refusée en 401**. Toujours livrer les politiques dans le même script.
3. **`app_state` a une clé primaire composite `(app, key)`**, et `app` est
   obligatoire. L'omettre fait échouer l'écriture en 400. C'est ce qui a
   paralysé les notifications et les demandes RH.
4. **Un `DELETE` refusé par RLS renvoie 204 avec 0 ligne supprimée.** Ne
   jamais lire ce code comme un succès : vérifier que la ligne a disparu.
5. **Le directeur ne peut pas coller une chaîne longue** : son environnement
   masque les JWT et copie des puces « • ». `src/lib/supabase.js` reconstitue
   la clé depuis 6 fragments courts. Ne jamais lui demander de coller une clé.
6. **`min-width: auto` sur un élément flexible** l'empêche de rétrécir sous
   la largeur de son contenu — cause classique de débordement sur téléphone.
7. **html2canvas n'applique pas `object-fit`.** Ne jamais fixer les deux
   dimensions d'une image : choisir la hauteur, déduire la largeur du rapport
   réel du fichier.
8. **`logo-ideal.svg` est en PORTRAIT (2416×3007).** La version horizontale
   utilisable est `logo-ideal.png` (1032×375).

---

## 6. Règles posées par le directeur

- **Tout visuel destiné aux parents est en format portrait**, design
  professionnel : ils lisent sur téléphone. ~640 px de large, ratio ≈ 1:1,9.
- **Qualité indiscutable** sur les documents envoyés aux parents : PNG plutôt
  que JPEG, définition 1920 px — même si le fichier atteint 1 Mo.
- **Numéro WhatsApp de l'école : +223 90 19 00 07.** Tout part vers ce
  numéro, l'école relaie ensuite à chaque parent. Aucun numéro de parent
  n'est stocké.
- **Un message par enfant** quand un devoir ne vise que quelques élèves.
- **Les inscriptions relèvent du responsable administratif seul.** Le
  conseiller consulte la liste des élèves mais ne la modifie plus.
- **Le conseiller de vie scolaire relève l'heure d'arrivée de tous**, élèves
  et enseignants. Le surveillant assure le suivi des enseignants.
- **Paiements quotidiens sur Wave**, au même numéro.

---

## 7. La rémunération des enseignants

125 000 FCFA garantis sur 9 mois, puis juillet/août/septembre proportionnels
aux points accumulés. Coefficients croissants par trimestre (1 / 1,5 / 2),
450 points au maximum. Moteur : `src/lib/points.js`.

**Barème actuel** (100 points par trimestre) :

| Indicateur | Points | Cible | Nature |
|---|---|---|---|
| Séances préparées à temps | 35 | 12 | automatique, **proratisé sur la charge** |
| Fiches de fin de cours remplies | 30 | 24 | automatique, proratisé |
| Ponctualité et assiduité | 25 | 55 j | automatique |
| Présence aux réunions du vendredi | 10 | 12 | **saisie manuelle** |

Corrections déjà appliquées, à ne pas défaire :
- Une journée **sans heure d'arrivée relevée ne rapporte plus rien** (avant,
  elle valait le maximum : ne pas être pointé était plus rentable).
- Les cibles se **proratisent sur les heures réellement affectées** : à 10 h,
  on n'exige pas ce qu'on attend à 20 h.
- L'indicateur « rapports hebdomadaires » a été retiré : ils sont produits
  par le conseiller, pas par l'enseignant.
- « Fiches de fin de cours » compte **l'acte d'évaluer, jamais les notes** —
  l'enseignant note lui-même ses élèves, l'indexer sur le niveau
  l'inviterait à surnoter.
- **Neutralisation** : une absence justifiée, pièce à l'appui validée par le
  responsable administratif, sort de l'attente. Une contrainte en base refuse
  qu'une absence soit déclarée justifiée sans pièce ni validateur.

### Prêts et avances sur salaire

Règles posées par le directeur le 16 août 2026.

- **Prêt** : de 20 000 à 150 000 FCFA, par tranches de 5 000. Le remboursement
  s'achève **impérativement en mai** : la durée n'est donc pas un choix, elle se
  déduit du mois de la demande, première retenue le mois même. Une demande en
  août donne 10 mensualités, une demande en mai une seule. L'écran affiche
  l'échéancier et la mensualité qui en découle.
- **Avance** : à partir de 20 000, plafonnée à **la moitié du salaire du
  demandeur**, et déduite en une fois sur la paie de fin de mois.

Le salaire de chaque employé se saisit dans **Gestion du Personnel → Activité du
Personnel**, et se range dans `app_state (rh, personnel)` — la même clé que lit
l'écran de la prime. Tant qu'un salaire n'est pas renseigné, la plateforme ne
plafonne pas l'avance et **le dit à l'enseignant** plutôt que de laisser croire
à un contrôle qui n'a pas lieu.

Paliers d'avantages : bourse enfant après 3 ans d'ancienneté, formation après
5 ans ; à 5 ans l'enseignant choisit entre 100 % de bourse enfant ou une
bourse d'études déclarée dès la 3ᵉ année sans incident.

---

## 8. Ce qui a été construit récemment

| Fonction | Fichiers |
|---|---|
| Emploi du temps personnel, agenda hebdomadaire, archives | `MonEmploiDuTemps.jsx` |
| Fiche de préparation depuis une cellule (imprimable) | `FichePreparation.jsx` |
| Fiche de fin de cours, note /100 | `FinDeCours.jsx` |
| Affectation des matières aux enseignants | `AffectationsMatieres.jsx` |
| Absences et justificatifs | `comptabilite.html` |
| Message parents illustré, un par enfant | `pedago-archive/app.js` |
| Rapport hebdomadaire agrégé, prouesse et point à améliorer | `rapports.html` |
| Notifications et demandes RH | `lib/notifications.js`, `NotificationCenter.jsx`, `DemandesEnseignant.jsx` |
| Programme du manuel, avancement de la classe | `lib/programmes/`, `ProgrammeManuel.jsx` |

Commits de référence : `0bfb302` (notifications), `3fd1db9` (mobile),
`e154bc7` (séquences), `2fd9a41` (grilles officielles).

---

## 9. À FAIRE — par ordre de priorité

### Défauts connus, non corrigés

1. **`PerformancesDirecteur.jsx` n'affiche rien.** Il filtre `checkpoints`,
   `recrees` et `manquements` sur une colonne `user_id` **qui n'existe dans
   aucune des trois** (c'est `prof_id` pour les check-points ; les deux
   autres n'ont pas de colonne d'enseignant). Ponctualité et présence sont
   donc vides pour tout le monde.
2. **Aucune clé étrangère ne relie `progressions` à `objectifs`.** Toute
   requête qui demande cette jointure échoue en 400 : chez le directeur
   (`DirecteurApp.jsx`, ~ligne 188) comme chez l'enseignant
   (`ProfApp.jsx`, chargement des checkpoints) et le conseiller. Les
   statistiques pédagogiques par classe se calculent donc sur du vide, sans
   qu'aucune erreur ne soit visible. **Correction attendue : un script SQL
   ajoutant la contrainte**, à exécuter dans le SQL Editor.
   *Côté enseignant, trois autres requêtes qui échouaient en 400 ont été
   corrigées le 16 août 2026 : `objectifs.matiere_id` (les objectifs pendent à
   une planification, pas à une matière), `preparations.prof_id` (la colonne
   est `user_id`) et `planifications.prof_id` (c'est `created_by`).*
3. **Accès du responsable administratif aux dossiers élèves** : le lien
   « Inscriptions & dossiers élèves » est dans `comptabilite.html`, où il
   n'atterrit plus depuis qu'il est routé vers `DirecteurApp`.

### Chantiers ouverts

4. **Préparation d'une notion sur plusieurs séquences** *(commencé, non
   terminé)*. L'enseignant déclare combien de séquences de 30 min la notion
   demande ; la fiche se déplie en autant de blocs (un intitulé et un
   déroulement par séquence) ; la pastille verte couvre toutes les séquences.
   Décidé : les séquences couvertes sont les suivantes de la même matière
   dans la semaine, et chacune compte pour une séance dans les points.
   **Ce qui manque** : le code prend les numéros de séquence **consécutifs du
   même jour** (`creneau.sequence + i`), pas les créneaux suivants de la même
   matière. Une notion de 2 h ouverte lundi en S4 déborde donc sur S6 et S7,
   qui ne sont pas des heures de cette matière. Corrigé le 16 août 2026 en
   revanche : réenregistrer une fiche échouait en doublon (`existantes`
   n'était jamais relu après un premier dépôt), et raccourcir la durée
   laissait en base des séquences fantômes qui comptaient dans les points.
5. **Taux de participation des élèves** dans le rapport hebdomadaire. Le
   moteur est écrit et testé (`participationDuJour` dans `sequences.js`), la
   grille est en base : il ne manque que l'affichage.
6. **Déplacer le pointage des enseignants** de l'espace surveillant vers
   celui du conseiller, sans perdre l'historique.
7. **Sécuriser Supabase** : vraie authentification et RLS sur toutes les
   tables. Aujourd'hui la clé publique lit et écrit partout, y compris
   `users.code_acces` et les coordonnées des parents. **À faire avant que de
   vraies données d'élèves n'arrivent.**

### Décisions en attente du directeur

- Faut-il créer les comptes des **5 enseignants manquants** — Faty, Michel,
  Terfa, Catherine, Samuel — nommés dans le document mais absents de la base ?
- Le **registre des justificatifs de cantine** est stocké dans une clé
  `app_state` et non dans une table : pas de recherche possible, tout
  l'historique dans une seule ligne JSON qui grossira sans limite. Le
  reprendre en vraie table ?
- Le **bundle est passé à 957 Ko** (238 Ko compressés). Découper le
  chargement pour que chaque compte ne télécharge que son espace ?

---

## 10. Méthode de travail attendue

Le directeur demande de **vérifier avant d'affirmer**, et de le dire quand
quelque chose n'a pas été vérifié. Les contrôles se font sur la base réelle
et dans le navigateur, pas seulement à la lecture du code. Les données de
test sont nettoyées après chaque essai. Les messages de commit expliquent
*pourquoi*, pas seulement *quoi*.
