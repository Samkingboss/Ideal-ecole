# INVENTAIRE COMPLET DE L'APPLICATION IDEAL — ÉTAT ACTUEL

*Photographie du dépôt `Samkingboss/Ideal-ecole` au commit `dd20a9e`, et de la base Supabase `jircuneixzwsmtktxrkh`, le 17 août 2026.*

**Ce document décrit le code tel qu'il est, pas tel qu'il devrait être.** Aucun code n'a été modifié, aucune donnée déplacée pendant sa rédaction. Les conventions d'état sont celles demandées : IMPLÉMENTÉ · PARTIELLEMENT IMPLÉMENTÉ · IMPLÉMENTÉ — PROBLÈME IDENTIFIÉ · NON IMPLÉMENTÉ · INTERFACE PRÉSENTE — LOGIQUE ABSENTE · TABLE PRÉSENTE — NON UTILISÉE · À VÉRIFIER.

---

## 1. Chiffres d'ensemble

| | |
|---|---|
| Écrans React | **30** (`src/pages/*.jsx`, 13 808 lignes) |
| Pages statiques | **5** (`pedago-archive`, `comptabilite`, `rapports`, `inscription`, `fiche`) |
| Tables Supabase | **33**, toutes réellement créées |
| Buckets de stockage | **3** (`documents`, `preparations`, `devoirs`) |
| Rôles implémentés | **6** sur 9 prévus par la V2.1 |
| Utilisateurs | 12 comptes, 9 actifs |
| Manuels scolaires transcrits | **17** fichiers versionnés |
| Scripts SQL livrés | 9 |
| Scripts de migration | 2 (`migration-p0-1.py`, `verification-p0-1.py`) |

---

## 2. Architecture technique

### 2.1 Pile

| Élément | Choix | Rôle |
|---|---|---|
| Frontend | **React 19 + Vite 8** | Portail par rôle |
| Langage | **JSX sans TypeScript** | Aucun typage statique |
| Style | **Styles en ligne majoritaires** — 2 178 `style={{` contre 712 `className=` | Voir § 13 |
| Données | **Supabase** (PostgreSQL + PostgREST + Storage) | Base unique |
| Hébergement | **Vercel**, redirection `/* → /index.html` | Déploiement au push |
| PDF / impression | `window.print()`, `html2pdf`, `html2canvas` (CDN) | Documents officiels |

**Dépendances importantes** : `@supabase/supabase-js` (portail), `html2pdf.js` et `html2canvas` chargés depuis un CDN par les pages statiques. Aucun gestionnaire d'état global (Redux, Zustand) : l'état vit dans les composants.

### 2.2 Arborescence

```
src/
  App.jsx              routeur par rôle
  App.css              système visuel (12 variables CSS, ~70 classes)
  lib/
    supabase.js        client
    programmes/        17 manuels + index.js (registre et calcul d'avancement)
    points.js          calcul des points de performance
    notifications.js   poussée de notifications
    audit.js           journalisation des modifications
    sequences.js       grille horaire, permutation des semaines paires
  pages/               30 écrans
public/
  pedago-archive/      plateforme Devoirs & Élèves (app.js 1 391 l.)
  comptabilite.html · rapports.html · inscription.html · fiche.html
  sw.js                service worker
sql/                   9 scripts (DDL manuelle, l'API ne le permet pas)
scripts/               migration et vérification P0-1
docs/                  état des lieux, audit V2.1, ce document
sauvegardes/           exports horodatés (exclu de git)
```

### 2.3 Routage — IMPLÉMENTÉ — PROBLÈME IDENTIFIÉ

`src/App.jsx` choisit une application selon `user.role`. **Il n'y a pas de routeur d'URL** : pas de `react-router`, aucune route adressable, aucun lien profond. Toute la navigation est un état interne (`activeProfSession`, `tab`).

| Rôle | Application | Effectif |
|---|---|---|
| `directeur` | `DirecteurApp` | 1 |
| `responsable_administratif` | `DirecteurApp` — **la même, sans restriction** | 2 |
| `professeur` | `ProfApp` | 5 |
| `surveillant` | `SurveillantApp` | 2 |
| `conseiller_vie_scolaire` | `ConseillerApp` | 1 |
| `cuisiniere` | `CuisiniereApp` | 1 |
| *(inconnu)* | retour à l'écran de connexion | — |

**PROBLÈME IDENTIFIÉ** : le routeur teste `user.fonction` et `user.custom_role`, **deux colonnes absentes de la table `users`**. Ces tests sont inopérants ; le repli sur `user.role` fait le travail. Code mort.

### 2.4 Authentification — IMPLÉMENTÉ — PROBLÈME IDENTIFIÉ

`LoginPage` interroge `users` sur la seule colonne `code_acces`. **Ni mot de passe, ni Supabase Auth, ni jeton signé.** La session est un objet JSON dans `localStorage.ideal_user` : `{id, prenom, nom, role, actif}`. Quiconque sait écrire dans le stockage local de son navigateur peut se déclarer directeur.

### 2.5 Stockage

| Bucket | Usage réel | Contenu |
|---|---|---|
| `documents` | Documents de direction (calendrier, plans) | 1 dépôt + 15 anciennes préparations |
| `preparations` | Dépôts d'enseignants | Créé le 17/08, **vide** |
| `devoirs` | Exercices photographiés | **16 images** migrées + 3 fichiers de test |

### 2.6 Mécanismes de synchronisation et de cache

| Mécanisme | Où | Ce qu'il fait |
|---|---|---|
| `localStorage.ideal_user` | Portail + pages statiques | Session |
| `localStorage.ideal_homeworks` / `ideal_logo` | `pedago-archive` | Copie de travail |
| **Miroir vers `app_state`** | `pedago-archive`, `setInterval` | Pousse devoirs et logo toutes les N secondes, et relit |
| **Relecture périodique** | 4 écrans | `NotificationCenter` 6 s · `DemandeMateriel` 30 s · `DemandesEnseignant` 30 s · `PreparationIA` 60 s |
| Service worker | `public/sw.js` | **Désactivé** : `index.html` désinscrit tout SW et vide les caches à chaque chargement |
| Déclencheur SQL | `sql/stock_et_sanctions.sql` | `trg_maj_stock` recalcule `materiels.quantite` depuis `mouvements_stock` |

---

## 3. Inventaire des écrans

Pas de route adressable : la colonne « accès » décrit le chemin de navigation réel.

