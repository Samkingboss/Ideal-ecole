# BLUEPRINT — WORKFLOW PRÉPARATIONS CONSOLIDÉ

*Conception arrêtée le 18 août 2026, avant toute implémentation. **Aucun code modifié.***

**Cadre validé par le promoteur** : la fiche de préparation devient le système de référence ; une pièce jointe reste possible ; `PreparationIA` n'est pas supprimé mais absorbé ; nomenclature française unique avec historique ; contrôle factuel et professionnel, pas une notation arbitraire.

Chaque élément est étiqueté **RÈGLE IDEAL VALIDÉE**, **PROPOSITION TECHNIQUE** ou **DÉCISION MÉTIER REQUISE**.

---

## 0. Ce que la conception doit réparer

Trois incohérences ont été mesurées sur le code et les 17 lignes réelles.

| # | Incohérence | Constat |
|---|---|---|
| 1 | **Trois vocabulaires de statut** | Le dépôt écrit `en_attente`/`retard`, la correction attend `valide`/`rejete (retard)`, la base contient `acceptable`/`rejeté (retard)`/`depose` |
| 2 | **Deux définitions du retard** | `points.js` : à temps = déposé **avant le début du cours**. `PreparationIA` : à temps = déposé **10 h avant le cours**. Les deux sont dans le code, en production |
| 3 | **Une note sans calculateur** | La colonne s'appelle `note_ia`, l'écran l'affiche, **aucun code ne la produit** — le dépôt insère `null`. L'origine des 15 notes en base reste **À VÉRIFIER** |

La seconde est la plus grave : elle influence directement les points et la prime affichée aux enseignants.

---

## 1. Modèle de données cible

**PROPOSITION TECHNIQUE.** La table `preparations` est **conservée** — 19 colonnes, 17 lignes. Aucune suppression, trois ajouts.

### 1.1 Colonnes conservées

| Colonne | Usage cible |
|---|---|
| `id`, `user_id`, `date_cours`, `sequence`, `groupe`, `matiere`, `classe_id` | Identification de la séance — inchangé |
| `heure_cours`, `heure_depot` | Calcul du retard |
| `contenu` (JSONB) | **Le cœur** : rubriques, séquences minutées, référence manuel, domaines |
| `url_doc` | **Réaffecté** : la pièce jointe de la fiche, au lieu du dépôt principal |
| `note_directeur`, `commentaire_directeur`, `corrige_par`, `corrige_le` | Contrôle qualité — inchangé |
| `retard_minutes` | Retard constaté au dépôt |
| `status` | **Nomenclature unifiée** (§ 2) |
| `note_ia`, `commentaire_ia` | **Conservées, non utilisées** — aucun calculateur n'existe. Ne pas les afficher tant que rien ne les alimente |

### 1.2 Colonnes à ajouter

| Colonne | Type | Rôle |
|---|---|---|
| `pieces_jointes` | `jsonb` défaut `[]` | Plusieurs fichiers, comme `devoirs.fichiers` : `[{url, nom, type, taille}]` |
| `historique_statuts` | `jsonb` défaut `[]` | `[{statut, le, par, par_nom, motif}]` — l'historique demandé au point 2 |
| `verrouillee_le` | `timestamptz` | Marque une modification exceptionnelle après validation (§ 6) |

`url_doc` reste renseignée avec la première pièce jointe, pour ne pas casser la lecture des 15 dépôts existants.

### 1.3 Source unique des statuts

**RÈGLE IDEAL VALIDÉE** — « ne fais pas dépendre la logique métier de chaînes écrites dans plusieurs composants ».

Un fichier `src/lib/preparations.js` devient l'autorité : codes, libellés, couleurs, transitions permises, et les fonctions `peutPasser()`, `libelle()`, `estEnRetard()`. **Aucun composant ne compare un statut à une chaîne littérale.**

### 1.4 Migration des 17 lignes existantes

| Statut actuel | Lignes | Devient | Justification |
|---|---|---|---|
| `acceptable` | 14 | `deposee` | Déposées, jamais contrôlées par la direction (`note_directeur` nul sur les 17) |
| `rejeté (retard)` | 1 | `en_retard` | Le retard est constaté |
| `depose` | 2 | `deposee` | Les deux fiches saisies |

Sauvegarde préalable, script idempotent, vérification après coup — même méthode que P0-1.

---

## 2. Statuts et transitions

