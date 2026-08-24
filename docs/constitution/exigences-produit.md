# Exigences produit durables — 24 août 2026

Rang 2 de la constitution. Décisions et exigences du promoteur, énoncées le
24 août 2026. **Elles ne sont pas conditionnées par la phase technique en
cours** : elles restent dues même quand le chantier actif porte sur autre
chose, et doivent survivre au changement de session.

Ce document dit ce qui est attendu, pas quand. L'ordonnancement est en fin de
fichier.

---

## La question qui tranche

> **Est-ce que cela fait gagner du temps et réduit les erreurs du personnel ?**
>
> Si la réponse est non : repenser la fonctionnalité.

IDEAL ne doit pas devenir une charge administrative supplémentaire. Toute
évolution qui ajoute une saisie sans supprimer un travail contredit cette
règle.

Objectif de sensation, pas de spécification :

> **J'OUVRE → JE TRAVAILLE.**

---

## Décisions closes le 24/08/2026

| | Décision |
|---|---|
| **C1** | `DOSSIER D'INSCRIPTION` reste le libellé du pied du PDF d'inscription. |
| **C2** | **Ne jamais déduire la civilité d'un prénom.** Interdiction, pas préférence. |
| **C3** | Forme professionnelle **épicène** tant qu'aucune donnée explicite de civilité n'existe. |
| **C4** | `civilite` entre dans les évolutions du profil personnel, à traiter au moment approprié. |
| **C5** | Ne pas rouvrir un correctif déjà prouvé, sauf régression détectée. |

Les correctifs Programme / Boscher / Devoirs mobile / Identité professionnelle
sont **validés et clos**.

---

## 1 · Fluidité et synchronisation

**Constat du promoteur, sur appareil réel :** ouverte depuis une icône PWA,
l'application peut mettre **plusieurs minutes** à refléter des données à jour.
Jugé **inacceptable**.

> **Ne pas optimiser pour l'iPhone seul.** Android, iPhone/iPad, Windows, Mac,
> navigateur classique et PWA sont tous au périmètre.

Comportement visé :

```
ouverture rapide
  → dernières données sûres si pertinent
  → synchronisation en arrière-plan
  → nouvelles données dès réception
```

**Jamais de faux zéro pendant une synchronisation.**

À auditer : Service Worker · politique de cache · invalidation · restauration
de session Auth · nombre de requêtes au démarrage · requêtes séquentielles
inutiles · N+1 · durées de réessai · données chargées sans nécessité · requêtes
répétées · cache applicatif · rafraîchissement après déploiement.

Quatre états à distinguer, jamais confondus :

```
MISE À JOUR…    HORS LIGNE    ERREUR RÉSEAU    DONNÉES À JOUR
```

> Un membre du personnel ne doit **jamais** avoir à vider son cache pour
> recevoir les mises à jour d'IDEAL.

## 2 · Programmes — règle canonique

```
MATIÈRE / DOMAINE → PROGRAMME → OBJECTIFS → PROGRESSION
                  → SÉQUENCES → LEÇONS → RESSOURCES
```

Un manuel **ne devient jamais** la structure principale. Boscher reste une
ressource de Lecture. La règle vaut pour **tous les niveaux du primaire**.

**Maternelle :** organisation par domaines puis objectifs, séquences, activités
et ressources. Présentation simple et intuitive, accordéons quand pertinent.

## 3 · Préparations maternelle — règle de temps

**L'horodatage strict initialement envisagé n'est plus souhaité.** La connexion
est parfois instable au Mali.

> Une enseignante ne doit pas être considérée en retard parce que la
> synchronisation serveur a eu lieu plus tard.

Règle métier : la préparation doit être **effectuée et soumise dans la journée
concernée**. Quand l'architecture le permettra :

```
moment de saisie locale   ≠   moment de synchronisation serveur
```

Séquence manquante — message imposé, pédagogique et non punitif :

> « Précisez la séquence afin que la progression de la leçon et les informations
> destinées aux parents restent cohérentes. »

## 4 · Une saisie → plusieurs restitutions

```
UNE INFORMATION → UNE SAISIE → PLUSIEURS RESTITUTIONS
```

L'enseignant prépare **une seule fois**. IDEAL en tire le support de
préparation, la progression, les fiches parents, les éléments de rapport et les
autres restitutions autorisées. **Aucune double saisie.**

## 5 · Fiche parent — maternelle

Les enfants y utilisent un cahier d'activités commun. Il faut une fiche
**journalière, synthétique, personnalisée par enfant**.

```
AWA TRAORÉ
Lundi 7 septembre 2026

MATHÉMATIQUES
Leçon : Reconnaître les chiffres 0 et 1
Séquence : 2 / 4
Objectif : À la fin de cette progression, Awa devra être capable de
reconnaître les chiffres 0 et 1 et d'associer les quantités correspondantes.

GRAPHISME
Leçon : Trait vertical
Séquence : 1 / 3
```