| Écran | Accès | Rôles | Fonction | Tables | État |
|---|---|---|---|---|---|
| `LoginPage` | racine | tous | Connexion par code | `users` | IMPLÉMENTÉ |
| `DirecteurApp` (1953 l.) | racine | directeur, resp. adm. | Tableau de bord global, RH, finances, pédagogie | 16 tables + 📦`documents` | IMPLÉMENTÉ — PROBLÈME IDENTIFIÉ |
| `ProfApp` (766 l.) | racine | professeur | 6 sessions : emploi du temps, pédagogie, classe, discipline, perfs, RH | 15 tables + 📦`devoirs` | IMPLÉMENTÉ |
| `CuisiniereApp` (1864 l.) | racine | cuisinière | Menus, marché, stock alimentaire | `app_state`, `eleves` | IMPLÉMENTÉ |
| `ConseillerApp` (553 l.) | racine | conseiller | Présences, discipline, suivi | `presences_eleves`, `eleves`, `disciplines`, `devoirs`, `classes`, `checkpoints` | PARTIELLEMENT IMPLÉMENTÉ |
| `SurveillantApp` (483 l.) | racine | surveillant | Contrôles, incidents, performances | `disciplines`, `eleves`, `performances`, `preparations`, `recrees`, `users` | PARTIELLEMENT IMPLÉMENTÉ |
| `MonEmploiDuTemps` | ProfApp → Emploi du temps | professeur | Grille hebdomadaire, ouverture d'une fiche | `emploi_du_temps`, `affectations_matieres`, `preparations` | IMPLÉMENTÉ |
| `FichePreparation` (785 l.) | clic sur une séance | professeur | Fiche de préparation par séquences | `preparations` | IMPLÉMENTÉ |
| `ProgrammeManuel` | ProfApp → Pédagogie | professeur | Programme du manuel, avancement | `affectations_matieres`, `preparations` | IMPLÉMENTÉ |
| `AffectationsMatieres` | DirecteurApp | directeur | Affecter matières et enseignants | `affectations_matieres`, `emploi_du_temps`, `users` | IMPLÉMENTÉ |
| `SuiviStock` (641 l.) | Surveillant / Cuisinière | surveillant, cuisinière | Demandes, stock, inventaire, mouvements | `materiels`, `mouvements_stock`, `demandes_materiel` | IMPLÉMENTÉ |
| `DemandeMateriel` | ProfApp → RH | professeur | Demander du matériel | `demandes_materiel`, `materiels`, `affectations_matieres` | IMPLÉMENTÉ |
| `DemandesEnseignant` (726 l.) | ProfApp → RH | professeur | Avances, prêts, permissions, justificatifs | `app_state` | IMPLÉMENTÉ |
| `DossierPersonnel` (763 l.) | ProfApp → RH | professeur | Dossier RH et numérique | `app_state` | IMPLÉMENTÉ |
| `MaPrime` | ProfApp → Perfs | professeur | Points et prime | `app_state` + 5 tables | IMPLÉMENTÉ — VOIR § 15 |
| `ActivitePersonnel` | DirecteurApp | directeur | Fiche d'activité d'un agent | 10 tables | IMPLÉMENTÉ |
| `PerformancesDirecteur` | DirecteurApp | directeur | Performances | `checkpoints`, `manquements`, `recrees`, `users` | PARTIELLEMENT IMPLÉMENTÉ |
| `NotificationCenter` (411 l.) | cloche, tous portails | tous | Centre de notifications | `app_state` | IMPLÉMENTÉ |
| `CartesScolaires` (636 l.) | DirecteurApp | directeur | Cartes d'élèves imprimables | `eleves`, `classes`, `inscriptions` | IMPLÉMENTÉ |
| `CertificatScolarite` | DirecteurApp | directeur | Certificats | `eleves`, `inscriptions` | IMPLÉMENTÉ |
| `DocumentPrintStudio` | composant partagé | — | Gabarit d'impression A4 par provenance | — | IMPLÉMENTÉ |
| `DevoirsDocument` | ProfApp → devoirs | professeur | Fiche de devoirs imprimable | — | IMPLÉMENTÉ |
| `SommaireBoscherDocument` | ProfApp → Pédagogie | professeur | Sommaire Boscher en JPEG | — | IMPLÉMENTÉ — PROBLÈME IDENTIFIÉ |
| `FinDeCours` | ProfApp → Pédagogie | professeur | Fiche de fin de cours | `comprehensions` | INTERFACE PRÉSENTE — TABLE VIDE |
| `CheckpointModal` | ProfApp | professeur | Points d'étape | `checkpoints`, `progressions` | PARTIELLEMENT IMPLÉMENTÉ |
| `AgendaCalendrier` | ProfApp → Agenda | professeur | Agenda | — (props) | IMPLÉMENTÉ |
| **`PreparationIA`** | *aucun* | — | Dépôt PDF/photo + note IA | `preparations`, 📦`preparations` | **IMPORTÉ MAIS JAMAIS AFFICHÉ** |
| **`CorrectionDirecteur`** | *aucun* | — | Notation des préparations sur 20 | `preparations`, `users` | **IMPORTÉ NULLE PART** |
| **`BulletinPrimaire`** | *aucun* | — | Bulletin scolaire | — | **IMPORTÉ NULLE PART** |
| **`RecouvrementDocument`** | *aucun* | — | Relance de recouvrement | — | **IMPORTÉ NULLE PART** |

### Pages statiques

| Page | Accès | Fonction | Données | État |
|---|---|---|---|---|
| `/pedago-archive/` | ProfApp → Ma Classe (lien rétabli le 17/08) | Devoirs & Élèves : création, ciblage, impression nominative, message parents | `eleves`, `inscriptions`, `prof_classes`, `app_state` | IMPLÉMENTÉ — voir § 11 |
| `/inscription.html` | direct | Formulaire d'inscription | `inscriptions`, `app_state` | À VÉRIFIER (table vide) |
| `/comptabilite.html` | direct | Comptabilité | `app_state`, REST brut | À VÉRIFIER (non audité en détail) |
| `/rapports.html` | direct | Rapports | `app_state`, REST brut | À VÉRIFIER |
| `/fiche.html` | direct | Fiche | — | À VÉRIFIER |

---

## 4. Inventaire des modules métier

### 4.1 Administration

| Fonction | État | Détail |
|---|---|---|
| Inscriptions | PARTIELLEMENT IMPLÉMENTÉ | Formulaire présent, table `inscriptions` **vide** |
| Élèves | IMPLÉMENTÉ | **12 élèves** dans `eleves` depuis la migration du 17/08 |
| Responsables légaux | TABLE PRÉSENTE — NON UTILISÉE | `responsables` vide ; les coordonnées vivent dans `eleves.parent_nom` / `parent_phone` |
| Documents | PARTIELLEMENT IMPLÉMENTÉ | `documents` : 1 ligne |
| Classes | IMPLÉMENTÉ | 8 classes, Petite Section → CM2 |
| Parcours scolaire annuel | NON IMPLÉMENTÉ | Aucune structure d'historisation par année |