**RÈGLE IDEAL VALIDÉE** — nomenclature française.

| Code | Libellé | Sens |
|---|---|---|
| `brouillon` | **Brouillon** | Commencée, pas encore soumise. L'enseignant seul la voit |
| `deposee` | **Déposée** | Soumise dans les temps, en attente de contrôle |
| `en_retard` | **En retard** | Soumise après l'échéance. Déposée quand même — le travail compte, le retard est constaté |
| `a_corriger` | **À corriger** | La direction demande une reprise, motif obligatoire |
| `validee` | **Validée** | Contrôlée et acceptée |

### Transitions permises

```
brouillon ──déposer──> deposee ─┐
    │                            ├──> a_corriger ──redéposer──> deposee
    └──déposer (hors délai)──> en_retard ─┘         │
                                  │                  └──> validee
                                  └──> validee
```

| Depuis | Vers | Qui | Condition |
|---|---|---|---|
| `brouillon` | `deposee` / `en_retard` | Enseignant | Le statut d'arrivée dépend de l'échéance, pas d'un choix |
| `deposee`, `en_retard` | `validee` | Direction | — |
| `deposee`, `en_retard` | `a_corriger` | Direction | **Motif obligatoire** |
| `a_corriger` | `deposee` | Enseignant | Nouvelle soumission |
| `validee` | `a_corriger` | Direction | **Exceptionnel** — trace `verrouillee_le`, motif obligatoire |

**Deux règles de conception.**

*Un statut n'est jamais choisi dans une liste déroulante* : il résulte d'une action. L'enseignant « dépose », la direction « valide » ou « demande une correction ».

*Le retard ne bloque jamais le dépôt.* Conforme au § 2 R6 de la V2.1 — « une validation humaine ne doit pas bloquer inutilement le fonctionnement quotidien ».

---

## 3. Workflow enseignant

```
Emploi du temps → clic sur une séance → Fiche → [pièce jointe] → Déposer
                                                                     ↓
                                          Déposée ou En retard selon l'échéance
                                                                     ↓
                                    (si À corriger) → reprise → Redéposer
```

| Étape | Détail |
|---|---|
| **Point d'entrée** | La séance de l'emploi du temps — **inchangé**. Aucun formulaire ne redemande classe, matière, date ou heure : ils viennent du créneau |
| **Saisie** | 12 rubriques, 1 à 6 séquences minutées, leçon du manuel obligatoire quand la matière en a un — **inchangé** |
| **Pièce jointe** | *Nouveau* : photo du cahier, PDF, schéma. **Facultative** — un complément, pas un substitut |
| **Dépôt** | Bouton unique « Déposer la préparation ». Le système calcule le retard, écrit le statut, journalise |
| **Reprise** | Si « À corriger », le commentaire de la direction s'affiche **en tête de la fiche**, avant les rubriques |
| **Après validation** | Fiche en lecture seule. Une modification exige une réouverture par la direction |

**Ce qui disparaît** : la double saisie. L'enseignant ne remplit plus une fiche *et* ne dépose plus un fichier séparé.

---

## 4. Workflow directeur

Un écran, quatre files, une question par file.

| File | Question | Contenu |
|---|---|---|
| **À contrôler** | Que dois-je regarder aujourd'hui ? | `deposee` + `en_retard`, la plus ancienne en tête |
| **En retard** | Qui a pris du retard ? | `en_retard`, avec le nombre de minutes |
| **À corriger** | Qu'ai-je renvoyé, et est-ce revenu ? | `a_corriger`, avec la date de la demande |
| **Validées** | Historique | `validee`, repliée par défaut |

### Le contrôle lui-même

**RÈGLE IDEAL VALIDÉE** — « le contrôle doit être factuel et professionnel, pas simplement un système de notation arbitraire ».

Conséquence de conception : **la note sur 20 n'est plus le geste principal.** L'écran actuel demande cinq curseurs avant tout autre chose ; le nouveau demande d'abord une **appréciation par critère** — *conforme* / *à renforcer* / *insuffisant* — chacune pouvant porter un commentaire.

Les cinq critères existants sont conservés : structure et organisation, clarté des objectifs, qualité du contenu, méthodes et activités, évaluation prévue.

Deux actions : **Valider** ou **Demander une correction** (motif obligatoire).

**DÉCISION MÉTIER REQUISE — la note chiffrée est-elle conservée ?**