Elle reprend les matières **réellement enseignées ce jour-là** et montre ce qui
commence, ce qui continue, le numéro de séquence, l'objectif, et ce que l'enfant
doit savoir faire. Une leçon est terminée quand la progression atteint sa
dernière séquence.

Personnalisée au nom de l'enfant · jolie · colorée · imprimable · conçue pour
être **collée dans le cahier**. **Aucune ressaisie par la maîtresse.**

## 6 · Fiche parent — primaire

Les cahiers y sont organisés par matière : la restitution l'est aussi.

```
FRANÇAIS — GRAMMAIRE
Leçon : Le groupe nominal
Séquence : 1 / 3
Aujourd'hui nous avons appris : […]
À la fin de cette progression, l'enfant devra être capable de : […]
Points importants : […]
```

**Filet de sécurité** quand l'enfant a mal copié le cours : le parent doit
pouvoir savoir ce qui a été enseigné, l'objectif, les notions importantes et où
en est la progression. Design plus sobre que la maternelle, très professionnel.

## 7 · Devoirs de maison

Libellé officiel : **« Devoir de maison »**. Jamais « du soir ». *(clos)*

Mobile-first : formulaire vertical, aucun débordement horizontal, actions
principales accessibles, classe puis destinataires, « Toute la classe » /
« Certains élèves », **recherche si beaucoup d'élèves** *(reste à faire)*.

La fonction professionnelle apparaît sur le devoir et les documents. *(clos)*

## 8 · Identité professionnelle

Sur devoir, fiche pédagogique, message parent, rapport, document, certificat,
attestation, notification, PDF, PNG/JPEG :

```
NOM  +  FONCTION PERTINENTE AU CONTEXTE
```

Multi-rôle : `Directeur` sur un document de direction, `Enseignant de
Mathématiques` sur un devoir de mathématiques. La fonction est **dérivée des
vraies affectations**, jamais ressaisie.

Forme épicène tant que `civilite` n'existe pas — voir C2, C3, C4.

## 9 · Documents officiels — charte unique

Auditer et harmoniser : certificat de scolarité · attestations · attestations de
travail · menu hebdomadaire · cartes scolaires · convocations · rapports ·
documents RH · PDF d'inscription · autres.

Créer une **source graphique canonique partagée**. Vérifier nom officiel de
l'école, logo, couleurs, typographie, en-tête, pied, signatures, date,
disposition, impression.

> Ne pas permettre que chaque module réinvente sa propre charte.

## 10 · Messagerie enseignant → parents

```
ENSEIGNANT AUTHENTIFIÉ → CLASSES AFFECTÉES → ÉLÈVES AUTORISÉS
                       → ÉLÈVE → RESPONSABLE(S) → MESSAGE
```

Jamais tous les élèves de l'école. Jamais de ressaisie d'un numéro existant.
Plusieurs classes : CLASSE → ÉLÈVE. Une seule : les élèves directement.

`LOADING ≠ EMPTY ≠ ERROR`. Canal WhatsApp présenté honnêtement : **ne pas
déclarer « message reçu » sans preuve.**

## 11 · Rapport hebdomadaire élève

Responsable : **conseiller de vie scolaire**. Sur choix d'un enfant et d'une
semaine, agrégation automatique : présence, absences, retards, maladies,
meilleures notes, réussites, difficultés, incidents, observations.

> Le rapport doit **raconter réellement la semaine de l'enfant**.

Prévoir taux de présence, réussites principales, points à renforcer, incidents,
message final adapté.

**Cas maladie — ne jamais culpabiliser :**

> « Nous souhaitons un prompt rétablissement à [Prénom] et espérons le retrouver
> très bientôt parmi nous. »

Prévisualisable, exportable en PNG/JPEG, à la charte officielle.

## 12 · Appels du conseiller aux parents

**Pas d'enregistrement audio automatique.** Une fiche de suivi : élève ·
responsable contacté · date et heure · motif · joint / sans réponse / à
rappeler · résumé · action à suivre · date de suivi.

Ajouté automatiquement à la timeline de l'enfant.

## 13 · Timeline 360° élève

Vue chronologique réunissant, **selon permissions** : inscription, présence,
absence, retard, maladie, incident, appel parent, rapport hebdomadaire,
observation, événements importants.

> Ne pas créer une table nouvelle si les données peuvent être assemblées depuis
> les sources existantes.

## 14 · Anniversaires

La date de naissance de l'inscription alimente l'agenda **automatiquement**.
Pas de double saisie. Agenda : aujourd'hui · demain · cette semaine · bientôt.

Le conseiller reçoit un rappel d'appel. Workflow :

