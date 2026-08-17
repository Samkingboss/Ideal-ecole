# AUDIT IDEAL — ÉTAT DE CONFORMITÉ À LA V2.1

*Audit conduit le 17 août 2026 sur le dépôt `Samkingboss/Ideal-ecole` (branche `main`) et sur la base Supabase de production `jircuneixzwsmtktxrkh`. Aucune donnée n'a été modifiée pour produire ce document.*

---

## A. Résumé exécutif

La plateforme est **beaucoup plus avancée que ce que suggère son état apparent**. Quatorze mille lignes de React, vingt-neuf écrans, trente-trois tables réellement créées, cinq portails par rôle, et des modules aboutis — stock à deux magasins, notifications, dossiers RH, programmes de manuels, documents imprimables. Ce n'est pas une maquette.

Trois constats dominent l'audit.

**1. Le socle métier est là ; ce sont les liaisons qui manquent.** Conformément à la règle d'or, la plupart des données ont bien une porte d'entrée unique. Mais plusieurs d'entre elles ne circulent pas jusqu'au bout : les présences n'alimentent aucun effectif de cantine, les allergies ne sont comparées à aucun menu, les devoirs ne partent chez aucun parent. Les tables existent des deux côtés — c'est le tuyau entre les deux qui n'a pas été posé.

**2. La règle « une seule saisie » est enfreinte à un endroit précis et grave : `app_state`.** Cette table clé-valeur, consultée à quarante-cinq endroits du code, héberge aujourd'hui des données fondamentales sous forme de blocs JSON — la liste des élèves, les devoirs, les dossiers du personnel, les menus, les notifications. Ces données existent **en double** avec les tables dédiées, parfois vides pendant que le doublon est plein. C'est le principal écart structurel à la V2.1.

**3. Les permissions n'existent pas côté serveur.** L'authentification repose sur un code d'accès sans mot de passe, la session est un simple objet déposé dans le navigateur, et la clé anonyme Supabase autorise toutes les opérations. Le contrôle des rôles est intégralement écrit dans l'interface. Un utilisateur curieux peut lire et écrire l'ensemble de la base. En phase de laboratoire c'est tolérable ; le jour où de vraies familles y figureront, ce ne l'est plus.

Enfin, la duplicabilité multi-écoles (§20) est **architecturalement absente** : aucune table ne porte d'identifiant d'établissement. IDEAL 2 exigerait aujourd'hui une copie complète de la base.

### Signalement d'une régression introduite pendant cette session

Avant l'audit, et à la demande du directeur, la plateforme Devoirs (`/pedago-archive/`) a été migrée du `localStorage` vers Supabase. **Cette modification était fondée sur un diagnostic incomplet et a été annulée** (commit `eb92b9b`).

La page disposait déjà d'une synchronisation Supabase, en fin de fichier : les élèves venaient des tables `eleves` et `inscriptions`, **filtrés par les classes affectées à l'enseignant**, et les devoirs étaient partagés via `app_state`. La migration ajoutait un second chargeur concurrent qui écrasait le premier, lisait la table `devoirs` (vide) au lieu des **treize devoirs réels** stockés dans `app_state`, et surtout **supprimait le filtrage par classe** — un enseignant aurait vu tous les élèves de l'école.

Cet incident illustre exactement la règle R12 du cahier des charges : auditer avant de modifier. Il est repris en P0 ci-dessous, car la cible reste bonne — c'est le chemin qui était mauvais.

---

## B. Architecture actuelle

### Deux applications sur un même domaine

| Couche | Technologie | Rôle |
|---|---|---|
| Portail | React 19 + Vite 8, JSX sans TypeScript, styles en ligne | Cinq applications par rôle |
| Pages autonomes | HTML/JS statiques dans `public/` | Devoirs & Élèves, comptabilité, rapports, inscription, fiches |
| Données | Supabase (PostgreSQL + PostgREST + Storage) | 33 tables, 3 buckets |
| Hébergement | Vercel, redirection `/* → /index.html` | Déploiement au push |

