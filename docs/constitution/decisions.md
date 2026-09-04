# Décisions du promoteur

Rang 2 de la constitution. Complète le V2.1 là où il laisse ouvert ; ne le
contredit jamais. Verbatim, jamais paraphrasé.

---

## Tranchées

### D1 — Données alimentaires · 23/08/2026 · ✅

> Food-safety information must have an explicit validation state. An unvalidated
> record must NEVER be displayed as "None", "No allergy", "Aucune", or any
> equivalent. It must display: "NON VALIDÉE / NOT VALIDATED".
> Do not automatically interpret free-text values such as RAS, Ras, None, blank
> values, etc. as a medically or operationally validated absence of allergy.
> The target model must distinguish at least: known allergies · dietary
> restrictions · additional notes where required · validation status ·
> validated_by · validated_at.
> The validated information must become the authoritative source consumed by the
> canteen and other authorized roles.

**Fondement V2.1 §14** — « À l'inscription, le parent renseigne allergies,
restrictions et informations alimentaires importantes. Ces données sont saisies une
seule fois et accessibles à la cuisinière. » D1 précise *l'état de validation*, que
le V2.1 ne définissait pas.

**Invariants** : `INV-CANT-01`, `INV-CANT-02`, `INV-CANT-03`.

---

### D2 — Autorité de signature · 23/08/2026 · ✅

> APPROVED: NAMED AND TRACEABLE DELEGATION. The system must never write the
> currently logged-in user as the Director simply because that user performed the
> action. The system must distinguish: authority under which the act is performed ·
> actual authenticated signatory · role/permission · whether the act was performed
> directly or by delegation · timestamp · audit trail.
> A delegated user may sign only if explicitly authorized by backend permission.

**Complété le 23/08** — option B : préparer le modèle maintenant, **garder l'action
de signature désactivée** jusqu'à ce que Supabase Auth identifie l'utilisateur, que
l'identité soit liée à un profil IDEAL, que le backend connaisse le rôle, que la
permission soit vérifiée côté serveur, que la délégation soit stockée et vérifiable,
et que l'audit enregistre l'acteur réellement authentifié.

**Fondement V2.1 §18** — « Les actions importantes conservent auteur, date/heure,
objet, état et justification. » D2 ajoute la distinction autorité / signataire.

**Invariants** : `INV-SIG-01`, `INV-SIG-02`.

---

### D3 — Doublons d'élèves · 23/08/2026 · ✅

> Never automatically merge students. Duplicate detection may automatically warn
> based on matching identity attributes, but the final decision must be human.
> Use a stable immutable technical student ID (UUID) as the primary identity.
> The school matricule is a business identifier, not the fundamental technical
> identity of the student.
> On suspected duplicate: show the existing student · show the incoming
> registration · show conflicting fields · require an explicit decision: link to
> existing student / create distinct student / correct data before continuing.
> A006/A007 should be preserved for now as a duplicate-detection test case.

**Fondement V2.1 §4** — « Parcours scolaire annuel : […] structure interne
d'historisation, pas une nouvelle inscription administrative imposée au parent
chaque année. » Le V2.1 impose donc déjà une identité élève permanente distincte de
l'inscription annuelle ; D3 nomme l'UUID comme cette identité.

**Invariants** : `INV-ELEVE-01`, `INV-ELEVE-02`.

---

### D5 — Circuit des préparations maternelles et barème · 04/09/2026 · ✅

> Voila super, memorise on continue la logique des points

Cette validation porte explicitement sur le barème présenté immédiatement avant
la décision : **20 points** pour une préparation déposée au moins 24 heures avant
le cours, puis retrait d'un point par heure jusqu'au seuil de 5 heures ; **10
points** pour la lecture et l'apport de l'assistante ; **10 points** pour la
préparation du matériel par l'assistante ; **10 points** pour le traitement ou
l'escalade par le surveillant ; **10 points** pour la fourniture finale par le
responsable administratif. Une préparation reçue à moins de cinq heures du cours
ne pénalise pas l'assistante. Le dernier maillon qui n'a pas accompli son action à
temps porte la responsabilité. Le barème reste modifiable par la Direction seule.
Entre 24 heures et 5 heures, le retrait est calculé au prorata exact selon la
formule `max(0 ; 20 - (24 - heures d'avance))`. Le maximum théorique est de 60
points lorsque les cinq rubriques sont applicables ; une rubrique non applicable
est neutralisée. Cette règle est désormais inscrite au § 28 quater D et à
l'Annexe J.3 du Référentiel pédagogique officiel.

**Fondement V2.1 §§11, 15, 16 et 18** — l'assistante contribue au cours et au
matériel, le stock suit demandes et livraisons, l'attribution des points repose sur
des critères validés, et chaque passage de relais conserve son auteur et son heure.

**Invariants** : pas de seconde table de préparations, pas de second stock,
identité de l'acteur lue depuis `auth.uid()`, journal append-only de chaque action.

---

### D6 — Pourcentages du bulletin maternelle · 04/09/2026 · ✅