### 4.2 Vie scolaire

| Fonction | État |
|---|---|
| Présences | INTERFACE PRÉSENTE — TABLE VIDE (`presences_eleves` : 0 ligne) |
| Absences / retards élèves | NON IMPLÉMENTÉ |
| Incidents | INTERFACE PRÉSENTE — TABLE VIDE (`disciplines` : 0 ligne) |
| Rapports élèves | PARTIELLEMENT IMPLÉMENTÉ — 5 rapports, dans `app_state` |
| Suivi des élèves | PARTIELLEMENT IMPLÉMENTÉ |

### 4.3 Pédagogie primaire — le module le plus abouti

| Fonction | État | Détail |
|---|---|---|
| Enseignants | IMPLÉMENTÉ | 5 professeurs |
| Matières / affectations | IMPLÉMENTÉ — PROBLÈME IDENTIFIÉ | 41 affectations, mais **`prof_id` renseigné uniquement au CP1/CP2** |
| Manuels | IMPLÉMENTÉ | **17 manuels transcrits**, 1 500+ entrées |
| Programmes | IMPLÉMENTÉ | Fichiers versionnés, avancement calculé depuis les préparations |
| Emploi du temps | IMPLÉMENTÉ | 240 créneaux, permutation des semaines paires |
| Préparations | IMPLÉMENTÉ | Voir § 12 |
| Devoirs | IMPLÉMENTÉ | Voir § 11 |
| Évaluations / notes | PARTIELLEMENT IMPLÉMENTÉ | `comprehensions` vide, `checkpoints` 20 lignes |
| Bulletins | INTERFACE PRÉSENTE — NON BRANCHÉE |

**Les 17 manuels** : Maths CP1/CP2/CE1, Mathematics CP1/CE1/CM, Lecture CP1/CP2, Français CP2, Français CE1-CE2 (Flamboyant CE2), English CP1/CP2/CE1/CM, Phonics CP1/CP2, Spelling CM, Grammar CM/CP1, Science CP1/CP2/CE1.

### 4.4 Maternelle — NON IMPLÉMENTÉ

Aucun code. Les classes Petite Section et Grande Section existent dans `classes` et 9 élèves y sont inscrits, mais **rien** n'existe pour : l'alternance PS/GS sur deux semaines, les cinq jours de français et d'anglais, la maîtresse principale, l'assistante, les objectifs de classe, la préparation et le contrôle du matériel.

### 4.5 Cantine

| Fonction | État |
|---|---|
| Menus | IMPLÉMENTÉ — dans `app_state.cantine.cantine_menu_semaine` |
| Marché du jour | IMPLÉMENTÉ — dans `app_state` |
| Stock alimentaire | IMPLÉMENTÉ — `materiels` magasin `cuisine`, 14 denrées |
| Effectifs repas | NON IMPLÉMENTÉ |
| Allergies / restrictions | NON IMPLÉMENTÉ — aucun champ, aucun contrôle |
| Alerte menu incompatible | NON IMPLÉMENTÉ |

### 4.6 RH

| Fonction | État |
|---|---|
| Dossier personnel | IMPLÉMENTÉ — dans `app_state.rh.personnel` |
| Contrats / diplômes | PARTIELLEMENT IMPLÉMENTÉ |
| Absences enseignants | TABLE PRÉSENTE — NON UTILISÉE |
| Retards | IMPLÉMENTÉ — via `performances.heure_arrivee` |
| Avertissements / sanctions | TABLE PRÉSENTE — NON UTILISÉE (`sanctions_personnel` vide) |
| Lettres d'explication | À VÉRIFIER |
| Performance | IMPLÉMENTÉ — 11 lignes, barème **non validé** |
| Avances / prêts | IMPLÉMENTÉ — 5 demandes, bornes 20 000–150 000 F |

### 4.7 Finance — À VÉRIFIER

`comptabilite.html` existe et attaque Supabase en REST brut. `financement_params` contient 1 ligne (effectifs, charges, salaires, plan comptable, taux). **Module non audité en profondeur** : il sort du périmètre des sondages effectués.

### 4.8 Stocks — le module le plus sain

| Fonction | État |
|---|---|
| Deux magasins | IMPLÉMENTÉ — `pedagogique` et `cuisine` |
| Demandes → validation → livraison | IMPLÉMENTÉ |
| Mouvements | IMPLÉMENTÉ — 5 mouvements ; **le stock ne s'écrit jamais à la main**, un déclencheur le recalcule |
| Inventaire | IMPLÉMENTÉ |
| Retrait / réactivation d'article | IMPLÉMENTÉ — suppression douce |
| Inventaire individuel par agent | PARTIELLEMENT IMPLÉMENTÉ |

### 4.9 Communication

| Fonction | État |
|---|---|
| Notifications internes | IMPLÉMENTÉ — dans `app_state`, 6 files |
| Messages parents WhatsApp | PARTIELLEMENT IMPLÉMENTÉ — liens `wa.me` générés dans 8 fichiers, **aucune trace conservée** |
| Communications officielles | NON IMPLÉMENTÉ |

---

## 5. Base de données — 33 tables