Les pages statiques (`pedago-archive`, `comptabilite.html`, `rapports.html`, `inscription.html`, `fiche.html`) attaquent Supabase **directement en REST**, avec l'URL et la clé anonyme écrites en clair dans le fichier. Le portail React passe par le client `supabase-js`. Deux chemins d'accès coexistent donc pour les mêmes données, avec deux conventions différentes.

### Authentification

`LoginPage` interroge `users` sur la seule colonne `code_acces`. Il n'y a **ni mot de passe, ni Supabase Auth, ni jeton signé**. La session est un objet JSON déposé dans `localStorage.ideal_user` : `{id, prenom, nom, role, actif}`. Toute personne pouvant écrire dans le stockage local de son navigateur peut se déclarer directeur.

### Routage par rôle (`src/App.jsx`)

| Rôle en base | Effectif | Application servie |
|---|---|---|
| `directeur` | 1 | `DirecteurApp` |
| `responsable_administratif` | 2 | `DirecteurApp` — **la même, sans restriction** |
| `professeur` | 5 | `ProfApp` |
| `surveillant` | 2 | `SurveillantApp` |
| `conseiller_vie_scolaire` | 1 | `ConseillerApp` |
| `cuisiniere` | 1 | `CuisiniereApp` |
| `parent` | 0 | **aucune** |

Le routeur teste `user.fonction` et `user.custom_role`, **deux colonnes qui n'existent pas** dans la table `users`. Ces tests sont inopérants ; le repli sur `user.role` fait le travail. Code mort sans conséquence, mais trompeur.

---

## C. Modules existants

Vingt-neuf écrans, dont trois ne sont plus atteignables.

| Module | Écrans | État |
|---|---|---|
| Direction | `DirecteurApp` (1953 l.), `PerformancesDirecteur`, `ActivitePersonnel` | Riche |
| Cantine | `CuisiniereApp` (1864 l.) | Riche — menus, marché, stock alimentaire |
| Pédagogie primaire | `ProgrammeManuel`, `FichePreparation`, `MonEmploiDuTemps`, `AffectationsMatieres`, `FinDeCours`, `CheckpointModal` | Riche — 17 manuels transcrits |
| Enseignant | `ProfApp`, `DemandesEnseignant`, `DemandeMateriel`, `MaPrime`, `DossierPersonnel` | Complet |
| Vie scolaire | `ConseillerApp` | Présent |
| Surveillance | `SurveillantApp`, `SuiviStock` | Présent |
| Documents | `DocumentPrintStudio`, `CartesScolaires`, `CertificatScolarite`, `SommaireBoscherDocument`, `DevoirsDocument` | Présent |
| Notifications | `NotificationCenter` | Présent |
| **Non atteignables** | `PreparationIA`, `CorrectionDirecteur`, `BulletinPrimaire`, `RecouvrementDocument` | **Code vivant, sans porte d'entrée** |

Les quatre derniers méritent attention : `PreparationIA` est importé dans `ProfApp` mais **jamais affiché** ; `CorrectionDirecteur` — l'écran de notation des préparations par la direction — n'est importé nulle part. Ils ont perdu leur lien lors de la refonte du portail en six sessions. La plateforme Devoirs avait subi le même sort ; son lien a été rétabli le 17 août (`149124f`).

---

## D. Base de données actuelle

Trente-trois tables, toutes réellement créées. Volumes constatés le 17 août 2026 :

