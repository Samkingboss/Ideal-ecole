# Domaines métier — dépendances inter-rôles

À lire **avant** toute modification touchant un domaine. Chaque fiche cite sa
section du V2.1. Ce qui n'y figure pas est signalé comme ouvert — R13 interdit de
le combler.

La colonne « écart » compare le V2.1 à l'état constaté le 23/08/2026.

---

## 1 · Rôles et permissions — V2.1 §3, §19

**Rôles :** promoteur/direction générale · direction d'établissement · responsable
administratif · conseiller de vie scolaire · surveillant · enseignant · assistante
de maternelle · responsable cantine · parent.

**Permissions (§19) :** au minimum *consulter, créer, modifier, valider,
annuler/supprimer lorsque permis, exporter*. Périmètres : le responsable
administratif sur administratif/RH/finances/stocks · le conseiller sur la vie
scolaire · le surveillant sur son périmètre · l'enseignant sur ses classes · la
cuisinière sur la cantine · le parent sur son enfant seulement.

> §19 — « Une suppression physique doit être évitée pour les données historiques
> sensibles ; lorsqu'une annulation suffit, elle est historisée. »

**Écart :** aucun contrôle serveur. Les périmètres sont des conventions
d'affichage. `directeur` et `responsable_administratif` partagent `DirecteurApp`
avec deux interfaces distinctes. Le rôle `parent` n'existe ni en base ni au routeur.
**Le §23 déclare les permissions détaillées non formalisées** — ne pas les inventer.

**Invariants :** `INV-SEC-02`.

---

## 2 · Source unique de vérité — V2.1 §4, R1–R3

Trois structures : **dossier élève permanent** (identité, naissance, responsables
légaux, personnes autorisées, santé/cantine) · **parcours scolaire annuel** (année,
classe, programme, affectations, résultats) · **dossier professionnel** (RH,
documents, matériel, retards, évaluations).

> §4 — le parcours annuel est « une structure interne d'historisation, pas une
> nouvelle inscription administrative imposée au parent chaque année ».

**Écart :** `app_state` héberge encore 27 lignes de données métier — élèves,
devoirs (3,26 Mo en base64), RH, postes, notifications. Aucune table
`parcours_scolaire`. Les 12 élèves n'ont ni date de naissance, ni responsable lié.

**Invariants :** `INV-FLUX-01`, `INV-FLUX-02`, `INV-ELEVE-03`.

---

## 3 · Inscription et parcours élève — V2.1 §5

**Produit :** le parent (formulaire) → **valide :** le responsable administratif.

> §5 — « Après validation, l'élève devient disponible automatiquement dans les
> modules concernés selon sa classe et son programme. » · « Le parent reçoit une
> confirmation via le compte WhatsApp officiel. » · « Si l'enfant est inscrit à la
> cantine, les informations alimentaires utiles sont transmises automatiquement à
> la cuisinière. »

**Consommateurs :** enseignants (listes de classe depuis la base centrale) ·
cuisinière (données alimentaires) · vie scolaire · comptabilité · direction.

**Tables :** `inscriptions`, `responsables`, `documents_inscription`, `eleves`,
bucket `inscriptions`. RPC `creer_inscription`, `valider_inscription_direction`.

**Écart :** la transmission automatique vers la cuisine **n'existe pas** — c'est le
défaut critique C1. Aucune inscription n'a jamais été validée. La création d'élève
peut produire un doublon.

**Invariants :** `INV-ELEVE-01`, `INV-ELEVE-02`, `INV-CANT-01`, `INV-SIG-01`.

---

## 4 · Administration, RH, comptabilité — V2.1 §6

**Produit :** le responsable administratif. Périmètre : scolarité, paiements,
recettes, dépenses, devis, fournisseurs, dettes, salaires, charges fixes, budgets,
prévisions.

> §6 — « L'école fonctionne sur dix mois de scolarité tandis que certaines charges
> couvrent douze mois. Le système doit fournir une trésorerie prévisionnelle. »
> « Les formules exactes restent paramétrables. »

**Écart :** aucune table `paiements`, `depenses`, `salaires`, `postes`.
`comptabilite.html` s'appuie sur `localStorage` et `app_state`, téléverse encore
dans le bucket privé avec un `getPublicUrl` mort, et son calcul de scolarité
annuelle renvoie `0` sur exception. **§23 : paramétrage comptable, OHADA et
trésorerie prévisionnelle non formalisés.**

