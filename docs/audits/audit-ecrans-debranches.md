# AUDIT DES QUATRE ÉCRANS DÉBRANCHÉS

*Audit conduit le 18 août 2026 sur le commit `9928544`. **Aucun code modifié.** Objectif : déterminer, pour chacun, ce qui fonctionne, ce qui manque, ce dont il dépend, et s'il doit être conservé, consolidé ou intégré.*

---

## Vue d'ensemble

| Écran | Lignes | Importé | Affiché | Données réelles | Verdict proposé |
|---|---|---|---|---|---|
| `PreparationIA` | 213 | oui (`ProfApp`) | **non** | 15 dépôts | **DÉCISION MÉTIER REQUISE** |
| `CorrectionDirecteur` | 201 | **non** | non | 0 correction | **À CONSERVER — à rebrancher, mais pas en l'état** |
| `BulletinPrimaire` | 251 | **non** | non | **aucune — données fictives** | **À CONSERVER comme maquette** |
| `RecouvrementDocument` | 91 | **non** | non | aucune | **À CONSERVER — à rebrancher** |

Les quatre compilent : `npx vite build` passe, `recharts` est bien installé. **Aucun n'est cassé** — ils sont seulement inatteignables.

---

## 1. `PreparationIA` — dépôt de préparation en fichier

### 1.1 Ce qui est déjà fonctionnel

* Dépôt d'un PDF ou d'une image dans le bucket `preparations` (bucket repointé le 17/08).
* **Calcul du retard** : la préparation est attendue **10 heures avant le cours** ; le retard est calculé en minutes et rafraîchi chaque minute par un `setInterval`.
* Écriture dans `preparations` : `url_doc`, `classe_id`, `matiere`, `date_cours`, `heure_cours`, `status`, `retard_minutes`.
* Liste des dépôts avec badge de note sur 20 selon cinq critères (structure, objectifs, contenu, méthodes, évaluation).
* **15 dépôts réels** en base, tous d'Ornella MOGADZI, du 27 mars au 5 avril 2026, tous notés.

### 1.2 Ce qui manque pour le connecter proprement

* **Aucun point d'entrée** : importé dans `ProfApp.jsx` ligne 4, la balise `<PreparationIA` n'apparaît nulle part.
* **La note n'est produite par personne.** Le champ s'appelle `note_ia`, l'écran l'affiche, mais **aucun code ne la calcule** : `PreparationIA` insère `note_ia: null`. Les 15 notes présentes en base ont été posées autrement — À VÉRIFIER.
* **Vocabulaire de statut incohérent** (voir § 1.5).
* Aucun lien avec l'emploi du temps ni avec le manuel : l'enseignant ressaisit classe, matière, date et heure.

### 1.3 Données et tables

| | |
|---|---|
| Lit | `preparations`, `classes` |
| Écrit | `preparations` (1 `insert`) |
| Stockage | bucket `preparations` |
| Colonnes utilisées | `url_doc`, `status`, `retard_minutes`, `note_ia`, `commentaire_ia`, `classe_id`, `matiere`, `date_cours`, `heure_cours` |

### 1.4 Dépendances

* `supabase` uniquement. Aucun composant partagé.
* **Partage la table `preparations` avec `FichePreparation`** — c'est le doublon du § 12 de l'inventaire.
* Les 15 anciens fichiers sont dans le bucket `documents`, pas `preparations` : leurs URL restent valides, mais un nouveau dépôt irait ailleurs. **Deux emplacements pour un même type de document.**

### 1.5 Le problème central : trois vocabulaires de statut

C'est la découverte la plus importante de cet audit.

| Source | Valeurs |
|---|---|
| `PreparationIA` **écrit** | `en_attente`, `retard` |
| `CorrectionDirecteur` **attend** | `en_attente`, `valide`, `rejete (retard)` |
| La base **contient** | `acceptable` (14), `rejeté (retard)` (1), `depose` (2) |