| Table | Lignes | Propriétaire métier | Observation |
|---|---|---|---|
| `emploi_du_temps` | 240 | Direction | Sain |
| `journal_audit` | 60 | Système | **Écrit par un seul écran, lui-même débranché** |
| `affectations_matieres` | 41 | Direction | **Aucun `prof_id` renseigné hors CP1/CP2** |
| `app_state` | 21 | — | **Fourre-tout, voir § L** |
| `recrees` | 21 | ? | À documenter |
| `checkpoints` | 20 | Enseignant | |
| `preparations` | 17 | Enseignant | 15 dépôts fichier (ancien modèle) + 2 fiches saisies |
| `materiels` | 16 | Surveillant / Cuisinière | Sain, deux magasins |
| `periodes` | 15 | Direction | |
| `users` | 12 | Administration | 9 actifs |
| `performances` | 11 | Direction | |
| `prof_classes` | 10 | Direction | |
| `classes` | 8 | Direction | Petite Section → CM2 |
| `mouvements_stock` | 5 | Surveillant / Cuisinière | Sain — le stock se recalcule par déclencheur |
| `matieres` | 4 | Direction | |
| `evenements`, `documents`, `objectifs`, `planifications`, `parametres_mois`, `financement_params`, `demandes_materiel` | 1 à 2 | divers | |
| **`eleves`** | **0** | Administration | **Vide, alors que 12 élèves existent dans `app_state`** |
| **`inscriptions`** | **0** | Administration | Vide |
| **`devoirs`** | **0** | Enseignant | **Vide, alors que 13 devoirs existent dans `app_state`** |
| **`presences_eleves`** | **0** | Conseiller | Vide — la vie scolaire n'a jamais servi |
| **`disciplines`** | **0** | Enseignant → Surveillant | Vide |
| `responsables`, `progressions`, `comprehensions`, `sanctions_personnel`, `absences_enseignants`, `manquements` | 0 | divers | Vides |

**Aucune table ne porte de colonne d'établissement** (`ecole_id`, `etablissement_id`, `school_id`, `tenant_id` : vérifié sur huit tables représentatives, aucune n'existe).

### Le cas `app_state`

Table à clé composite `(app, key)` contenant une valeur JSON libre. Vingt et une lignes, regroupées ainsi :

| `app` | Clés | Ce qui y est réellement stocké |
|---|---|---|
| `pedago` | `ideal_students`, `ideal_homeworks` | **12 élèves et 13 devoirs**, dont des images en base64 |
| `rh` | `personnel`, `demandes_rh_global`, `postes`, `points_config` | Dossiers du personnel, demandes d'avance et de prêt, barème de points |
| `notifications` | `notifs_<rôle>`, `notifs_<uuid>` × 5 | Files de notifications par destinataire |
| `cantine` | `cantine_menu_semaine`, `cantine_fiche_marche` | Menu de la semaine, marché du jour |
| `rapports_eleves` | `el:<uuid>`, `ins:<matricule>` × 5 | Rapports par élève |
| `rapports`, `audit_test` | `lang`, `audit_test` | Réglage, résidu de test |

---

## E. Flux actuels

Notation : **✓** flux complet · **⚠** flux interrompu · **✗** flux inexistant

| Donnée | Source | Traitement | Destinataires | État |
|---|---|---|---|---|
| Élève | Parent → `inscription.html` | Contrôle administratif | Enseignant, cantine, vie scolaire | **⚠** `inscriptions` et `eleves` sont vides ; les 12 élèves réels vivent dans `app_state` |
| Présence | Conseiller | `presences_eleves` | Rapports, cantine, direction | **✗** Table vide ; aucun effectif cantine calculé |
| Allergie | Parent → inscription | Dossier alimentaire | Cuisinière → contrôle du menu | **✗** Aucune comparaison menu / restriction dans le code |
| Incident | Enseignant | `disciplines` | Surveillant, conseiller, direction, parent | **⚠** Table présente et vide ; escalade non outillée |
| Devoir | Enseignant → `/pedago-archive/` | `app_state.pedago` | Impression nominative | **⚠** Ni information parentale, ni suivi de remise |
| Préparation | Enseignant → `FichePreparation` | `preparations.contenu` | Avancement du manuel, points | **✓** pour l'avancement · **⚠** la notation par la direction est débranchée |
| Matériel | Enseignant → `demandes_materiel` | Validation surveillant → `mouvements_stock` | Stock, inventaire | **✓** Complet et cohérent |
| Stock | Surveillant / Cuisinière | `mouvements_stock` → déclencheur | Inventaire, alertes de seuil | **✓** Bien conçu : le stock ne s'écrit jamais à la main |
| Demande RH | Employé → `DemandesEnseignant` | Décision direction | Notification, dossier | **✓** Réparé le 16 août |
| Notification | Événements divers | `app_state.notifications` | Cloche par rôle | **⚠** Fonctionne, mais hors des tables métier |