| Table | Colonnes | Lignes | Rôle métier | Écrit par | État |
|---|---|---|---|---|---|
| `users` | 13 | 12 | Comptes et rôles | Administration | IMPLÉMENTÉ |
| `classes` | 4 | 8 | Classes | Direction | IMPLÉMENTÉ |
| `eleves` | 13 | **12** | Dossier élève | Administration | IMPLÉMENTÉ (depuis 17/08) |
| `devoirs` | 14 | **13** | Devoirs | Enseignant | IMPLÉMENTÉ (depuis 17/08) |
| `emploi_du_temps` | 6 | 240 | Grille horaire | Direction | IMPLÉMENTÉ |
| `affectations_matieres` | 5 | 41 | Matière ↔ enseignant | Direction | IMPLÉMENTÉ — `prof_id` souvent nul |
| `prof_classes` | 4 | 10 | Périmètre d'un enseignant | Direction | IMPLÉMENTÉ |
| `preparations` | 19 | 17 | Préparations | Enseignant | IMPLÉMENTÉ — deux modèles cohabitent |
| `materiels` | 8 | 16 | Articles en stock | Surveillant/Cuisinière | IMPLÉMENTÉ |
| `mouvements_stock` | 8 | 5 | Entrées/sorties | Surveillant/Cuisinière | IMPLÉMENTÉ |
| `demandes_materiel` | 13 | 1 | Demandes | Enseignant | IMPLÉMENTÉ |
| `performances` | 12 | 11 | Pointage quotidien | Surveillant | IMPLÉMENTÉ |
| `recrees` | 8 | 21 | Contrôles de récréation | Surveillant | IMPLÉMENTÉ |
| `checkpoints` | 7 | 20 | Points d'étape | Enseignant | IMPLÉMENTÉ |
| `periodes` | 6 | 15 | Périodes scolaires | Direction | IMPLÉMENTÉ |
| `journal_audit` | 10 | 60 | Traçabilité | `lib/audit.js` | **PROBLÈME : écrit par un seul écran, débranché** |
| `app_state` | 4 | 21 | Magasin clé-valeur | 45 emplacements | **PROBLÈME : voir § 6** |
| `matieres` | 5 | 4 | Matières | Direction | PARTIELLEMENT UTILISÉE |
| `objectifs` | 5 | 1 | Objectifs de planification | Enseignant | PARTIELLEMENT UTILISÉE |
| `planifications` | 7 | 1 | Planifications | Enseignant | PARTIELLEMENT UTILISÉE |
| `documents` | 5 | 1 | Documents | Direction | PARTIELLEMENT UTILISÉE |
| `evenements` | 5 | 2 | Agenda | Direction | PARTIELLEMENT UTILISÉE |
| `parametres_mois` | 2 | 1 | Jours ouvrés | Direction | PARTIELLEMENT UTILISÉE |
| `financement_params` | 13 | 1 | Paramètres financiers | Administration | À VÉRIFIER |
| `inscriptions` | 9 | **0** | Inscriptions | Administration | TABLE PRÉSENTE — NON UTILISÉE |
| `presences_eleves` | 5 | **0** | Registre de présence | Conseiller | TABLE PRÉSENTE — NON UTILISÉE |
| `disciplines` | 7 | **0** | Incidents | Enseignant | TABLE PRÉSENTE — NON UTILISÉE |
| `responsables` | 5 | **0** | Responsables légaux | Administration | TABLE PRÉSENTE — NON UTILISÉE |
| `comprehensions` | 9 | **0** | Compréhension des élèves | Enseignant | TABLE PRÉSENTE — NON UTILISÉE |
| `absences_enseignants` | 4 | **0** | Absences du personnel | Direction | TABLE PRÉSENTE — NON UTILISÉE |
| `sanctions_personnel` | 4 | **0** | Sanctions | Direction | TABLE PRÉSENTE — NON UTILISÉE |
| `manquements` | 5 | **0** | Manquements | Surveillant | TABLE PRÉSENTE — NON UTILISÉE |
| `progressions` | 2 | **0** | Progressions | Enseignant | TABLE PRÉSENTE — NON UTILISÉE |

**Neuf tables créées et jamais utilisées.**

### Doublons de tables identifiés

| Doublon | Détail |
|---|---|
| `affectations_matieres` ↔ `prof_classes` ↔ `matieres` | Trois tables pour dire qui enseigne quoi et où |
| `checkpoints` ↔ `comprehensions` ↔ `progressions` | Trois tables voisines pour le suivi des acquis |
| `eleves.parent_nom/parent_phone` ↔ `responsables` | Coordonnées parentales à deux endroits |
| `preparations` | Une seule table pour **deux modèles** de préparation (§ 12) |

**Aucune table ne porte de colonne d'établissement** (`ecole_id`, `tenant_id`…) : la duplicabilité multi-écoles est architecturalement absente.

### Rapprochement par chaîne de caractères — RISQUE

Le groupe (« CP1 », « CE1-CE2 ») circule en **texte libre** entre `emploi_du_temps.groupe`, `affectations_matieres.groupe`, `devoirs.groupe` et les fichiers de manuels. Aucune clé étrangère. `src/lib/programmes/index.js` normalise déjà accents et casse — preuve que le problème s'est déjà posé.

---

## 6. Cartographie exhaustive d'`app_state`

21 lignes, **3 205 Ko**, dont une seule pèse 3 190 Ko.

| Domaine | Clé | Contenu | Lu par | Écrit par | Source cible | État |
|---|---|---|---|---|---|---|
| `pedago` | `ideal_homeworks` | 13 devoirs + images base64 — **3 190 Ko** | `pedago-archive/app.js`, `rapports.html` | `pedago-archive/app.js` | `devoirs` + bucket | **MIGRÉ le 17/08 — copie conservée** |
| `pedago` | `ideal_students` | 12 élèves | `pedago-archive/app.js` | `pedago-archive/app.js` | `eleves` | **MIGRÉ le 17/08 — copie conservée** |
| `rh` | `demandes_rh_global` | 5 demandes d'avance/prêt | `DirecteurApp`, `NotificationCenter`, `DemandesEnseignant` | `DemandesEnseignant`, `DirecteurApp` | Table `demandes_rh` à créer | À MIGRER |
| `rh` | `postes` | 18 postes et barèmes | `DirecteurApp`, `comptabilite.html` | `DirecteurApp` | Table `postes` à créer | À MIGRER |
| `rh` | `points_config` | Barème de performance, 10 critères | `lib/points.js`, `ActivitePersonnel`, `DirecteurApp`, `MaPrime` | `DirecteurApp` | Table `parametres` | **NON VALIDÉ — voir § 15** |
| `rh` | `personnel` | Dossiers du personnel | 9 fichiers | `DossierPersonnel`, `DirecteurApp` | Table `dossiers_rh` à créer | À MIGRER |
| `cantine` | `cantine_menu_semaine` | Menu de 8 jours | `CuisiniereApp` | `CuisiniereApp` | Table `menus` à créer | À MIGRER |
| `cantine` | `cantine_fiche_marche` | Marché du jour | `CuisiniereApp`, `DirecteurApp` | `CuisiniereApp` | Table `marches` à créer | À MIGRER |
| `notifications` | `notifs_directeur` | 5 notifications | `NotificationCenter` | `lib/notifications.js` | Table `notifications` | À MIGRER |
| `notifications` | `notifs_responsable_administratif` | 5 | idem | idem | idem | À MIGRER |
| `notifications` | `notifs_surveillant` | 1 | idem | idem | idem | À MIGRER |
| `notifications` | `notifs_<uuid>` × 3 | 1 à 3 par personne | idem | idem | idem | À MIGRER |
| `rapports_eleves` | `el:<uuid>` × 4, `ins:<matricule>` | 5 rapports | `rapports.html` | `rapports.html` | Table `rapports_eleves` | **RATTACHÉS le 17/08 — anciennes clés conservées** |
| `rapports` | `lang` | Réglage de langue | `rapports.html` | `rapports.html` | Peut rester | ACCEPTABLE |
| `audit_test` | `audit_test` | Résidu de test du 09/08 | — | — | — | À SUPPRIMER (après validation) |