| Option | Conséquence |
|---|---|
| **A. Appréciations seules** | Contrôle purement qualitatif. `note_directeur` cesse d'être alimentée. Aucun classement possible entre enseignants |
| **B. Appréciations + note calculée** | La note découle des appréciations (conforme 4 / à renforcer 2 / insuffisant 0). Chiffre reproductible et explicable |
| **C. Appréciations + note libre** | La direction note à la main en plus. Risque de contradiction entre l'appréciation et le chiffre |

*Recommandation technique : l'option B. Elle satisfait « factuel », reste explicable — chaque point renvoie à un critère — et préserve la colonne existante.*

### Ce que le directeur voit d'un coup d'œil

Sur chaque ligne : enseignant, classe, matière, date et heure du cours, **leçon du manuel visée**, retard éventuel, nombre de séquences, présence d'une pièce jointe, et **les commentaires des contrôles précédents sur cette même matière** — pour juger d'une progression, pas d'un instantané.

---

## 5. Notifications

**PROPOSITION TECHNIQUE.** Réutilise `lib/notifications.js` — **aucun second système**.

| Événement | Destinataire | Message | Règle |
|---|---|---|---|
| Préparation déposée | Direction | « *Prénom Nom* a déposé sa préparation de *matière* — *classe*, *jour* » | Groupée : **une notification par enseignant et par jour**, pas une par séance |
| Déposée en retard | Direction | idem + « avec *n* min de retard » | idem |
| **Correction demandée** | Enseignant | « Votre préparation de *matière* du *date* demande une reprise » + motif | Immédiate — c'est une action attendue de lui |
| **Validée** | Enseignant | « Votre préparation de *matière* du *date* est validée » | Immédiate |
| Réouverture après validation | Enseignant | « Votre préparation validée du *date* a été rouverte » + motif | Immédiate |

**Anti-surcharge** (§ 18 V2.1) : un enseignant qui dépose ses six séances du jour ne déclenche **pas** six notifications chez le directeur.

**DÉCISION MÉTIER REQUISE** : faut-il une relance automatique quand une préparation manque à l'approche du cours ? Le § 18 la cite en exemple, la règle n'est pas fixée. *Ne sera pas inventée.*

---

## 6. Audit

**RÈGLE IDEAL VALIDÉE** — définir les événements ici, sans rendre le journal global (chantier transversal séparé).

Réutilise `lib/audit.js` et la table `journal_audit`. Sept événements :

| Événement | Action | Ce qui est consigné |
|---|---|---|
| Dépôt | `depot` | statut, retard, présence d'une pièce jointe |
| Modification avant contrôle | `modification` | champs modifiés, ancienne et nouvelle valeur |
| Changement de statut | `statut` | ancien → nouveau, auteur, motif |
| Demande de correction | `correction_demandee` | motif — **obligatoire** |
| Validation | `validation` | appréciations, note si retenue |
| Commentaire | `commentaire` | texte |
| **Modification après validation** | `reouverture` | **motif obligatoire**, horodatage dans `verrouillee_le` |

Le dernier répond directement au § 18 : « les données sensibles validées ne doivent pas être modifiées silencieusement ».

`historique_statuts` (colonne JSONB) porte la vue lisible par l'enseignant ; `journal_audit` porte la trace légale. Les deux sont écrits par le même appel.

---

## 7. Gestion des retards

**DÉCISION MÉTIER REQUISE — c'est le point le plus important de ce blueprint.**

Deux règles contradictoires vivent en production :

| Règle | Où | « À temps » signifie | Effet |
|---|---|---|---|
| **A** | `lib/points.js` | Déposé **avant le début du cours** | Alimente les points et la prime |
| **B** | `PreparationIA` | Déposé **au moins 10 h avant le cours** | Alimente `retard_minutes` |

Elles ne peuvent pas coexister : une préparation déposée deux heures avant le cours est *à temps* selon A et *en retard de 8 heures* selon B.

| Option | Conséquence |
|---|---|
| **A. Avant le début du cours** | Souple. Une préparation faite le matin même compte |
| **B. 10 h avant** | Exigeant : un cours de 8 h impose un dépôt la veille avant 22 h |
| **C. Un délai paramétrable** | Une valeur en base, modifiable sans toucher au code |

*Recommandation technique : l'option C, initialisée sur la règle que vous retiendrez. Elle évite de reproduire l'erreur d'une règle écrite en dur à deux endroits.*