---

## F. Permissions actuelles

**Il n'existe aucune matrice RBAC.** Le contrôle d'accès repose sur trois mécanismes, tous côté client :

1. Le routeur `App.jsx` choisit l'application selon `user.role`.
2. Chaque écran filtre ses requêtes (`.eq('prof_id', user.id)`, `.eq('user_id', user.id)`).
3. La plateforme Devoirs restreint les élèves visibles au périmètre `prof_classes`.

Côté serveur, la politique constatée sur les tables récentes est : lecture, insertion et mise à jour **ouvertes à tous** (`using (true)`), suppression fermée. La clé anonyme est publique — elle figure en clair dans le bundle JavaScript et dans quatre pages statiques.

**Conséquence** : les périmètres exigés au §19 (l'enseignant sur ses classes, le parent sur son enfant, la cuisinière sur la cantine) sont des conventions d'affichage, pas des garanties.

Point positif : la suppression physique est délibérément fermée sur les tables sensibles, ce qui rejoint l'exigence du §19 (« une suppression physique doit être évitée »). Le retrait d'un article de stock passe par une désactivation réversible — bon modèle, à généraliser.

---

## G. Matrice de conformité V2.1

**✅** Conforme · **🟡** Partiellement conforme · **🔴** Non conforme · **⚪** Absent · **🔵** À décider

| § | Domaine | Fonction | État actuel | Conforme ? | Problème | Action proposée | Prio |
|---|---|---|---|---|---|---|---|
| 2 | Principes | R1 Source unique | Respecté sauf `app_state` | 🟡 | Élèves et devoirs en double | Migrer `app_state.pedago` vers `eleves`/`devoirs` | **P0** |
| 2 | Principes | R5 Traçabilité | `journal_audit` existe, écrit par un écran débranché | 🔴 | Historique non alimenté | Rebrancher, étendre aux opérations sensibles | **P1** |
| 2 | Principes | R11 Préservation | 4 écrans vivants sans lien | 🟡 | Fonctions perdues | Rebrancher ou retirer explicitement | **P1** |
| 3 | Gouvernance | Rôles | 6 rôles sur 9 | 🟡 | Parent et assistante maternelle absents | Créer les rôles et leurs portails | P2 |
| 4 | Source unique | Dossier élève | `eleves` vide, données dans `app_state` | 🔴 | Dossier permanent inexistant | Constituer `eleves` comme source | **P0** |
| 4 | Source unique | Parcours annuel | Aucune structure d'historisation | ⚪ | Pas d'historique par année | Table `parcours_scolaire` | P2 |
| 4 | Source unique | Dossier professionnel | `app_state.rh.personnel` | 🟡 | Hors table dédiée | Table `dossiers_rh` | P1 |
| 5 | Inscription | Formulaire parent | `inscription.html` existe | 🟡 | `inscriptions` vide, propagation non vérifiée | Tester le flux complet | P1 |
| 5 | Inscription | Confirmation WhatsApp | — | ⚪ | Absente | Après décision sur le canal | 🔵 |
| 6 | Comptabilité | Scolarité, paiements | `comptabilite.html` | 🟡 | Non audité en détail | Audit dédié | P2 |
| 6 | Comptabilité | Trésorerie 10/12 mois | `financement_params` (1 ligne) | 🟡 | Formules non validées | Paramétrage | 🔵 |
| 6 | RH | Demandes avance/prêt | Complet | ✅ | — | — | — |
| 7 | Vie scolaire | Registre de présence | `presences_eleves` vide | 🔴 | Jamais utilisé | Activer l'écran conseiller | **P0** |
| 7 | Vie scolaire | Présence → cantine | — | ⚪ | Aucun lien | Calculer l'effectif du jour | **P0** |
| 8 | Communication | WhatsApp officiel | Messages générés côté client | 🟡 | Aucune traçabilité | Table `messages_parents` | P1 |
| 9 | Discipline | Signalement | `disciplines` vide | 🟡 | Escalade non outillée | Workflow surveillant → direction | P1 |
| 9 | Discipline | Grille de gravité | — | 🔵 | **Non décidée** | Décision métier | 🔵 |
| 10 | Primaire | Affectations, manuels | Complet, 17 manuels | ✅ | — | — | — |
| 10 | Primaire | Emploi du temps | 240 créneaux | ✅ | — | — | — |
| 10 | Primaire | Préparations | Fiche riche, avancement | ✅ | — | — | — |
| 10 | Primaire | Contrôle qualité direction | `CorrectionDirecteur` débranché | 🔴 | Aucune notation possible | Rebrancher sur les fiches | **P1** |
| 11 | Maternelle | Modèle distinct | — | ⚪ | **Entièrement absent** | Concevoir le modèle | P2 |
| 11 | Maternelle | Alternance PS/GS | — | ⚪ | Absent | Idem | P2 |
| 11 | Maternelle | Contrôle matériel avant cours | — | ⚪ | Absent | Idem | P2 |
| 12 | Devoirs | Création, page de garde | Complet et abouti | ✅ | — | — | — |
| 12 | Devoirs | Impression nominative | Complet | ✅ | — | — | — |
| 12 | Devoirs | Information parentale | — | ⚪ | Absente | Après décision canal | 🔵 |
| 12 | Devoirs | Suivi des remises | — | ⚪ | Absent | Table `remises_devoirs` | P1 |
| 13 | Évaluation | Notes élèves | `BulletinPrimaire` débranché | 🔴 | Pas d'évaluation exploitable | Rebrancher | P1 |
| 14 | Cantine | Allergies à l'inscription | Champ prévu | 🟡 | Non relié | Relier au dossier | **P0** |
| 14 | Cantine | Effectif du jour | — | ⚪ | Absent | Depuis les présences | **P0** |
| 14 | Cantine | Alerte menu incompatible | — | ⚪ | **Absent** | Comparaison ingrédients / restrictions | **P0** |
| 15 | Stocks | Commande → inventaire | Complet, deux magasins | ✅ | — | — | — |
| 15 | Stocks | Inventaire individuel | Partiel | 🟡 | Attribution non historisée par personne | Compléter | P2 |
| 16 | Performance | Points positifs/négatifs | `performances`, `points.js` | 🟡 | Barème non validé | Décision métier | 🔵 |
| 16 | Performance | Vue par l'employé | `MaPrime` | ✅ | — | — | — |
| 17 | Direction | Tableau de bord | Riche | 🟡 | Carte « Préparations » lit des colonnes inexistantes | Corriger | **P1** |
| 18 | Notifications | Catalogue, anti-surcharge | `app_state.notifications` | 🟡 | Hors table, pas de règles | Table `notifications` | P1 |
| 18 | Traçabilité | Ancienne/nouvelle valeur | `lib/audit.js` prêt | 🔴 | Non utilisé | Généraliser | P1 |
| 19 | Permissions | Matrice par action | — | 🔴 | **Aucun contrôle serveur** | RLS réelle + authentification | **P0** |
| 20 | Multi-écoles | Isolation | — | 🔴 | **Aucun `ecole_id`** | Ajouter la dimension | P2 |
| 21 | Continuité | Ne rien casser | Respecté sauf incident du 17/08 | 🟡 | Régression annulée | — | — |

---

## H. Fonctionnalités manquantes

1. **Registre de présence réellement utilisé** — la table existe, l'écran existe, aucune ligne n'a jamais été écrite.
2. **Effectif de cantine calculé** depuis les présences.
3. **Contrôle allergies / menu** — le cœur du §14, entièrement à construire.
4. **Suivi des remises de devoirs** et relances.
5. **Information parentale automatique** (inscription validée, devoir publié, incident).
6. **Modèle pédagogique maternelle** — PS/GS, alternance français-anglais sur deux semaines, maîtresse principale et assistante, contrôle du matériel avant cours. Rien n'existe.
7. **Portail parent** — rôle absent de la base et du routeur.
8. **Parcours scolaire annuel** — aucune historisation par année.
9. **Isolation multi-écoles.**
10. **Authentification véritable** et permissions serveur.

---

## I. Fonctionnalités contradictoires

| Contradiction | Détail | Recommandation |
|---|---|---|
| **Deux dépôts de préparation** | `PreparationIA` (fichier PDF/JPEG) et `FichePreparation` (fiche saisie) écrivent dans la même table `preparations`. Le premier est débranché | Conserver la fiche saisie ; permettre d'y **joindre** une photo plutôt que de rouvrir une seconde voie |
| **Deux cahiers de devoirs** | `/pedago-archive/` (abouti) et l'onglet « Cahier de Devoirs du Soir » de `ProfApp` (sommaire) | Garder `/pedago-archive/`, retirer l'onglet du portail |
| **Élèves en deux endroits** | `eleves` (vide) et `app_state.pedago.ideal_students` (12) | `eleves` fait foi |
| **Devoirs en deux endroits** | `devoirs` (vide) et `app_state.pedago.ideal_homeworks` (13) | `devoirs` fait foi, après migration |
| **Deux chemins d'accès aux données** | Client `supabase-js` (React) et REST brut (pages statiques) | Tolérable, mais à documenter |
| **Colonnes fantômes** | `App.jsx` teste `user.fonction` et `user.custom_role`, absentes de `users` | Nettoyer |

---

## J. Risques techniques

| Risque | Gravité | Détail |
|---|---|---|
| **Clé anonyme toute-puissante** | **Critique** | Publique par nature, elle autorise lecture et écriture sur toute la base |
| **Aucune restauration ponctuelle** | **Élevé** | Forfait gratuit Supabase : une suppression accidentelle est définitive |
| **Images en base64 dans `app_state`** | Élevé | Les devoirs y stockent des photos entières ; la table enfle, les requêtes ralentissent |
| **Deux chargeurs concurrents** | Élevé | Démontré le 17 août : deux `fetch` écrivant les mêmes variables, dernier arrivé gagnant |
| **DDL impossible par l'API** | Moyen | Toute évolution de schéma exige une intervention manuelle dans le SQL Editor |
| **Colonnes lues mais inexistantes** | Moyen | Le tableau de bord direction affiche « Préparation sans titre · Classe : — » |
| **Écrans orphelins** | Faible | Code mort qui donne une fausse impression de couverture |

---

## K. Risques fonctionnels

1. **Une allergie non détectée.** C'est le risque le plus grave de la plateforme : le §14 prévoit une alerte avant validation du menu, elle n'existe pas. Aujourd'hui aucun élève n'est inscrit, donc aucun danger réel — mais le jour de la rentrée, ce vide devient un risque pour un enfant.
2. **Un devoir perdu.** Les 13 devoirs vivent dans une ligne JSON d'`app_state`, sans historique de version.
3. **Une présence non enregistrée** ne remonte nulle part : ni rapport, ni cantine, ni tableau de bord.
4. **Un incident sans suite** — la table est vide et l'escalade n'est pas outillée.
5. **Une évaluation impossible** — la direction ne peut noter aucune préparation.

---

## L. Risques de double saisie

Analyse demandée au §7 du prompt, pour les données fondamentales.

| Donnée | Créée où | Responsable | Stockée où | Duplication ? |
|---|---|---|---|---|
| **Identité élève** | `inscription.html` | Resp. administratif | `inscriptions`, `eleves`, **`app_state.pedago`** | **Oui — triple** |
| **Responsables légaux** | Inscription | Resp. administratif | `responsables` (vide) | Non, mais inutilisée |
| **Classe** | Direction | Direction | `classes`, `prof_classes`, `emploi_du_temps.groupe`, `affectations_matieres.groupe` | **Risque** : le groupe est un texte libre (« CP1 »), rapproché par chaîne |
| **Programme** | Fichiers versionnés | Direction | `src/lib/programmes/` | Non — choix assumé et sain |
| **Présence** | Conseiller | Conseiller | `presences_eleves` (vide) | Non |
| **Allergies** | Parent | Resp. administratif | Non reliées | Non — mais non exploitées |
| **Personnel** | Administration | Administration | `users` **et `app_state.rh.personnel`** | **Oui** |
| **Affectation enseignant** | Direction | Direction | `affectations_matieres`, `prof_classes` | **Risque** : deux tables pour une même notion |
| **Matériel** | Surveillant | Surveillant | `materiels` + `mouvements_stock` | Non — modèle exemplaire |
| **Devoirs** | Enseignant | Enseignant | `devoirs` (vide) **et `app_state.pedago`** | **Oui** |
| **Incidents** | Enseignant | Surveillant | `disciplines` | Non |
| **Évaluations** | Enseignant | Enseignant | `performances`, `checkpoints`, `comprehensions` | **Risque** : trois tables voisines à clarifier |

**Le rapprochement par chaîne de caractères mérite une mention particulière.** Les groupes (« CP1 », « CE1-CE2 ») circulent en texte libre entre `emploi_du_temps`, `affectations_matieres` et les manuels. Une faute de frappe ou un accent suffit à rompre le lien silencieusement — le code compense déjà par une normalisation sans accents ni casse dans `src/lib/programmes/index.js`, preuve que le problème s'est déjà posé.

---

## M. Problèmes multi-écoles

L'exigence du §20 — isolation stricte, noyau commun, paramètres locaux — n'est **pas réalisable en l'état**.

| Point | Constat |
|---|---|
| Identifiant d'établissement | **Aucune table n'en porte** |
| Isolation des données | Impossible : rien ne distingue une école d'une autre |
| Noyau commun / paramètres locaux | Les règles sont mêlées au code, pas paramétrées |
| Utilisateurs | Un `users` global, sans rattachement |
| Déploiement d'IDEAL 2 | Exigerait aujourd'hui de **dupliquer le projet Supabase entier** |

Ce n'est pas bloquant pour l'exploitation d'IDEAL 1, mais chaque table créée sans `ecole_id` augmente le coût de la migration future. **Recommandation technique** : introduire la colonne dès maintenant sur les tables nouvelles, avec une valeur par défaut, sans attendre le besoin.

---

## N. Priorités de correction

### P0 — Critique (avant la rentrée)

| # | Correction | Pourquoi |
|---|---|---|
| 1 | **Migrer les 12 élèves et 13 devoirs d'`app_state` vers `eleves` et `devoirs`** | Fin de la triple source ; condition de tout le reste |
| 2 | **Contrôle allergies / menu** | Sécurité des enfants |
| 3 | **Activer le registre de présence** puis le relier à l'effectif cantine | Deux flux du cahier des charges, aujourd'hui morts |
| 4 | **Authentification et permissions serveur** | Aucune protection des données familiales |

### P1 — Prioritaire

| # | Correction |
|---|---|
| 5 | Rebrancher `CorrectionDirecteur` sur les fiches de préparation ; réparer la carte du tableau de bord qui lit des colonnes inexistantes |
| 6 | Sortir les dossiers RH et les notifications d'`app_state` vers des tables dédiées |
| 7 | Généraliser `journal_audit` aux opérations sensibles |
| 8 | Suivi des remises de devoirs |
| 9 | Trancher le doublon « deux cahiers de devoirs » et « deux dépôts de préparation » |
| 10 | Traçabilité des messages aux parents |

### P2 — Important

| # | Correction |
|---|---|
| 11 | Modèle pédagogique maternelle (PS/GS, alternance, assistantes) |
| 12 | Portail parent |
| 13 | Dimension multi-écoles |
| 14 | Parcours scolaire annuel |
| 15 | Audit détaillé de la comptabilité |

### P3 — Amélioration

| # | Correction |
|---|---|
| 16 | Nettoyer les colonnes fantômes et les écrans orphelins |
| 17 | Remplacer le rapprochement des groupes par chaîne par une clé |
| 18 | Unifier les deux chemins d'accès aux données |

---

## Décisions métier requises du promoteur

Conformément au §3 du prompt et au §23 du cahier des charges, ces points **ne sont pas tranchés** et ne seront pas inventés.

| # | Décision attendue | Bloque |
|---|---|---|
| 1 | Grille de gravité des incidents et sanctions autorisées | P1 — workflow discipline |
| 2 | Seuils de communication parentale | P1 — notifications |
| 3 | Formule de l'indice de performance, pondérations par métier | Barème actuellement codé sans validation |
| 4 | Modalités de valorisation des points pendant les vacances | Écran « Ma Prime » |
| 5 | Canal parental : le WhatsApp officiel est-il le seul autorisé ? | P0 §2, P1 §10 |
| 6 | Heure de clôture des présences — **ou confirmation qu'il n'y en a pas** | P0 §3 |
| 7 | Règles de conservation et d'archivage | Politique de suppression |
| 8 | Paramétrage comptable et validation OHADA | P2 §15 |
| 9 | Calendrier scolaire et périodes | Rapports |
| 10 | **Maternelle** : liste des classes, effectifs, nom des maîtresses et assistantes | P2 §11 |
| 11 | **Deux cahiers de devoirs** : lequel garder ? *(recommandation : `/pedago-archive/`)* | P1 §9 |
| 12 | **Deux dépôts de préparation** : la fiche saisie remplace-t-elle le dépôt de fichier ? | P1 §9 |

---

## Plan d'implémentation proposé

Aucun code ne sera modifié avant validation de ce plan.

### Étape 1 — Rétablir la source unique (P0-1)

* **Correction** : migrer `app_state.pedago.ideal_students` → `eleves`, et `ideal_homeworks` → `devoirs` + bucket `devoirs` pour les images base64.
* **Justification** : R1 et R2 du cahier des charges ; condition préalable à la cantine, aux devoirs et aux présences.
* **Fichiers** : `public/pedago-archive/app.js`, nouveau script de migration.
* **Tables** : `app_state`, `eleves`, `devoirs`, `classes`.
* **Dépendances** : la plateforme Devoirs lit déjà `eleves` + `inscriptions` avec le périmètre `prof_classes` — **ce filtrage doit être préservé**, c'est ce que l'incident du 17 août a démontré.
* **Risques** : perte des 13 devoirs si la migration échoue à mi-chemin ; les élèves portent un `sbId` dont la correspondance doit être vérifiée avant écriture.
* **Migration** : script idempotent, écriture d'abord, bascule de la lecture ensuite, conservation d'`app_state` en lecture seule pendant une semaine.
* **Tests** : les 12 élèves apparaissent dans leur classe ; les 13 devoirs s'affichent et s'impriment ; un enseignant ne voit que ses classes.

### Étape 2 — Sécuriser (P0-4)

* Authentification réelle, puis politiques RLS par rôle. À conduire **avant** toute saisie de données familiales.

### Étape 3 — Fermer la chaîne cantine (P0-2, P0-3)

* Présences → effectif du jour → menu → comparaison avec les restrictions → alerte.
* Dépend de l'étape 1 (les élèves doivent exister) et de la décision métier n° 6.

### Étape 4 — Rendre le contrôle qualité possible (P1-5)

* Rebrancher `CorrectionDirecteur`, réparer la carte du tableau de bord.

### Étape 5 — Sortir d'`app_state` (P1-6)

* Tables dédiées pour les dossiers RH et les notifications, une à la fois, avec double écriture temporaire.

---

*Fin de l'audit. Aucune modification de code n'a été effectuée au titre de ce document ; la seule intervention de la session est l'annulation de la régression du 17 août, décrite au § A.*