**Aucune des trois ne coïncide.** L'orthographe elle-même diffère : `rejete` sans accent dans le code, `rejeté` avec accent en base.

### 1.6 Verdict

**DÉCISION MÉTIER REQUISE.** Cet écran est l'une des deux voies de dépôt de préparation. Le rebrancher tel quel rouvrirait la double saisie que l'inventaire signale. Trois options au § 5.

---

## 2. `CorrectionDirecteur` — notation des préparations par la direction

### 2.1 Ce qui est déjà fonctionnel

* Grille de notation **sur 20, en cinq critères de 4 points** : structure et organisation, clarté des objectifs, qualité du contenu, méthodes et activités, évaluation prévue.
* Écriture de `note_directeur`, `commentaire_directeur`, `corrige_par`, `corrige_le`, `status: 'valide'`.
* **Journalisation via `journaliserChamps`** — ancienne valeur, nouvelle valeur, auteur. C'est **le seul écran de toute l'application qui alimente `journal_audit`**.
* Filtres « en attente » / « corrigées ».

### 2.2 Ce qui manque — et un piège vérifié

* **Aucun import nulle part.** Le fichier n'est référencé par aucun autre.
* **Vérifié : rebranché tel quel aujourd'hui, cet écran serait inutilisable.**

| Filtre | Ce qu'il afficherait |
|---|---|
| « en attente » | **2 lignes sur 17** — et ce sont les deux fiches saisies, qui n'ont pas de `url_doc` : l'écran n'a rien à afficher |
| « corrigées » | **0 sur 17** |
| **Invisibles** | **15 sur 17** — précisément les dépôts pour lesquels l'écran a été conçu |

La cause est le désaccord de vocabulaire du § 1.5 : les 15 dépôts portent `acceptable`, que ni un filtre ni l'autre ne reconnaît.

* **Il ne sait pas afficher une fiche saisie** : il attend un `url_doc` à ouvrir, alors que `FichePreparation` écrit un contenu structuré dans `contenu`.

### 2.3 Données et tables

| | |
|---|---|
| Lit | `preparations`, `users` |
| Écrit | `preparations` (1 `update`), `journal_audit` (par `lib/audit.js`) |

### 2.4 Dépendances

* `lib/audit.js` — **la seule utilisation de la traçabilité dans toute l'application**.
* Dépend du modèle « dépôt de fichier ». Bascule vers la fiche saisie = réécriture de l'affichage.

### 2.5 Verdict

**À CONSERVER — À REBRANCHER, MAIS PAS EN L'ÉTAT.**

C'est l'écran le plus précieux des quatre, pour deux raisons : il comble le manque du **§ 10 de la V2.1** (« la direction joue un rôle de contrôle qualité »), aujourd'hui impossible ; et il porte le **seul appel existant à la journalisation**, exigée au § 18.

Deux corrections sont nécessaires avant de le rebrancher :
1. **Unifier le vocabulaire des statuts** — sujet à part entière, avec migration des 17 lignes existantes.
2. **Lui apprendre à afficher une fiche saisie**, pas seulement un fichier.

---

## 3. `BulletinPrimaire` — bulletin scolaire

### 3.1 Ce qui est déjà fonctionnel

* **Une maquette visuelle aboutie**, et de loin la plus riche de l'application en visualisation :
  * double programme **malien et international**, conformément à l'identité bilingue de l'école ;
  * colonnes moyenne T1, écrit T2, oral T2, moyenne T2 ;
  * **indicateur d'évolution** ▲/▼ par matière, calculé entre trimestres ;
  * **graphique d'évolution** élève contre moyenne de classe (`recharts`, installé) ;
  * effectif de la classe, matricule, année scolaire.
* Une feuille de style dédiée, `BulletinPrimaire.css`, avec ses règles d'impression.

### 3.2 Ce qui manque