Le § 10 de la V2.1 précise qu'**aucun délai fixe n'est imposé par le cahier des charges** : la décision vous revient entièrement.

En attendant l'arbitrage, la conception retient : le retard **est constaté et affiché**, il **ne bloque jamais** le dépôt, et il **n'entre dans aucun calcul de prime** tant que le barème n'est pas validé.

---

## 8. Pièces jointes

| Point | Choix |
|---|---|
| Bucket | `preparations` — existe, vide, déjà utilisé par `PreparationIA` |
| Nombre | Plusieurs, ordre préservé |
| Formats | JPEG, PNG, WEBP, PDF |
| Taille | 5 Mo par fichier, comme les devoirs |
| Rôle | **Complément.** Une fiche ne peut pas être déposée avec la seule pièce jointe : les rubriques restent obligatoires |
| Les 15 anciens dépôts | **Conservés** dans le bucket `documents`, à leur adresse actuelle. Ils deviennent des préparations *sans contenu structuré*, affichées comme telles |
| Transaction | Les images sont déposées **avant** l'écriture de la ligne ; en cas d'échec, rien n'est enregistré. *Le nettoyage des fichiers orphelins relève du moteur documentaire — sujet séparé* |

---

## 9. Lien avec les manuels

**EXISTANT À CONSERVER — ne rien changer.**

`contenu.programme` porte `{cle, lecon, unite, titre, page, pageFin, tome, code, domaines}`. `avancement()` en déduit la progression de la classe, filtrée par manuel.

Deux conséquences pour le contrôle qualité :

* Le directeur voit la **leçon visée** sur chaque ligne à contrôler — il juge sur le fond, pas seulement sur la forme.
* Une préparation `a_corriger` **reste comptée dans l'avancement** : la séance a eu lieu, le manuel a avancé. *Ne pas confondre le contrôle administratif et la réalité pédagogique.*

**DÉCISION MÉTIER REQUISE** : une préparation *À corriger* doit-elle continuer de compter dans l'avancement du manuel ? *Recommandation technique : oui, pour la raison ci-dessus.*

---

## 10. Lien avec l'emploi du temps

**EXISTANT À CONSERVER.**

Le créneau `{jour, sequence, matiere, groupe}` reste le point d'entrée unique. La permutation des semaines paires (`lib/sequences.js`) est préservée telle quelle : l'heure réelle du cours sert au calcul du retard, pas la case affichée dans la grille.

La grille gagne une lecture d'état : une pastille par séance — préparée, déposée en retard, à corriger, validée, ou rien. L'enseignant voit sa semaine d'un regard.

---

## 11. Impact sur les performances

**Attention — zone sensible.**

`points.js` compte aujourd'hui « Séances préparées à temps », 35 points, cible 12. Ce barème vient de `app_state.rh.points_config`, que le promoteur a déclaré **expérimental et non validé**.

**Le blueprint ne modifie aucun calcul de points.** Deux garde-fous :

1. Le compteur continue de lire `preparations` comme aujourd'hui.
2. La définition du « à temps » sera celle arbitrée au § 7 — **une seule**, lue depuis la source unique, plus jamais dupliquée.

**DÉCISION MÉTIER REQUISE, déjà ouverte** : le barème lui-même. Tant qu'il n'est pas validé, l'affichage de prime doit être neutralisé — chantier séparé déjà identifié.

Une question nouvelle : **une préparation validée par la direction doit-elle rapporter davantage qu'une préparation simplement déposée ?** *Ne sera pas décidé sans vous.*

---

## 12. Impact sur le tableau de bord

La carte « 📚 Fiches de Préparation Déposées » du compte directeur est **cassée** : elle lit `prep.titre` et `prep.classe_nom`, deux colonnes inexistantes, et affiche « Préparation sans titre · Classe : — ».

Elle est **réparée dans ce chantier** et devient un point d'entrée utile :

| Élément | Contenu |
|---|---|
| Compteur | *n* à contrôler · *n* en retard · *n* à corriger |
| Liste | Enseignant, classe, matière, date, leçon du manuel, retard |
| Action | Un clic ouvre le contrôle |
| État vide | « Aucune préparation en attente de contrôle. » — pas un cadre vide |

**PROPOSITION TECHNIQUE** : la carte n'affiche que ce qui appelle une décision. Les validées sont accessibles, non affichées — § 5 du Design System, « un tableau de bord n'est pas une collection de chiffres ».