**Note importante** : depuis la migration du 17 août, `pedago.ideal_students` et `pedago.ideal_homeworks` sont des **copies de sécurité** — la page `/pedago-archive/` continue pour l'instant de les lire. La bascule de lecture n'a pas été faite.

---

## 7. Données de test présentes

Toutes les données sont des données de laboratoire.

| Donnée | Volume | Observation |
|---|---|---|
| Élèves | **12** | 8 Petite Section, 3 CP1, 1 CP2 · trois identités « brielle » conservées distinctes sur décision du promoteur |
| Devoirs | **13** | CP1 ×10, PS ×1, GS ×1 ; 16 images |
| Images de devoirs | **16** | Migrées en fichiers, 3,11 Mo à l'origine |
| Rapports élèves | **5** | Rattachés aux nouveaux identifiants |
| Préparations | **17** | 15 dépôts fichier (mars-avril 2026, Ornella MOGADZI) + 2 fiches saisies (10/08) |
| Utilisateurs | **12** | 9 actifs, 6 rôles |
| Classes | **8** | Petite Section → CM2 |
| Emploi du temps | **240** créneaux | 4 groupes × 60 séquences |
| Affectations matières | **41** | `prof_id` renseigné au CP1/CP2 seulement |
| Matériel | **16** articles | 2 magasins |
| Mouvements de stock | **5** | |
| Demandes matériel | **1** | |
| Demandes RH | **5** | Dans `app_state` |
| Performances | **11** | |
| Récréations | **21** | |
| Checkpoints | **20** | |
| Notifications | **16** | Réparties en 6 files |
| Menus | **1 semaine** | Dans `app_state` |
| Paiements | **0** | À VÉRIFIER — module comptable non sondé |
| Présences, incidents, inscriptions, responsables | **0** | Tables vides |

---

## 8. Rôles et permissions

### 8.1 Matrice réelle

| Rôle | Écrans | Tables atteignables | Restriction frontend | Restriction serveur |
|---|---|---|---|---|
| `directeur` | `DirecteurApp` + 6 sous-écrans | **toutes** | aucune | **aucune** |
| `responsable_administratif` | **`DirecteurApp` — identique au directeur** | **toutes** | **aucune** | **aucune** |
| `professeur` | `ProfApp` + 10 sous-écrans | 15 tables | `.eq('user_id', …)`, `prof_classes` | **aucune** |
| `surveillant` | `SurveillantApp`, `SuiviStock` | 6 tables | par écran | **aucune** |
| `conseiller_vie_scolaire` | `ConseillerApp` | 6 tables | par écran | **aucune** |
| `cuisiniere` | `CuisiniereApp`, `SuiviStock` | 3 tables | magasin `cuisine` | **aucune** |
| `parent` | **aucun** | — | — | — |
| `assistante maternelle` | **aucun** | — | — | — |
| `promoteur / direction générale` | **aucun** | — | — | — |

### 8.2 Distinction demandée

**Permissions réellement sécurisées côté serveur : AUCUNE.**

Les politiques constatées sur les tables récentes sont `using (true)` en lecture, insertion et mise à jour ; seule la suppression est fermée. La clé anonyme est publique — présente en clair dans le bundle JavaScript **et dans quatre pages statiques**.

**Tout le reste est une restriction d'affichage frontend**, contournable en modifiant `localStorage.ideal_user`.

### 8.3 Failles identifiées

1. **Usurpation de rôle triviale** — écrire `{"role":"directeur"}` dans le stockage local suffit.
2. **Clé anonyme toute-puissante** — lecture et écriture sur les 33 tables depuis n'importe quel client.
3. **`responsable_administratif` = `directeur`** — aucun cloisonnement entre ces deux rôles.
4. **Aucune isolation multi-écoles.**
5. **Suppression fermée** sur les tables sensibles — *point positif*, conforme au §19 de la V2.1.

---

## 9. Workflows réellement fonctionnels

**10 workflows identifiés.** Notation : ✓ complet · ⚠ interrompu · ✗ inexistant

| # | Workflow | Déclencheur → acteur → table → suite | État |
|---|---|---|---|
| 1 | **Demande de matériel** | Enseignant → `demandes_materiel` → notification surveillant → validation → `mouvements_stock` → déclencheur SQL → `materiels.quantite` → inventaire | **✓ complet** |
| 2 | **Demande RH** | Employé → `app_state.rh` → notification direction → décision → notification retour → dossier | **✓ complet** (réparé le 16/08) |
| 3 | **Préparation de cours** | Emploi du temps → clic séance → `FichePreparation` → `preparations.contenu` → avancement du manuel → points | **⚠** la notation par la direction est débranchée |
| 4 | **Devoir** | Enseignant → `/pedago-archive/` → `app_state` → impression nominative | **⚠** ni information parentale, ni suivi de remise |
| 5 | **Stock cuisine** | Cuisinière → marché → `materiels` magasin cuisine → alertes de seuil | **✓ complet** |
| 6 | **Menu de la semaine** | Cuisinière → `app_state.cantine` → impression | **⚠** aucun contrôle d'allergie, aucun effectif |
| 7 | **Pointage du personnel** | Surveillant → `performances` → points → `MaPrime` | **⚠** barème non validé |
| 8 | **Notification** | Événement → `lib/notifications.js` → `app_state.notifications` → cloche (relecture 6 s) | **✓ fonctionne**, hors tables métier |
| 9 | **Présence élève** | Conseiller → `presences_eleves` → rapports → cantine | **✗ jamais exécuté** |
| 10 | **Incident** | Enseignant → `disciplines` → surveillant → direction → parent | **✗ jamais exécuté** |

### Étapes manquantes les plus visibles

* Aucun workflow ne produit d'écriture dans `journal_audit` — **la traçabilité du §18 n'est pas alimentée**.
* Aucun workflow n'atteint le parent.

---

## 10. Flux entre modules