---

## 5 · Vie scolaire et présences — V2.1 §7

**Produit :** le conseiller de vie scolaire — registre officiel unique.

> §7 — « Un enseignant peut signaler une anomalie, mais ne doit pas créer une
> deuxième base contradictoire. » · « Les présences alimentent automatiquement les
> rapports, tableaux de bord et effectifs de cantine. » · **« Aucun horaire de
> verrouillage fixe n'est imposé par cette version. »**

**Écart :** `presences_eleves` compte 2 lignes. Seul `rapports.html` les lit. Aucun
effectif cantine calculé, aucune visibilité enseignant, aucun indicateur direction.

**Invariants :** `INV-CANT-06`.

---

## 6 · Communication parents — V2.1 §8

> §8 — « Le canal opérationnel officiel est le compte WhatsApp de l'école. **Les
> enseignants ne doivent pas utiliser leurs numéros personnels** pour communiquer
> directement avec les familles dans le cadre scolaire. » · « Les échanges doivent
> être traçables. » · « Un groupe ou espace associé à chaque enfant peut regrouper
> les responsables légaux enregistrés. »

**Produit :** le conseiller prépare et transmet. **La direction dispose d'une
visibilité et peut demander explications ou corrections.**

**Écart :** dix points d'appel `wa.me` dans sept fichiers, **aucune trace
enregistrée**. Un numéro personnel codé en dur dans `DevoirsDocument.jsx` — en
contradiction directe avec le §8. Aucune table `messages_parents`. **§23 : catalogue
des notifications et modèles WhatsApp non formalisés.**

**Invariants :** `INV-FLUX-04`, `INV-FLUX-05`.

---

## 7 · Discipline et incidents — V2.1 §9

**Chaîne :** enseignant signale → surveillant traite dans son périmètre → au-delà,
transmission à la direction. Une convocation passe par le conseiller **puis** par la
direction pour autorisation avant communication officielle.

> §9 — « La grille de gravité, les sanctions et les seuils de communication
> parentale doivent être définis par la gouvernance IDEAL. **Une IA ne peut pas les
> inventer et les rendre obligatoires.** »

**Écart :** `disciplines` compte 4 lignes, avec une échelle *mineure/moyenne/grave*
en usage de fait. L'escalade et la convocation ne sont pas outillées.
**§23 : grille de gravité et seuils non formalisés — ne pas les inventer.**

---

## 8 · Pédagogie primaire — V2.1 §10

**Direction :** affectations de matières, enseignants, manuels, organisation.
L'emploi du temps en découle. **Enseignant :** préparations à partir du programme et
des manuels assignés.

> §10 — « La direction joue un rôle de contrôle qualité. Une préparation ne doit pas
> bloquer le travail quotidien simplement parce qu'elle n'a pas encore été examinée.
> **Aucun délai fixe de validation tacite n'est imposé ici.** »

**Écart :** riche et fonctionnel — 240 créneaux, 41 affectations, 17 manuels,
19 préparations. Mais `CorrectionDirecteur` n'est importé nulle part : **le contrôle
qualité par la direction est impossible**, alors que le §10 le prévoit explicitement.

---

## 9 · Pédagogie maternelle — V2.1 §11

> §11 — PS et GS, modèle distinct. « Sur deux semaines, les enseignants alternent
> entre PS et GS afin de garantir cinq jours effectifs de français et cinq jours
> effectifs d'anglais pour chaque enfant. » · Les maîtresses portent les objectifs,
> les assistantes contribuent par la préparation des matériels. · « Le surveillant
> peut effectuer un contrôle 30 à 60 minutes avant un cours pour vérifier le
> matériel. »

**Évaluation :** maîtresses sur les objectifs et progrès des élèves ; assistantes
sur l'implication et la contribution.

**Écart :** schéma et écrans construits les 20-21 août. **`MaternelleApp` n'est
monté nulle part** : la maîtresse n'a pas accès à son module. 1 préparation,
0 lecture assistante.

**Invariants :** `INV-UI-01`.

---

## 10 · Devoirs et évaluation — V2.1 §12, §13

> §12 — page de garde, objectifs, date de rendu · repères de pagination et nom de
> l'enfant · impression individuelle ou par classe · **« Après publication, le parent
> est informé via WhatsApp officiel »** · à la remise, l'enseignant enregistre les
> rendus, les non-remises déclenchent une relance **selon les règles définies**.