---

## 13. Expérience utilisateur attendue

Les trois questions du Design System, écran par écran.

### Fiche de préparation — enseignant

| Question | Réponse apportée |
|---|---|
| Où suis-je ? | En-tête : matière, classe, jour, heure. Déjà en place |
| Que dois-je faire ? | Une action principale : **Déposer**. La pièce jointe est visiblement facultative |
| Que s'est-il passé ? | Bandeau de statut en haut : « Déposée le 18 août à 21 h 04 · à temps », ou « À corriger — *motif* » |

* Si « À corriger », **le motif s'affiche avant les rubriques**, pas en pied de page.
* Une fiche validée est en lecture seule, avec la mention du contrôle et son auteur.
* Aucune donnée déjà connue n'est redemandée (§ 6 du Design System).

### Contrôle qualité — directeur

| Question | Réponse apportée |
|---|---|
| Où suis-je ? | « Contrôle des préparations », quatre files nommées |
| Que dois-je faire ? | La file « À contrôler » est ouverte par défaut, la plus ancienne en tête |
| Que s'est-il passé ? | Après validation, la ligne quitte la file avec un retour visible |

* La fiche s'affiche **en lecture**, dans la même mise en page que celle de l'enseignant — pas un formulaire d'audit parallèle.
* Les appréciations précèdent la note.
* « Demander une correction » **exige un motif** : le bouton reste inactif tant qu'il est vide. Prévention de l'erreur, § 2-9.
* Sur mobile : les quatre files deviennent des onglets, la fiche s'ouvre en plein écran.

### États vides et erreurs

* Aucune préparation à contrôler → « Tout est à jour. Les préparations déposées apparaîtront ici. »
* Échec de dépôt → message en français, la saisie est **conservée** (§ 6 du Design System).
* Chargement → structure affichée immédiatement, données ensuite.

---

## 14. Documents et livrables générés

| Livrable | Canal | Format | Contenu |
|---|---|---|---|
| **Fiche de préparation** | Impression, archivage | **PDF A4** | Existe déjà — passe par une fenêtre dédiée. **À ramener dans `DocumentPrintStudio`** pour porter le logo, l'identité et la pagination |
| **Fiche contrôlée** | Remise à l'enseignant, dossier | **PDF A4** | La fiche + le bloc de contrôle : appréciations, motif, auteur, date, visa |
| **Relevé de contrôle qualité** | Direction, bilan de période | **PDF** | Par enseignant ou par classe : nombre de préparations, taux de dépôt à temps, appréciations dominantes, évolution |

**Exigences permanentes appliquées** : logo haute qualité non déformé, nom officiel de l'école, titre et sous-titre, date, hiérarchie typographique, pied de page, pagination.

**Référence de document** : le relevé de contrôle en mérite une. L'architecture — préfixe, année, établissement, type, numéro séquentiel — reste **à définir**, elle ne sera pas inventée ici.

**Pas de JPEG dans ce chantier** : ces documents ne s'adressent pas aux parents. Le JPEG haute qualité reste réservé aux supports qui partent sur WhatsApp.

---

## Récapitulatif des décisions attendues

| # | Décision | Bloque |
|---|---|---|
| **1** | **Définition du retard** : avant le cours, 10 h avant, ou paramétrable | § 7, § 11 — **la plus urgente**, deux règles contradictoires sont en production |
| 2 | La note chiffrée est-elle conservée ? Option A, B ou C | § 4 |
| 3 | Relance automatique avant le cours ? | § 5 |
| 4 | Une préparation « À corriger » compte-t-elle dans l'avancement ? | § 9 |
| 5 | Une préparation validée rapporte-t-elle plus qu'une déposée ? | § 11 |
| *rappel* | Barème de performance | Chantier séparé |

---

## Ce qui ne doit pas bouger

1. Le point d'entrée par l'emploi du temps
2. Les 12 rubriques et les séquences minutées
3. Le lien au manuel et le calcul d'avancement
4. La permutation des semaines paires
5. Les 17 lignes existantes, dont les 15 anciens dépôts et leurs fichiers
6. `lib/notifications.js` et `lib/audit.js` — réutilisés, non dupliqués
7. Les colonnes `note_ia` et `commentaire_ia` — conservées, simplement masquées

---

*Aucun code modifié. En attente d'arbitrage sur les cinq décisions, la première étant bloquante.*