Le bulletin maternelle conserve ses indicateurs visuels en pourcentage : **TB =
100 %**, **B = 75 %**, **M = 50 %**, **AR = 25 %**. Les compétences non évaluées
sont exclues ; le score d'un domaine est la moyenne de ses compétences évaluées et
la progression globale est la moyenne des domaines évalués. Ces pourcentages ne
sont pas des notes académiques, ne classent pas les enfants et ne déterminent pas
leur passage. La règle est inscrite au § M8.1 du Référentiel pédagogique officiel.

---

### Règle QA · 23/08/2026 · ✅

> Do not delete the current test data yet. Treat the current dataset as QA/test
> material until we have a controlled replacement test dataset and regression tests.

Les 7 inscriptions, 12 responsables, 18 pièces, 12 élèves, 4 incidents, 2 retards et
28 objets Storage restent. Le système doit se comporter correctement **avec** eux.

**Invariant** : `INV-QA-01`.

---

### C1–C5 — Identité, civilité, correctifs clos · 24/08/2026 · ✅

> - conserver `DOSSIER D'INSCRIPTION` comme libellé du PDF d'inscription ;
> - **ne jamais déduire la civilité à partir du prénom** ;
> - conserver une formulation professionnelle épicène tant qu'une donnée
>   explicite de civilité n'existe pas ;
> - inscrire `civilite` dans les évolutions du profil personnel à traiter au
>   moment approprié ;
> - ne pas rouvrir les correctifs déjà prouvés sauf régression détectée.

**Appliqué.** `src/lib/identiteProfessionnelle.js` — `genreDe()` ne lit que des
données déclarées : la colonne `civilite` le jour où elle existera, et le préfixe
de `users.fonction` en attendant (`maitresse-`, `assistante-`). Il ne regarde
jamais le prénom. Garde `test-identite.mjs` P4 et P5.

**Correctifs déclarés clos :** Programme / Boscher · Devoirs mobile · Identité
professionnelle · moteur documentaire.

---

## Déjà tranchées par le V2.1 — ne pas rouvrir

| Question | Réponse du V2.1 |
|---|---|
| **Heure de clôture des présences** | §7 — « Aucun horaire de verrouillage fixe n'est imposé par cette version. » |
| **Modèle d'identité de l'élève** | §4 — dossier élève permanent + parcours scolaire annuel comme structure interne d'historisation |
| **Canal parental** | §8 — le compte WhatsApp officiel de l'école. Les enseignants ne doivent pas utiliser leurs numéros personnels. |
| **Délai de validation des préparations** | §10 — « Aucun délai fixe de validation tacite n'est imposé ici. » |
| **Suppression des données sensibles** | §19 — la suppression physique doit être évitée ; l'annulation est historisée. |
| **Deux cahiers de devoirs / deux dépôts de préparation** | §21 — conserver les fonctions solides, corriger les connexions. Le choix reste au promoteur, mais sans repartir de zéro. |

---

## Ouvertes — V2.1 §23, à formaliser par la gouvernance

Le V2.1 les déclare explicitement non tranchées. **R13 interdit de les combler.**

| # | Décision | Bloque |
|---|---|---|
| 1 | Grille de gravité des incidents et sanctions autorisées | Workflow discipline |
| 2 | Seuils de communication parentale | Notifications, relances |
| 3 | Permissions détaillées par action et par rôle | Phase 3 — RLS fine |
| 4 | Catalogue des notifications et modèles WhatsApp | Messagerie |
| 5 | Règles de conservation et d'archivage | Politique de suppression |
| 6 | Formule de l'indice de performance | Points et primes |
| 7 | Critères et pondérations par métier | Idem |
| 8 | Valorisation des points pendant les vacances | Écran « Ma Prime » |
| 9 | Calendrier scolaire et paramètres des périodes | Rapports, bulletins |
| 10 | Règles de trésorerie prévisionnelle | Comptabilité |
| 11 | Paramétrage comptable et validation OHADA | Comptabilité |
| 12 | Politique de sauvegarde, sécurité, reprise | Exploitation |
| 13 | Procédure de déploiement d'une nouvelle école | Multi-écoles |
| 14 | Procédure de tests fonctionnels et de non-régression | *En cours de formalisation — l'outillage installé le 23/08 y répond partiellement.* |

## Décisions techniques restant à poser

| # | Question | Contexte |
|---|---|---|
| T5 | Colonne `civilite` sur `users` | **Décidée** (C4) : à ajouter au profil personnel, au moment approprié. Sans elle, la forme épicène s'applique — jamais une supposition. |
| T1 | Mécanisme d'authentification — mot de passe, ou code haché hors de portée de lecture ? | Conditionne la phase 3, donc la phase 4 |
| T2 | Sort des 7 dossiers et 12 élèves de test | Gelé par la règle QA jusqu'aux tests de non-régression |
| T3 | Ouverture d'un accès parent | §3 et §19 le prévoient ; dimensionne l'authentification |
| T4 | Valeur par défaut de `eleves.cantine` | Décidé : **NULL / TRUE / FALSE**, l'inconnu n'est jamais une inscription confirmée |