```
ANNIVERSAIRE → À CONTACTER → PARENT CONTACTÉ → À CONFIRMER
→ CONFIRMÉ À L'ÉCOLE / NON CÉLÉBRÉ / ANNULÉ → CÉLÉBRÉ
```

Célébration confirmée : notifier **les personnels concernés**, pas tout le monde.

## 15 · Agenda global

Centre de coordination : événements, réunions, anniversaires, tâches,
échéances, événements pédagogiques, rappels. Chacun ne voit que ce que ses
permissions autorisent.

## 16 · Réunions et comptes rendus

Réunion : titre · date et heure · lieu · type · ordre du jour · organisateur ·
invités · présents · confidentialité.
Après : résumé · décisions · responsables · échéances.
**Chaque décision peut devenir une tâche.**

## 17 · Décision → tâche → rappel

Action : tâche · responsable · collaborateurs · priorité · échéance · statut ·
rappels.

Statuts : `À faire` `En cours` `Bloqué` `Terminé` `Annulé`.
Rappels configurables — par exemple 7, 3 et 1 jour avant.
Le directeur voit : à venir · en retard · en cours · terminé.

## 18 · Confidentialité des réunions

**Un compte rendu n'est jamais automatiquement public.** Accès selon
participants, personnes autorisées, niveau de confidentialité :

```
PRIVÉ · DIRECTION · ADMINISTRATION · PÉDAGOGIQUE · GÉNÉRAL
```

**Sécurité côté serveur, pas seulement frontend.** Une personne peut recevoir
une tâche **sans** obtenir l'accès au compte rendu confidentiel. Accusé de
lecture quand pertinent.

## 19 · Comptes multi-rôles

Le directeur et le responsable administratif peuvent aussi enseigner.

```
UNE PERSONNE → UNE IDENTITÉ AUTH → UN PROFIL IDEAL → PLUSIEURS RESPONSABILITÉS
```

**Pas de deuxième compte professeur.** Le directeur affecte matière, classe,
heures, responsabilités pédagogiques ; cela déclenche automatiquement les
fonctionnalités enseignant pertinentes.

## 20 · Conseiller de vie scolaire

Espace organisé autour de son travail quotidien : entrées et sorties,
présences, absences, retards, incidents, suivi élèves, appels parents, rapports
hebdomadaires, anniversaires, agenda, tâches, accès RH selon permissions.

Son tableau de bord répond immédiatement à :

> **QUE DOIS-JE TRAITER AUJOURD'HUI ?**

## 21 · L'inscription est le workflow pivot

```
INSCRIPTION → ÉLÈVE → inscription_id → RESPONSABLE(S) → DATE DE NAISSANCE
→ CLASSE → ENSEIGNANTS AUTORISÉS → VIE SCOLAIRE → MESSAGERIE
→ ANNIVERSAIRES → RAPPORTS
```

> **Tester ce workflow complet avec une fixture fictive avant de considérer les
> dépendances terminées.**

## 22 · Données de test et données réelles

Les identités actuelles sont fictives. Restent **réelles et à conserver** :
programmes, prévisions financières, référentiels, configurations, paramètres
métier, structures pédagogiques.

> Ne jamais assimiler « ancien » ou « créé pendant le développement » à
> « donnée jetable ».

Voir [`classification-donnees.md`](classification-donnees.md).

## 23 · Performance, mobile et réseau

Tout écran nouveau est testé à **375 px, 390 px, 430 px et desktop**. Aucun
débordement horizontal global. Aucune fonction essentielle inaccessible sur
mobile. Android, iOS, Windows, Mac, PWA, navigateur.

> Le personnel ne doit jamais avoir à connaître la technique sous-jacente.

## 24 · Outillage autonome

Gardes **uniquement pour des propriétés réelles**. Hooks : empêcher qu'une
régression connue revienne. Loops : faire converger chaque workflow. Subagents
pour audit, cartographie, dépendances, contrôles en lecture, recherche de
régression. **Ne pas multiplier les validations humaines.**

---

## Ordre imposé

> Ne pas tout commencer simultanément. Repartir du chemin critique existant.

```
1.  terminer les critères encore ouverts de sécurité / Auth
2.  prouver une inscription test complète
3.  débloquer les workflows dépendants
4.  traiter les fractures par dépendance
5.  intégrer progressivement les fonctionnalités ci-dessus
```

## Ce pour quoi solliciter le promoteur

Et rien d'autre. Tout le reste est réversible et se traite seul.

1. décision métier réellement manquante ;
2. destruction ou irréversibilité ;
3. secret ou accès manquant ;
4. SQL qu'il doit exécuter ;
5. risque critique inattendu.

Format imposé pour le SQL — **pas de long rapport avant son intervention** :

```
ÉTAPE
SQL EXACT
ATTENDU
ARRÊT SI DIFFÉRENT
```
