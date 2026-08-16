# État des lieux — Plateforme École IDEAL

Document de reprise, à jour au **16 août 2026**. Il sert à poursuivre le
travail dans une nouvelle conversation sans repartir de zéro.

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
2. **Deux requêtes du directeur échouent en 400 à chaque chargement** :
   `progressions → objectifs` et `matieres → objectifs` demandent une
   jointure qui n'existe pas en base (`DirecteurApp.jsx`, ~ligne 188).
   L'erreur n'est pas vérifiée : les statistiques pédagogiques par classe se
   calculent sur du vide.
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