> §13 — l'enseignant suit les progrès ; la direction analyse par élève, classe,
> matière, période et enseignant.

**Écart :** création et impression abouties. Information parentale absente. Aucun
suivi de remise, aucune table `remises_devoirs`. `BulletinPrimaire` jamais importé.
Les devoirs vivent en double : table `devoirs` (14) et `app_state` (13, 3,26 Mo).
**§23 : seuils de relance non formalisés.**

---

## 11 · Cantine — V2.1 §14

C'est la fiche la plus précise du V2.1, et le domaine le plus défaillant.

> §14 — « À l'inscription, le parent renseigne allergies, restrictions et
> informations alimentaires importantes. **Ces données sont saisies une seule fois et
> accessibles à la cuisinière.** » · « Les présences officielles du conseiller
> alimentent automatiquement l'effectif du jour. » · **« Lors de la création d'un
> menu, le système compare les ingrédients aux restrictions alimentaires des enfants
> concernés. Une incompatibilité produit une alerte avant validation et permet de
> prévoir une alternative. »** · Les consommations alimentent stocks et comptabilité.

**Chaîne exigée :** parent → inscription → validation → dossier élève → cuisinière
→ comparaison menu/restrictions → alerte.

**Écart — rupture complète.** La donnée s'arrête à `inscriptions.allergies` : la
fonction de validation ne la recopie pas, les colonnes `allergies`,
`restrictions`, `cantine` **n'existent pas dans `eleves`**, et l'écran affiche
« Aucune ». Cinq enfants fictifs codés en dur peuvent s'afficher à la place des
vrais. Aucune comparaison menu/restrictions. Aucun effectif du jour.

**Invariants :** `INV-CANT-01` à `INV-CANT-06`. **Décision D1.**

---

## 12 · Stocks, matériel, performance — V2.1 §15, §16

> §15 — le responsable administratif commande, réceptionne, inventorie. Les
> attributions sont enregistrées dans l'inventaire individuel. Demandes,
> validations, attributions, consommations et renouvellements sont historisés.

> §16 — le dossier professionnel documente ponctualité, délais, règlement,
> comportement, qualité pédagogique, évaluations, matériel, avertissements,
> lettres d'explication, félicitations. « Un système de points **peut** mesurer
> objectivement les performances. » · **« Les critères, pondérations, coefficients
> et modalités de calcul doivent être explicitement validés par la gouvernance. »**

**Écart :** le stock à deux magasins est le module le plus sain de la plateforme —
demande → validation → mouvement → recalcul par déclencheur → alerte de seuil, et le
stock ne s'écrit jamais à la main. **À préserver tel quel (R11).** L'attribution
individuelle n'est pas historisée. **§23 : formule de l'indice de performance,
pondérations et valorisation des points non formalisées.**

---

## 13 · Notifications et traçabilité — V2.1 §18

> §18 — « Chaque notification doit avoir un événement déclencheur, un destinataire,
> un canal et une règle claire. Le système doit éviter la sur-notification. »
> Exemples cités : inscription validée · devoir publié · devoir non remis · incident
> grave · **menu incompatible → alerte cuisinière** · préparation en retard · stock
> critique.
> « Les données sensibles validées ne doivent pas être modifiées silencieusement.
> Toute correction importante conserve l'ancienne valeur, la nouvelle, l'auteur et
> le motif. »

**Écart :** les notifications vivent dans `app_state`, sans table dédiée. 6 sur 19
n'ont pas de référence exploitable. Les identifiants mélangent UUID et horodatage.
**Le directeur ne peut pas atteindre la ressource visée** : une liste blanche
d'onglets rejette `eleves` et le renvoie sur Synthèse. `journal_audit` est désormais
inaltérable, mais `auteur_id` reste une affirmation du client jusqu'à la phase 3.

**Invariants :** `INV-SEC-04`, `INV-SEC-06`.

---

## 14 · Multi-écoles — V2.1 §20

> §20 — « Le cœur IDEAL doit pouvoir servir plusieurs établissements avec isolation
> stricte des données. »

**Écart :** aucune table ne porte d'identifiant d'établissement. Non bloquant pour
IDEAL 1, mais chaque table créée sans cette dimension augmente le coût futur.
**Recommandation technique, à valider :** introduire la colonne sur les tables
nouvelles, avec une valeur par défaut.