| Connexion | État | Détail |
|---|---|---|
| Élève → Classe | **EXISTANTE** | `eleves.classe_id` |
| Élève → Enseignant | **EXISTANTE** | via `prof_classes`, filtrage vérifié |
| Élève → Présence | **ABSENTE** | table vide |
| Élève → Cantine | **ABSENTE** | |
| Présence → Cantine | **ABSENTE** | |
| Élève → Allergies | **ABSENTE** | aucun champ |
| Allergies → Menu | **ABSENTE** | |
| Enseignant → Devoir | **EXISTANTE** | |
| Devoir → Élève | **PARTIELLE** | ciblage par nom, pas par identifiant |
| Devoir → Parent | **ABSENTE** | |
| Incident → Direction | **ABSENTE** | |
| Personnel → Performance | **EXISTANTE** | |
| Performance → Prime | **PARTIELLE** | barème non validé |
| Matériel → Inventaire personnel | **PARTIELLE** | |
| Demande → Stock | **EXISTANTE** | |
| Préparation → Avancement manuel | **EXISTANTE** | |
| Préparation → Notation direction | **ABSENTE** | écran débranché |
| Inscription → Élève | **ABSENTE** | `inscriptions` vide |
| Tout module → Traçabilité | **ABSENTE** | |

**7 connexions existantes, 4 partielles, 8 absentes.**

---

## 11. Les deux systèmes de devoirs — analyse, sans arbitrage

### Système A — `/pedago-archive/`

| | |
|---|---|
| Écran | Page statique autonome, `public/pedago-archive/` |
| Accès | ProfApp → Ma Classe → bouton vert (lien rétabli le 17/08 ; il avait disparu lors de la refonte en six sessions) |
| Code | `app.js` 1 391 lignes, 59 fonctions · `index.html` 384 l. · `styles.css` 768 l. |
| Données élèves | `eleves` + `inscriptions`, **filtrés par `prof_classes`** |
| Données devoirs | `localStorage` + miroir `app_state` toutes les N secondes |
| Ciblage | Toute la classe **ou** élèves cochés individuellement |
| Génération | Page de garde, objectifs, barème, période, type, date de rendu |
| Impression | **`printAll()`** une feuille par élève avec son nom · **`printSingle()`** exemplaire modèle sans nom · refus explicite d'imprimer sans nom si des élèves existent mais ne sont pas cochés |
| Communication parentale | **Carte illustrée portrait**, un message par enfant lorsque le devoir ne vise que quelques élèves |
| Images | Base64, plusieurs par devoir |
| Historique | `renderArchive()` — 13 devoirs |

### Système B — onglet « Cahier de Devoirs du Soir »