* **Aucun import nulle part.**
* **Aucune connexion aux données** : le composant ne prend **aucune prop** et ne lit **aucune table**. Tout est en dur — « Khalil SANGARE », matricule « 24-25 A088 », les notes des huit matières.
* La chaîne de données n'existe pas en amont : `comprehensions` est vide, il n'y a **aucune table de notes**, aucune notion de trimestre rattachée à un élève.

### 3.3 Données et tables

**Aucune.** `INTERFACE PRÉSENTE — LOGIQUE ABSENTE`, au sens strict.

Ce qu'il faudrait pour l'alimenter : une table d'évaluations par élève, matière et période — qui n'existe pas. `periodes` (15 lignes) fournirait les trimestres ; `eleves` (12) l'identité ; le reste est à construire.

### 3.4 Dépendances

* `recharts` — **seul écran de l'application à l'utiliser**. La dépendance est installée et le build passe.
* `BulletinPrimaire.css` — **seul écran à avoir sa propre feuille de style**, alors que tous les autres passent par `App.css` ou du style en ligne.
* **N'utilise pas `DocumentPrintStudio`** : il ne suit donc pas l'identité documentaire des autres livrables.

### 3.5 Verdict

**À CONSERVER COMME MAQUETTE — NE PAS REBRANCHER MAINTENANT.**

Le rebrancher n'aurait aucun sens : il afficherait les notes fictives de Khalil SANGARE à qui l'ouvrirait. Ce n'est pas un écran débranché, c'est **un prototype en attente de son module d'évaluation** (§ 13 de la V2.1, aujourd'hui 🟡).

Sa valeur est réelle et double : il **prouve la faisabilité** du bulletin bilingue, et il constitue **le cahier des charges visuel** du futur module de notes. Le supprimer ferait perdre ce travail.

**Point d'attention pour le moteur documentaire** : il n'utilise ni `DocumentPrintStudio`, ni la palette partagée, ni le logo. Lorsque le moteur documentaire central sera construit, ce bulletin devra y être ramené — sinon l'école produira un document au design différent de tous les autres.

---

## 4. `RecouvrementDocument` — avis de recouvrement de scolarité

### 4.1 Ce qui est déjà fonctionnel

* **Document complet et correctement conçu** : construit sur `DocumentPrintStudio`, type `comptabilite` (code couleur violet impérial), titre « AVIS DE RECOUVREMENT DE SCOLARITÉ ».
* Bloc élève : nom, matricule, classe, date de délivrance.
* Informations de recouvrement : tranche concernée, montant dû formaté en francs CFA, date d'échéance, coordonnées du parent.
* **Accepte déjà ses données par prop** : `relanceInfo`, avec un jeu de démonstration en repli.

### 4.2 Ce qui manque

* **Aucun import nulle part.** C'est le seul manque réel.
* **Aucune source de données** : il faut un module de scolarité qui sache dire qui doit combien. `comptabilite.html` existe (page statique, non auditée en détail) mais rien ne relie les deux.
* Aucune référence de document — le § 13 des exigences éditoriales en prévoit une pour les courriers de ce type.

### 4.3 Données et tables

**Aucune** — tout arrive par la prop `relanceInfo` : `eleveNom`, `matricule`, `classe`, `parentNom`, `telephone`, `tranche`, `montantDu`, `dateEcheance`, `dateDelivrance`.

C'est **la meilleure architecture des quatre** : le composant ne connaît pas la base, il reçoit des données structurées. C'est exactement le modèle visé pour le moteur documentaire.

### 4.4 Dépendances

* `DocumentPrintStudio` — partagé, déjà utilisé par `DevoirsDocument`.
* Aucune dépendance à la base.

### 4.5 Verdict

**À CONSERVER — À REBRANCHER.** C'est le plus simple des quatre : il ne lui manque qu'un appelant.