| | |
|---|---|
| Écran | Bloc de 144 lignes dans `ProfApp.jsx` |
| Accès | ProfApp → Ma Classe → onglet |
| Données élèves | Aucune |
| Données devoirs | Table `devoirs` + bucket `devoirs` |
| Ciblage | Aucun — le devoir vise la classe entière |
| Génération | Matière (liste des matières de l'enseignant), objectif, date de remise, pièces jointes |
| Impression | `DevoirsDocument` → fiche de classe, une seule page de garde |
| Communication parentale | Aucune |
| Images | Plusieurs, déposées dans le bucket |
| Historique | Filtré sur la classe ouverte — **0 devoir** |

### Ce qui les distingue objectivement

| Critère | A | B |
|---|---|---|
| Impression nominative | oui | non |
| Ciblage par élève | oui | non |
| Message parents | oui | non |
| Stockage en table | non | oui |
| Filtrage par classe de l'enseignant | oui | oui |
| Données réelles | 13 | 0 |
| Lignes de code | 1 391 | 144 |

**DÉCISION DU PROMOTEUR REQUISE.**

---

## 12. Les deux systèmes de préparation — analyse, sans arbitrage

### Système A — dépôt de fichier (`PreparationIA`)

| | |
|---|---|
| Écran | `src/pages/PreparationIA.jsx`, 213 lignes |
| Branché | **NON** — importé dans `ProfApp` mais jamais affiché |
| Données | `preparations` : `url_doc`, `status`, `retard_minutes`, `note_ia`, `commentaire_ia` |
| Workflow | Dépôt PDF/JPEG → bucket → note sur 20 selon 5 critères → statut |
| Lien emploi du temps | Aucun — l'enseignant saisit classe, matière, date et heure |
| Lien manuel | Aucun |
| Notation | `note_ia` renseignée sur **15 dépôts** · `note_directeur` : **0** |
| Retard | **Oui** — dépôt attendu 10 h avant le cours, retard calculé en minutes |
| Historique | 15 dépôts, mars-avril 2026, une seule enseignante |
| Correction | `CorrectionDirecteur.jsx` (201 l.) — **importé nulle part** |

### Système B — fiche saisie (`FichePreparation`)

| | |
|---|---|
| Écran | `src/pages/FichePreparation.jsx`, 785 lignes |
| Branché | **OUI** — emploi du temps → clic sur une séance |
| Données | `preparations.contenu` (JSONB) : rubriques, séquences, référence manuel |
| Workflow | Choix du manuel → choix de la leçon → objectif, prérequis, matériel, différenciation, évaluation, trace → 1 à 6 séquences minutées |
| Lien emploi du temps | **Direct** — la fiche naît d'une séance |
| Lien manuel | **Direct** — leçon, tome, page, domaines à couvrir ; alimente l'avancement |
| Notation | Aucune |
| Retard | Aucun |
| Historique | 2 fiches, 10 août 2026 |
| Impression | Fiche A4 en fenêtre dédiée + export texte |

### Ce qui les distingue objectivement

| Critère | A | B |
|---|---|---|
| Atteignable aujourd'hui | non | oui |
| Contrôle de retard | oui | non |
| Notation | prévue, jamais utilisée | absente |
| Lien manuel et avancement | non | oui |
| Contenu structuré | non (fichier) | oui (12 rubriques) |
| Données réelles | 15 | 2 |

**Les deux écrivent dans la même table `preparations`.**

**DÉCISION DU PROMOTEUR REQUISE.**

---

## 13. Design et UX actuels

### 13.1 Système visuel existant

**Palette** — 12 variables CSS dans `App.css` :

| Variable | Valeur | Usage |
|---|---|---|
| `--accent` | `#1AAFE0` | Bleu IDEAL, action principale |
| `--green` | `#8DC63F` | Succès |
| `--amber` | `#F7941D` | Attention |
| `--pink` | `#EC008C` | Accent secondaire |
| `--red` | `#c53030` | Danger |
| `--dark` | `#0d2a3b` | Bandeau, texte |
| `--bg` / `--card` / `--border` / `--muted` / `--text` | | Fonds et texte |
| `--radius` | `16px` | Rayon unique |

Ces couleurs correspondent au logo de l'école — l'identité visuelle est **réelle et cohérente** dans son intention.

**Typographie** : DM Sans (Google Fonts), une seule famille.

**Composants** : environ 70 classes partagées — `.btn`, `.card`, `.kpi-card`, `.badge`, `.chip`, `.modal`, `.table`, `.form-input`, `.empty-state`, `.progress-wrap`, `.tabs`…

**Navigation** : deux niveaux — sessions (6 pour l'enseignant) puis sous-onglets. Barre inférieure sur mobile. Pas d'URL adressable.

**Responsive** : 6 `@media` dans `App.css`. Les tableaux passent en cartes à l'impression (`.ecran-seul` / `.impression-seule`).

**États vides** : `empty-state` présent dans **10 écrans sur 30**.

**Feedback** : messages d'erreur en clair sur les écrans récents (devoirs, fiche de préparation, stock) ; **absents ailleurs**.

**Loaders** : `« Chargement… »` textuel, pas de squelette.

### 13.2 Écarts avec le Design System V1.0

| Principe V1.0 | Écart constaté | Gravité |
|---|---|---|
| **§13 Cohérence du design system** | **2 178 `style={{` contre 712 `className=`** : les trois quarts du style sont écrits en ligne, écran par écran. Une amélioration d'un composant ne profite à personne d'autre | **Élevée** |
| §7 Feedback immédiat | Présent sur les écrans récents seulement | Élevée |
| §14 États vides | 10 écrans sur 30 | Moyenne |
| §15 Performance perçue | Aucun squelette de chargement ; `« Chargement… »` | Moyenne |
| §5 Tableaux de bord | Le tableau de bord direction affiche **« Préparation sans titre · Classe : — »** — il lit `prep.titre` et `prep.classe_nom`, **deux colonnes inexistantes** | **Élevée** |
| §2-1 Simplicité avant densité | `DirecteurApp` : 1 953 lignes, 16 tables, un seul écran | Élevée |
| §4 Navigation | Un onglet « 📖 Sommaire Boscher (Pages 4-72) » s'affiche pour **tous** les enseignants, y compris ceux qui n'enseignent ni la lecture ni le CP1 | Moyenne |
| §16 Rédaction UX | Vocabulaire globalement bon ; quelques libellés techniques (« Code Bleu Océan ») | Faible |
| §11 Sécurité UX | « Les permissions doivent être appliquées côté serveur » — **elles ne le sont pas** | **Critique** |
| §10 Expérience par rôle | Le responsable administratif reçoit l'écran du directeur | Élevée |
| §3 Identité visuelle | Palette cohérente et fidèle au logo — **point fort à préserver** | — |

---

## 14. Fonctionnalités construites mais non documentées

Trouvées en explorant le code, invisibles depuis la navigation.

| Fonctionnalité | Où | Description |
|---|---|---|
| **Studio d'impression par provenance** | `DocumentPrintStudio` | Gabarit A4 avec code couleur par service : Devoirs bleu océan, Recouvrement violet, Restauration or, Direction bleu nuit, Bulletins vert |
| **Permutation des semaines paires** | `lib/sequences.js` | En semaine paire, les blocs du matin et de l'après-midi sont permutés — appliqué à l'emploi du temps et aux préparations |
| **Calcul d'avancement des manuels** | `lib/programmes/index.js` | Déduit la leçon suivante des préparations déposées, sans aucune saisie |
| **Déclencheur de stock** | `sql/stock_et_sanctions.sql` | `trg_maj_stock` recalcule la quantité : le stock ne s'écrit jamais à la main |
| **Journalisation champ par champ** | `lib/audit.js` | Enregistre ancienne et nouvelle valeur — **prêt, mais utilisé par un seul écran débranché** |
| **Cartes scolaires imprimables** | `CartesScolaires` (636 l.) | Génération de cartes d'élèves |
| **Certificats de scolarité** | `CertificatScolarite` (348 l.) | |
| **Sommaire Boscher en JPEG HD** | `SommaireBoscherDocument` | Document téléchargeable |
| **Message illustré aux parents** | `pedago-archive` | Carte portrait pour WhatsApp, un message par enfant |
| **Contrôle de récréation** | `recrees` + `SurveillantApp` | Outils, tables, ventilateur, fermeture — 21 contrôles enregistrés |
| **Retrait / réactivation d'article** | `SuiviStock` | Suppression douce avec réactivation |
| **Alerte de seuil de stock** | `SuiviStock` | `seuil_alerte > 0 && quantite <= seuil_alerte` |
| **Relectures périodiques** | 4 écrans | Notifications 6 s, demandes 30 s, préparations 60 s |
| **Bornes des demandes RH** | `DemandesEnseignant` | Prêts 20 000–150 000 F, remboursement avant mai ; avances entre 20 000 F et la moitié du salaire |
| **Désinscription du service worker** | `index.html` | Désinscrit tout SW et vide les caches à chaque chargement |

---

## 15. Dette technique

| # | Dette | Détail |
|---|---|---|
| 1 | **`app_state` comme base parallèle** | 21 lignes, 3,2 Mo, 45 points d'accès, 6 domaines métier |
| 2 | **Une ligne JSON de 3,19 Mo** | `ideal_homeworks` : chaque lecture transfère 3 Mo |
| 3 | **Aucune permission serveur** | Voir § 8 |
| 4 | **4 écrans orphelins** | `PreparationIA`, `CorrectionDirecteur`, `BulletinPrimaire`, `RecouvrementDocument` |
| 5 | **9 tables jamais utilisées** | |
| 6 | **Deux systèmes de devoirs, deux de préparation** | §§ 11 et 12 |
| 7 | **Colonnes fantômes** | `user.fonction`, `user.custom_role` (routeur) ; `prep.titre`, `prep.classe_nom` (tableau de bord) |
| 8 | **Style en ligne massif** | 2 178 occurrences |
| 9 | **Rapprochement par chaîne** | Groupes en texte libre, sans clé étrangère |
| 10 | **Deux chemins d'accès aux données** | `supabase-js` (portail) et REST brut (4 pages statiques, clé en clair) |
| 11 | **Barème de performance non validé** | `rh.points_config` alimente déjà l'écran « Ma Prime » |
| 12 | **`journal_audit` inerte** | Outil prêt, jamais appelé |
| 13 | **Aucun test automatisé** | Hors les deux scripts de vérification P0-1 |
| 14 | **Aucune isolation multi-écoles** | |
| 15 | **DDL manuelle** | Toute évolution de schéma passe par le SQL Editor |

---

## 16. Matrice — fonctionnalités V2.1 face à l'existant

✅ Implémenté · 🟡 Partiel · 🔴 Non conforme · ⚪ Non implémenté · 🔵 Décision requise

| § V2.1 | Fonctionnalité | Existe ? | Emplacement | Écart |
|---|---|---|---|---|
| 4 | Dossier élève permanent | ✅ | `eleves` | Allergies et responsables manquants |
| 4 | Parcours scolaire annuel | ⚪ | — | Aucune historisation |
| 4 | Dossier professionnel | 🟡 | `app_state.rh` | Hors table |
| 5 | Formulaire d'inscription | 🟡 | `inscription.html` | Table vide |
| 5 | Propagation après validation | ⚪ | — | |
| 5 | Confirmation WhatsApp | ⚪ | — | 🔵 canal |
| 6 | Comptabilité | 🟡 | `comptabilite.html` | À VÉRIFIER |
| 6 | Trésorerie 10/12 mois | 🟡 | `financement_params` | 🔵 formules |
| 6 | Demandes avance/prêt | ✅ | `DemandesEnseignant` | |
| 7 | Registre de présence | 🔴 | `presences_eleves` | Table vide |
| 7 | Présences → rapports/cantine | ⚪ | — | |
| 8 | WhatsApp officiel | 🟡 | 8 fichiers | Aucune traçabilité |
| 8 | Groupe par enfant | ⚪ | — | |
| 9 | Signalement d'incident | 🔴 | `disciplines` | Table vide |
| 9 | Escalade surveillant → direction | ⚪ | — | |
| 9 | Grille de gravité | 🔵 | — | Non décidée |
| 10 | Affectations, manuels, emploi du temps | ✅ | 3 écrans | |
| 10 | Préparations | ✅ | `FichePreparation` | |
| 10 | Contrôle qualité direction | 🔴 | `CorrectionDirecteur` | Débranché |
| 11 | Modèle maternelle | ⚪ | — | Entièrement absent |
| 12 | Devoir : création, page de garde | ✅ | `pedago-archive` | |
| 12 | Impression nominative | ✅ | `printAll()` | |
| 12 | Information parentale | ⚪ | — | |
| 12 | Suivi des remises | ⚪ | — | |
| 13 | Évaluation des élèves | 🟡 | `checkpoints` | `comprehensions` vide |
| 13 | Bulletins | 🔴 | `BulletinPrimaire` | Débranché |
| 14 | Allergies à l'inscription | ⚪ | — | |
| 14 | Effectif du jour | ⚪ | — | |
| 14 | Alerte menu incompatible | ⚪ | — | |
| 14 | Stocks alimentaires | ✅ | `materiels` magasin cuisine | |
| 15 | Commande → inventaire | ✅ | `SuiviStock` | |
| 15 | Inventaire individuel | 🟡 | | |
| 16 | Points positifs / négatifs | 🟡 | `performances` | 🔵 barème |
| 16 | Vue employé | ✅ | `MaPrime` | |
| 17 | Tableau de bord direction | 🟡 | `DirecteurApp` | Carte préparations cassée |
| 18 | Catalogue de notifications | 🟡 | `app_state` | Pas de règles |
| 18 | Traçabilité | 🔴 | `journal_audit` | Non alimenté |
| 19 | Permissions par action | 🔴 | — | Aucune côté serveur |
| 20 | Multi-écoles | 🔴 | — | Aucun `ecole_id` |
| 21 | Préservation de l'existant | 🟡 | | 4 écrans orphelins |

**Décompte : 12 ✅ · 12 🟡 · 7 🔴 · 12 ⚪ · 4 🔵**

---

## 17. Récapitulatif final

### Ce qui est déjà solide

1. **Le stock** — deux magasins, mouvements, déclencheur SQL, suppression douce. Le modèle le plus propre de l'application.
2. **Les manuels et programmes** — 17 manuels, avancement déduit des préparations, aucune double saisie.
3. **L'emploi du temps** — 240 créneaux, permutation des semaines paires.
4. **La fiche de préparation** — 12 rubriques, séquences minutées, lien direct au manuel.
5. **La plateforme Devoirs** — impression nominative, ciblage, message aux parents.
6. **Les demandes RH** — circuit complet avec notifications.
7. **L'identité visuelle** — palette cohérente, fidèle au logo.

### Ce qui est fonctionnel au quotidien

Connexion, emploi du temps, préparations, programmes, demandes de matériel et RH, stock, menus, notifications, documents imprimables.

### Ce qui est partiellement construit

Inscriptions, évaluations, communication parentale, performance, tableau de bord direction, inventaire individuel, comptabilité.

### Ce qui manque

Maternelle, présences, allergies et contrôle des menus, effectifs cantine, suivi des remises de devoirs, portail parent, parcours annuel, traçabilité, permissions serveur, multi-écoles.

### Ce qui doit être refondu

`app_state` comme base parallèle · les deux doublons devoirs et préparations · le partage du portail entre directeur et responsable administratif · le style en ligne massif.

### Ce qui ne doit surtout pas être cassé

1. Le déclencheur de stock et son modèle de mouvements
2. Les 17 manuels et le calcul d'avancement
3. Le filtrage `prof_classes` de la plateforme Devoirs
4. L'impression nominative et le message aux parents
5. La fiche de préparation et son lien au manuel
6. L'emploi du temps et la permutation des semaines paires
7. Le circuit des demandes RH et matériel
8. Les données de test — 12 élèves, 13 devoirs, 17 préparations
9. `app_state` tant que la validation n'est pas prononcée
10. La palette et l'identité visuelle

### Risques techniques majeurs

Voir § 15 — les cinq premiers : `app_state`, la ligne de 3,19 Mo, l'absence de permissions serveur, l'absence de restauration ponctuelle chez Supabase, les colonnes lues mais inexistantes.

### Risques UX majeurs

Style en ligne empêchant toute amélioration transverse · tableau de bord affichant des champs vides · absence de feedback sur les écrans anciens · densité de `DirecteurApp` · onglet Boscher affiché hors contexte.

### Décisions métier encore nécessaires

Les douze de l'audit V2.1, plus : convention officielle prénom/nom · sort des 4 écrans orphelins · arbitrage devoirs · arbitrage préparations.

### Prochaines étapes recommandées

*Recommandations techniques, non des règles IDEAL.*

1. Terminer la bascule de `/pedago-archive/` vers `eleves` et `devoirs`
2. Réparer la carte « Préparations » du tableau de bord
3. Trancher les deux doublons
4. Sortir les notifications et les dossiers RH d'`app_state`
5. Désactiver l'affichage de prime tant que le barème n'est pas validé
6. Stratégie de transition vers des permissions serveur
7. Alimenter `journal_audit`
8. Chaîne présences → effectif cantine
9. Allergies et contrôle des menus
10. Modèle maternelle

---

*Photographie arrêtée au 17 août 2026. Aucun code modifié, aucune donnée déplacée pendant sa rédaction.*