Deux voies possibles, **DÉCISION MÉTIER REQUISE** sur laquelle retenir :
1. depuis le **compte directeur / responsable administratif**, sur la fiche d'un élève dont la scolarité est impayée ;
2. depuis la **page comptabilité**, en lot, pour éditer les relances d'une tranche.

Il faut d'abord savoir **où vivent les données de scolarité** — question ouverte depuis l'inventaire (§ 4.7, À VÉRIFIER).

---

## 5. Ce qui doit être décidé avant tout code

### Décision 1 — Les deux systèmes de préparation

Le sort de `PreparationIA` et de `CorrectionDirecteur` est lié. Trois options, avec leurs conséquences :

| Option | Conséquence |
|---|---|
| **A. La fiche saisie remplace le dépôt de fichier** | `PreparationIA` reste hors ligne. `CorrectionDirecteur` est rebranché **sur les fiches saisies** : il faut lui apprendre à afficher un contenu structuré au lieu d'un fichier. Une seule voie, aucun double comptage. Les enseignants qui préparent à la main perdent le dépôt photo — sauf à joindre une photo à la fiche. |
| **B. Les deux voies coexistent** | Les deux écrans sont rebranchés. Il faut unifier les statuts, et **accepter que les points et les retards puissent compter deux fois** la même séance. |
| **C. Le dépôt de fichier remplace la fiche saisie** | Perte du lien au manuel, de l'avancement et des domaines à couvrir — c'est-à-dire de tout le travail des dix derniers jours. **Non recommandé.** |

*Recommandation technique, non une règle : l'option A, complétée par la possibilité de joindre une photo à la fiche.*

### Décision 2 — L'unification des statuts

Quelle que soit l'option retenue, les 17 lignes de `preparations` portent trois vocabulaires. **DÉCISION MÉTIER REQUISE** sur les valeurs officielles. Proposition à valider : `deposee` → `en_retard` → `validee` → `a_corriger`.

### Décision 3 — Le point d'entrée de l'avis de recouvrement

Compte directeur, page comptabilité, ou les deux.

### Décision 4 — Le module d'évaluation

`BulletinPrimaire` attend une table de notes qui n'existe pas. Sa construction relève du § 13 de la V2.1 et n'est pas un chantier de rebranchement.

---

## 6. Ordre d'exécution proposé

*Sous réserve des décisions ci-dessus.*

| # | Action | Dépend de | Risque |
|---|---|---|---|
| 1 | **Rebrancher `RecouvrementDocument`** | Décision 3 | Faible — un composant autonome, aucune écriture |
| 2 | **Unifier les statuts de `preparations`** | Décision 2 | Moyen — migration de 17 lignes, sauvegarde préalable |
| 3 | **Rebrancher `CorrectionDirecteur`** | Décisions 1 et 2 | Moyen — il écrit en base et journalise |
| 4 | **Trancher le sort de `PreparationIA`** | Décision 1 | — |
| 5 | **Laisser `BulletinPrimaire` en attente** | Décision 4 | — |

**Le point 3 apporte le gain le plus élevé** : il rend possible le contrôle qualité exigé au § 10, et il **allume la traçabilité** du § 18, aujourd'hui totalement inerte.

---

## 7. Exigences permanentes à respecter lors du rebranchement

* **Aucune suppression de code** : les quatre écrans sont conservés.
* **Identité IDEAL sur les livrables** : `RecouvrementDocument` passe déjà par `DocumentPrintStudio` ; `BulletinPrimaire` **non**, et devra y être ramené.
* **Références de document** : l'avis de recouvrement en a besoin. L'architecture reste à définir — préfixe, année, établissement, type, numéro.
* **PDF pour les documents structurés** (bulletin, avis), **JPEG haute qualité** pour ce qui part sur WhatsApp.
* **Expérience cohérente** : un écran rebranché doit trouver sa place naturelle dans la session du rôle concerné, pas être ajouté comme un onglet de plus.

---

*Aucun code modifié. Aucune donnée touchée. En attente d'arbitrage sur les quatre décisions.*
