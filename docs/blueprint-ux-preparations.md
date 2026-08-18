# Blueprint UX/UI — Workflow des préparations

Blueprint validé par le promoteur le 18 août 2026.

## Règle de gouvernance

**Aucune nouvelle abstraction visuelle ou métier sans vérifier d'abord si
l'existant peut la fournir.**

Posée par le promoteur en validant ce blueprint. Elle est ce qui empêche le
chantier de recréer un deuxième système à côté du premier — ce qui s'est déjà
produit deux fois : `FichePreparation` imprimant hors du moteur documentaire,
et l'export JPEG réécrit dans `CuisiniereApp` au lieu d'être commun. Avant
d'écrire un composant, une couleur, une table ou une règle, chercher ce qui
l'assure déjà.

## Arbitrages du promoteur

**Sceaux du moteur documentaire** — les émojis sont remplacés par un sceau
typographique IDEAL. Plus robuste à l'impression, plus cohérent avec
l'identité.

**Libellé du retard, côté enseignant** — « Déposée après l'échéance ». Factuel,
sans transformer l'interface en dispositif disciplinaire. Côté direction,
« En retard » reste le terme de pilotage. Même donnée, deux adresses.

**Échéance par défaut** — 0 heure avant le cours : déposée avant le début du
cours = à temps. Paramétrable par établissement, mais la règle des dix heures
n'est pas réintroduite. Cela préserve les 17 historiques et la cohérence avec
`points.js`.

**Deux choix structurants confirmés** — l'emploi du temps comme point d'entrée
plutôt qu'une « nouvelle préparation » abstraite ; et « Utiliser cette fiche
pour le CE2 », qui crée une préparation liée sans ressaisie du contenu.

Référence fonctionnelle : `docs/blueprint-preparations.md` (validé le 18 août 2026).
Référence technique : `src/lib/preparations.js`, schéma posé par `55213c2`.
Référence visuelle : `src/App.css` (jetons IDEAL), `src/pages/DocumentPrintStudio.jsx`.

---

## 0. Ce que l'audit visuel a trouvé avant de concevoir

Cinq constats qui déterminent le blueprint. Ils ne sont pas des remarques de style.

**0.1 — `FichePreparation` imprime hors du moteur documentaire.** Elle ouvre sa
propre fenêtre et écrit son propre HTML (ligne ~600). C'est exactement le
« second système pour un problème déjà résolu » que la directive interdit. La
fiche imprimée n'a donc ni logo, ni en-tête IDEAL, ni pied de page, ni sceau.
Elle sort en texte brut. **À rebrancher sur `DocumentPrintStudio`.**

**0.2 — Le moteur documentaire affiche « PROVENANCE : undefined ».** La barre de
contrôle lit `theme.name`, mais aucun thème de `DEPARTMENT_THEMES` ne possède
cette clé — elles ont `key`, `serviceTitle`, `pillText`. Le bandeau supérieur
affiche donc littéralement `undefined` à l'écran aujourd'hui, sur tous les
documents. Défaut réel, à corriger dans le même chantier.

**0.3 — Le moteur ne pagine pas.** Aucun `page-break`, aucun « page X sur Y ».
Une fiche de deux séquences sera coupée au milieu d'une rubrique par le
navigateur, à un endroit imprévisible. Le §2 de la directive exige une
pagination et « aucun élément coupé ». C'est aujourd'hui impossible.

**0.4 — Le JPEG haute qualité existe déjà, mais ailleurs.** `CuisiniereApp`
produit le menu hebdomadaire avec `html2canvas` à `scale: 3` et
`toDataURL('image/jpeg', 0.98)`. C'est le niveau de qualité que vous avez
désigné comme référence. Il ne faut pas le réécrire : il faut le **remonter
dans le moteur** pour que tous les documents en bénéficient.

**0.5 — `CorrectionDirecteur` contredit l'arbitrage du 18 août.** Il note
chaque critère librement de 0 à 20 (`notes: { structure: 0, … }`), affiche un
badge « Excellent / Très bien », et écrit `status: 'valide'` — un sixième
vocabulaire, absent de la nomenclature validée où le code est `validee`. Votre
arbitrage n° 2 disait : appréciation par critère, dont la note découle, pas de
note libre. L'écran est à refaire sur `CRITERES` et `APPRECIATIONS`.

---

## 1. Parcours enseignant

### Le point de départ n'est pas « créer une préparation »

Un enseignant ne pense jamais « je vais créer un enregistrement de
préparation ». Il pense « demain à 8h30 j'ai Maths au CE1 ». Le point d'entrée
du workflow est donc **l'emploi du temps**, jamais un bouton « Nouvelle
préparation » flottant dans un menu.

### Écran T1 — Mes préparations

**Compris en moins de 5 secondes : ce que je dois encore déposer, et pour quand.**

En haut, une seule phrase, en gros, qui répond à la question avant même de
lire : *« 3 préparations à déposer avant demain 8h00. »* Si tout est fait :
*« Tout est déposé. Prochaine échéance lundi 8h00. »*

En dessous, la semaine en bandeau : six colonnes (lundi à samedi), chaque
créneau une tuile. La tuile porte la matière, l'heure et une pastille de
statut. Le jour courant est marqué. Les jours passés sont estompés mais
restent lisibles — un retard ne se cache pas.

La couleur suffit à lire la semaine sans déchiffrer un texte :

| Statut | Couleur | Jeton |
|---|---|---|
| Brouillon | gris | `--muted` |
| Déposée | bleu | `--accent` |
| En retard | ambre | `--amber` |
| À corriger | rouge | `--red` |
| Validée | vert | `--green` |
| Rien encore | contour pointillé | `--border` |

La pastille ne fait jamais foi seule : chaque tuile porte aussi l'icône
(`✎ 📤 ⏰ ↩ ✓`) déjà définie dans `STATUTS`. Un daltonien lit l'icône.

L'action évidente : toucher une tuile ouvre la fiche. Rien d'autre n'est
cliquable dans cette zone.

### Écran T2 — La fiche

**Compris en moins de 5 secondes : quelle leçon, pour quelle classe, à quelle
heure, et ce qu'il me reste à remplir.**

**En-tête collant**, toujours visible pendant la saisie :

```
Mathématiques  ·  CE1–CE2  ·  jeudi 20 août  ·  séquence 3, 9h00
À déposer avant jeudi 9h00 — il reste 14 h                    ● Brouillon
```

Le compte à rebours est la seule information temporelle affichée. Pas de date
d'échéance ISO, pas d'horodatage technique. « Il reste 14 h » se comprend sans
calcul ; « échéance : 2026-08-20T09:00:00Z » ne se comprend pas du tout.
Sous deux heures, le texte passe en `--amber` ; après l'échéance, en `--red`
avec « en retard de 35 min » — constaté, jamais reproché.

**Le manuel et la leçon.** Le sélecteur multi-manuels existant est conservé.
Le bloc « CETTE LEÇON DOIT COUVRIR », qui affiche les domaines de la leçon
choisie, est conservé : c'est lui qui empêche l'enseignant d'oublier
l'orthographe dans une leçon de français du Flamboyant.

**La progression du manuel, en visuel** (règle 5). Une barre fine sous le
sélecteur : `██████████░░░░░░░░░░  leçon 18 sur 30 · Le Flamboyant CE2`. Un
enseignant voit d'un coup où il en est dans l'année. Un tableau de nombres ne
donnerait jamais cette lecture immédiate.

**Les rubriques.** Six rubriques, dont deux obligatoires (`objectif`,
`evaluation`). Les obligatoires sont ouvertes d'emblée ; les quatre autres
sont repliées, avec une coche si elles sont remplies. On ne fait pas défiler
un formulaire de six champs vides sur un téléphone.

Chaque rubrique garde son texte d'aide existant, en gris sous le libellé, pas
dans une infobulle : sur mobile, une infobulle ne s'ouvre pas.

**Le déroulement, en barre de temps** (règle 5). Les quatre étapes ne sont pas
une liste, ce sont des durées. Une barre horizontale proportionnelle :

```
┌────┬──────────┬──────────┬────┐
│ 5' │   10'    │   10'    │ 5' │
│Mise│Découverte│ Pratique │Clô-│
└────┴──────────┴──────────┴────┘
        30 minutes — séquence 3
```

Si la fiche couvre deux séquences, la barre affiche 60 minutes et les blocs
s'allongent. L'enseignant voit immédiatement si son déroulement tient dans le
temps imparti. Sur mobile, la barre bascule à la verticale.

**Les pièces jointes.** Zone de dépôt sous le déroulement (voir § 5).

**Barre d'action collante en bas**, toujours atteignable au pouce :

```
◐ 4 rubriques sur 6            [ Enregistrer ]  [ Déposer la préparation ]
```

L'anneau de complétion se remplit à mesure. « Déposer » reste désactivé tant
que les deux rubriques obligatoires et la leçon ne sont pas renseignées — avec
le motif écrit sous le bouton, jamais un bouton mort sans explication :
*« Renseignez l'objectif et l'évaluation pour pouvoir déposer. »*

### Éviter la double saisie

Trois mécanismes, dont un qui compte vraiment ici.

**Le brouillon s'enregistre seul**, sans clic, deux secondes après la dernière
frappe. Un enseignant dont le téléphone s'éteint ne perd rien. Un discret
« Enregistré à 19h42 » remplace l'anneau une seconde.

**Dupliquer vers la classe jumelée.** C'est le gain réel : CE1 et CE2 sont
jumelées, CM1 et CM2 aussi, et les manuels sont communs. Après dépôt, un bouton
*« Utiliser cette fiche pour le CE2 »* recopie tout et n'ouvre que ce qui
diffère. Sans lui, l'enseignant ressaisit deux fois la même leçon.

**Reprendre la séance précédente.** Sur une leçon en plusieurs séquences, le
matériel et les prérequis sont presque toujours identiques : ils sont
pré-remplis depuis la séquence précédente, modifiables.

### Écran T3 — Après le dépôt

Pas une notification qui disparaît en trois secondes. Un panneau de
confirmation :

> **✓ Préparation déposée**
> Le 18 août à 19h42, dans les temps.
> La direction la contrôlera avant le cours. Vous serez prévenu du résultat.
>
> [ Voir la fiche imprimable ]  [ Utiliser pour le CE2 ]  [ Retour à ma semaine ]

L'utilisateur sait ce qui vient de se passer, ce qui va se passer, et ce qu'il
peut faire ensuite. C'est le minimum d'un produit fini.

---

## 2. Parcours direction

### Écran D1 — Contrôle des préparations

**Compris en moins de 5 secondes : combien en attendent mon contrôle, et
est-ce que quelqu'un est en retard.**

En haut, deux nombres et rien d'autre :

```
   7                    2
à contrôler        en retard
```

En dessous, une file d'attente, pas un tableau. Les tableaux se lisent
colonne par colonne ; une file se parcourt. Tri par date de cours croissante :
ce qui est enseigné demain matin passe avant ce qui est enseigné vendredi.

Chaque carte :

```
┌──────────────────────────────────────────────────┐
│ ⏰ Mme AKUM · CE1–CE2 · Mathématiques            │
│ Leçon 18 — Les nombres jusqu'à 100               │
│ Cours jeudi 9h00 · déposée avec 35 min de retard │
│                                    [ Contrôler ] │
└──────────────────────────────────────────────────┘
```

Filtres : **À contrôler** (défaut) · Validées · À corriger · Toutes. Le filtre
par défaut n'est pas « toutes » : la direction ouvre cet écran pour traiter une
file, pas pour consulter des archives.

### Écran D2 — Le contrôle

**Compris en moins de 5 secondes : ce que l'enseignant a préparé, et où je
clique pour juger.**

Deux colonnes sur ordinateur : la fiche à gauche en lecture, le contrôle à
droite. Sur mobile, la fiche puis le contrôle, avec un bouton flottant
« Contrôler » qui descend directement au panneau.

Le panneau de contrôle, cinq lignes, trois choix par ligne :

```
Structure et organisation      [Conforme] [À renforcer] [Insuffisant]
Clarté des objectifs           [Conforme] [À renforcer] [Insuffisant]
Qualité du contenu             [Conforme] [À renforcer] [Insuffisant]
Méthodes et activités          [Conforme] [À renforcer] [Insuffisant]
Évaluation prévue              [Conforme] [À renforcer] [Insuffisant]
──────────────────────────────────────────────────────────
                        16 / 20
        4 critères conformes, 1 à renforcer
```

La note **apparaît toute seule** et s'explique en une ligne. Elle n'est jamais
saisie. Tant que les cinq critères ne sont pas renseignés, la zone affiche
« Renseignez les cinq critères » plutôt qu'une note partielle qui induirait en
erreur — c'est déjà le comportement de `noteDeduite`.

Deux actions, visuellement distinctes :

- **Valider** — vert, plein.
- **Demander une correction** — ambre, contour. **Le commentaire devient
  obligatoire.** Une demande de correction sans motif est inexploitable pour
  l'enseignant, et humiliante plutôt qu'utile. Le bouton reste inactif tant que
  le champ est vide, avec le motif affiché.

Un champ commentaire libre, facultatif pour une validation. Placeholder :
*« Un mot pour l'enseignant — ce qui est réussi, ce qui peut progresser. »*

---

## 3. États de chaque écran

| Écran | Chargement | Vide | Erreur | Succès |
|---|---|---|---|---|
| T1 semaine | Squelette de 6 colonnes grisées | « Aucun cours programmé cette semaine. » + lien vers l'emploi du temps | « La semaine n'a pas pu être chargée. » + [Réessayer] | — |
| T2 fiche | Squelette du formulaire | Fiche neuve pré-remplie du créneau | Bandeau non bloquant, brouillon conservé en local | « Enregistré à 19h42 » |
| T3 confirmation | — | — | — | Panneau de confirmation persistant |
| D1 file | 3 cartes squelettes | « Aucune préparation n'attend votre contrôle. » avec une coche verte | [Réessayer] | — |
| D2 contrôle | Squelette deux colonnes | — | Le contrôle saisi n'est pas perdu | Retour à la file, carte traitée qui s'efface en fondu |

**Les squelettes reprennent la forme finale**, pas un rond qui tourne. Un
squelette annonce ce qui arrive ; un spinner annonce seulement qu'on attend.

**Les états vides ne sont jamais des impasses.** « Aucune préparation à
contrôler » avec une coche verte est une bonne nouvelle, pas une erreur — le
ton et la couleur doivent le dire.

**Les erreurs disent quoi faire.** Jamais « Erreur 400 », jamais
« PGRST204 », jamais le texte d'une exception. *« La préparation n'a pas pu
être déposée. Votre travail est conservé. Réessayez dans un instant. »* Le
détail technique part dans la console, pas à l'écran.

---

## 4. Notifications

Le principe anti-inondation que vous avez validé, appliqué : **un événement,
une notification**, et les nouvelles non urgentes sont regroupées.

| Quand | Qui | Message | Regroupement |
|---|---|---|---|
| 24 h avant l'échéance, si rien n'est déposé | Enseignant | « Préparation attendue demain 9h00 — Mathématiques CE1 » | Une par créneau, une seule fois |
| 2 h après l'échéance, si rien n'est déposé | Enseignant | « La préparation de Mathématiques CE1 n'a pas été déposée. » | Une seule, jamais répétée |
| 2 h après l'échéance | Direction | « 3 préparations manquantes ce matin » | **Un seul message groupé**, pas un par préparation |
| Correction demandée | Enseignant | « La direction demande une reprise de votre préparation de Mathématiques CE1. » | Immédiate — c'est une action attendue |
| Validation | Enseignant | « 4 préparations validées cette semaine » | **Groupée**, une fois par jour. Une bonne nouvelle n'a pas à interrompre. |
| Réouverture après validation | Enseignant | « Votre préparation validée du 18 août a été rouverte. » | Immédiate, avec le motif |

Aucune notification ne part vers les familles dans ce workflow (§ 12).

Le transport est `pushNotification` de `src/lib/notifications.js`, déjà en
place, qui adresse « directeur » et ajoute automatiquement le responsable
administratif. Rien de nouveau à créer.

---

## 5. Pièces jointes

La fiche est le système de référence ; le fichier n'est plus une voie
parallèle, c'est un complément. L'interface doit dire exactement cela.

Zone de dépôt sous le déroulement, jamais en haut : l'enseignant remplit
d'abord, joint ensuite.

```
┌─ Documents joints (facultatif) ──────────────────┐
│  📎  Ajouter une photo ou un fichier             │
│      Exercice, support, page du manuel…          │
└──────────────────────────────────────────────────┘
```

Une fois des fichiers ajoutés : vignettes carrées de 72 px, réordonnables par
glisser-déposer, croix de suppression au survol, nom tronqué au milieu
(`exercice-nomb…-100.jpg`) pour garder l'extension lisible.

Pendant l'envoi, chaque vignette porte sa propre barre de progression. Si l'une
échoue, **elle seule** est marquée en rouge avec [Réessayer] : les autres sont
conservées. Un échec sur la quatrième image ne doit jamais annuler les trois
premières.

Contrainte affichée avant l'erreur, pas après : *« Images et PDF, 5 Mo
maximum. »* Un fichier trop lourd est refusé à la sélection, avec son poids
réel indiqué.

`url_doc` reçoit la première pièce jointe pour que tout l'existant continue de
fonctionner. `pieces_jointes` porte la liste complète.

---

## 6. Contrôle qualité

Traité à l'écran D2 (§ 2). Trois principes de conception :

**Factuel, pas arbitraire.** Trois appréciations nommées, jamais un curseur de
0 à 20. Un curseur invite à noter à l'humeur ; trois cases nomment ce qu'on
juge.

**Explicable.** La note se déduit et son calcul reste affiché. Un enseignant qui
reçoit 16/20 voit lequel de ses cinq critères était à renforcer. C'était
l'objet de votre arbitrage n° 2.

**Sans conséquence financière.** Aucune prime, pénalité ni total de points n'est
affiché sur cet écran ni calculé depuis ces appréciations. Le barème reste
expérimental et non validé.

---

## 7. Validation

Un clic sur **Valider**, un seul, sans boîte de confirmation : l'action est
réversible par la réouverture, une confirmation serait un frottement inutile.

Effets, dans cet ordre : `status → validee`, `appreciations` enregistrées,
`note_directeur` = note déduite, entrée `validation` dans `historique_statuts`,
notification groupée à l'enseignant, journalisation par `src/lib/audit.js`.

Retour immédiat : la carte quitte la file en fondu, le compteur « à contrôler »
décrémente. La direction voit son travail avancer.

---

## 8. Demande de correction

`status → a_corriger`, commentaire obligatoire, notification immédiate.

Côté enseignant, la préparation revient en tête de sa semaine, en rouge, avec
le commentaire de la direction **affiché en haut de la fiche**, dans un encadré
— pas caché derrière un onglet « historique ». Il doit lire ce qu'on lui
demande avant de rouvrir son texte.

Quand il redépose, le statut repart à `deposee` ou `en_retard` selon
l'échéance, et l'historique conserve le cycle complet. **La préparation
continue de compter dans l'avancement du manuel** pendant qu'elle est à
corriger — votre arbitrage n° 4.

---

## 9. Modification après validation

Exceptionnelle, donc délibérément freinée. La transition `validee → a_corriger`
est la seule autorisée depuis `validee`, et elle exige un motif écrit.

Une préparation validée s'ouvre en lecture seule, avec un bandeau vert
« Validée le 18 août par la direction — 16/20 ». Le bouton est secondaire,
discret, et libellé sans ambiguïté : **« Rouvrir pour modification »**. Une
boîte demande le motif, obligatoire.

Effets : `verrouillee_le` horodaté, entrée `reouverture` dans l'historique,
notification à l'enseignant. La note et les appréciations précédentes sont
**conservées** dans l'historique, pas écrasées — c'est le sens de votre
arbitrage sur la trace.

---

## 10. Historique

Une frise verticale en bas de chaque fiche, repliée par défaut, dépliée d'un
clic sur « Historique (5 événements) ».

`raconter()` produit déjà les phrases. Le rendu :

```
│ ✓  Mme la Directrice a validé la préparation
│    18 août, 21:14 · 16/20
│
│ 📤 Mme AKUM a déposé la préparation
│    18 août, 19:42
│
│ ↩  Mme la Directrice a demandé une correction
│    17 août, 16:30
│    « L'évaluation prévue ne permet pas de vérifier l'objectif. »
```

Des phrases, jamais un tableau `statut | date | user_id`. Aucun identifiant
technique n'apparaît : `par_nom` est stocké au moment de l'événement pour que
le nom reste lisible même si le compte est supprimé plus tard.

Le journal d'audit global reste hors périmètre, comme vous l'avez demandé.

---

## 11. Documents générés

### Le document : FICHE DE PRÉPARATION

Produit par `DocumentPrintStudio`, provenance `pedagogie`. Destinataires :
l'enseignant (son classeur), la direction (l'archive pédagogique), un
inspecteur le cas échéant.

Composition A4 portrait :

```
┌────────────────────────────────────────────────┐
│ [LOGO]  ÉCOLE INTERNATIONALE BILINGUE IDEAL    │
│         FICHE DE PRÉPARATION                   │
├────────────────────────────────────────────────┤
│      ⬤ SERVICE PÉDAGOGIQUE & ENSEIGNEMENT      │
│                                                │
│ ENSEIGNANT   CLASSE    MATIÈRE      DATE       │
│ C. AKUM      CE1–CE2   Mathématiques  20/08/26 │
│ SÉQUENCE     HORAIRE   MANUEL                  │
│ 3            9h00      Singapour, leçon 18     │
├────────────────────────────────────────────────┤
│ OBJECTIF DE LA NOTION                          │
│ …                                              │
│ DÉROULEMENT                                    │
│  5'  Mise en route      …                      │
│ 10'  Découverte         …                      │
│ 10'  Pratique guidée    …                      │
│  5'  Clôture            …                      │
│ PRÉREQUIS · MATÉRIEL · DIFFÉRENCIATION         │
│ COMMENT JE VÉRIFIE QUE C'EST ACQUIS            │
│ TRACE ÉCRITE ET DEVOIR                         │
├────────────────────────────────────────────────┤
│ VALIDATION DE LA DIRECTION      (si validée)   │
│ Structure ✓ conforme   Objectifs ✓ conforme    │
│ Contenu ✓ conforme     Méthodes ○ à renforcer  │
│ Évaluation ✓ conforme          16/20           │
│ Validée le 18 août 2026 par la Direction       │
├────────────────────────────────────────────────┤
│ ⬤ SUIVI PÉDAGOGIQUE     Page 1 sur 2 · 18/08/26│
└────────────────────────────────────────────────┘
```

Une préparation non validée ne porte **aucun** bloc de validation — pas un
cadre vide « en attente », qui donnerait à un document officiel l'air
inachevé.

### Ce que le moteur doit gagner

Cinq manques identifiés au § 0, tous à combler dans ce chantier :

1. **Corriger `theme.name`** → `theme.serviceTitle`. Le bandeau affiche
   `undefined` aujourd'hui.
2. **Pagination réelle** : `@page` en A4, `page-break-inside: avoid` sur chaque
   rubrique et chaque ligne de déroulement, pied de page « Page X sur Y ».
   Aucune rubrique ne doit être coupée entre deux feuilles.
3. **Export JPEG** remonté depuis `CuisiniereApp` : `html2canvas` `scale: 3`,
   `toDataURL('image/jpeg', 0.98)`. Une fonction du moteur, disponible pour
   tous les documents, pas une copie de plus.
4. **Métriques A4** : la largeur fixe de 820 px devient 794 px (A4 à 96 dpi) et
   les marges suivent le `@page margin: 12mm`. Aujourd'hui l'écran et le papier
   ne cadrent pas de la même façon.
5. **Provenances manquantes.** Cinq thèmes existent ; votre liste en compte dix.
   `vie-scolaire`, `rh`, `communication-familles`, `certificats` et `rapports`
   sont à ajouter, `direction` → `administration`, `devoirs` et `bulletins`
   existant déjà sous d'autres noms.

**Une réserve à trancher.** Les sceaux du moteur sont des émojis (`🏅`, `👑`,
`👩‍🍳`). À l'écran ils passent ; à l'impression, ils dépendent de la police du
poste et sortent parfois en carré vide, parfois en couleur criarde. Sur un
document institutionnel, c'est le détail qui trahit l'amateurisme. Je
recommande de les remplacer par un sceau dessiné et le monogramme IDEAL.
**Décision métier requise** — c'est votre identité visuelle, pas la mienne.

---

## 12. Messages destinés aux familles

**Aucun message aux familles ne part de ce workflow, et c'est délibéré.**

Une préparation est un document professionnel interne : l'enseignant prépare,
la direction contrôle. Une famille n'a rien à faire du déroulement minute par
minute ni de l'appréciation portée sur le travail d'un enseignant. Lui envoyer
une fiche de préparation serait une faute de destinataire, et exposerait
l'évaluation professionnelle d'une employée à des tiers.

Ce qui intéresse une famille, c'est **ce qui a été enseigné à son enfant** —
et c'est un autre objet, produit après le cours, pas avant. C'est le « rapport
aux parents » de votre vision du module pédagogique.

**Point de raccordement à prévoir, sans le construire maintenant.** La
préparation validée porte déjà les données nécessaires : la leçon, le manuel,
l'objectif, la trace écrite et le devoir. Le futur rapport parents s'alimentera
là, en n'en retenant que la partie qui les concerne, reformulée à leur
intention — jamais le document brut. La frontière est nette et doit le rester.

---

## 13. Responsive mobile

**Mobile d'abord pour l'enseignant.** Une préparation se saisit le soir, au
téléphone. Le poste de travail est l'exception, pas la règle.

| Zone | 375 px | ≥ 1024 px |
|---|---|---|
| Semaine T1 | Liste verticale par jour, jour courant en tête | Grille 6 colonnes |
| En-tête fiche | Deux lignes, collant, hauteur réduite au défilement | Une ligne |
| Rubriques | Pleine largeur, repliables | Deux colonnes |
| Déroulement | Barre verticale | Barre horizontale |
| Pièces jointes | Grille de 3 vignettes | Grille de 6 |
| Barre d'action | Collante en bas, `env(safe-area-inset-bottom)` | Sous le formulaire |
| Contrôle D2 | Fiche puis panneau, bouton flottant | Deux colonnes côte à côte |
| Document A4 | Aperçu à faire défiler horizontalement | Pleine page |

Deux règles héritées de corrections déjà faites dans `App.css` et à ne pas
répéter : `min-width: 0` sur toute colonne flexible — un titre long suffit
sinon à faire déborder la page entière — et zones tactiles de 44 px minimum.

Les trois boutons d'appréciation tiennent sur une ligne à 375 px : libellés
courts (`Conforme` / `À renforcer` / `Insuffisant`) et non des phrases.

---

## 14. Chargement, succès, erreur, vide

Résumé au § 3, principes ici.

**Chargement.** Squelettes à la forme du contenu final. Au-delà de 400 ms
seulement — en deçà, l'apparition d'un squelette produit un clignotement plus
désagréable que l'attente.

**Succès.** Toujours dire *quoi*, pas *que*. « Préparation déposée à 19h42,
dans les temps » et non « Enregistré ✓ ». Un succès qui ne dit rien oblige à
vérifier, donc n'est pas un succès.

**Erreur.** Trois obligations : dire ce qui a échoué, rassurer sur ce qui est
conservé, proposer l'étape suivante. Aucun code technique visible.

**Vide.** L'état vide est le premier écran d'un nouvel enseignant. Il doit
donner envie de commencer, pas signaler une absence.

---

## 15. Intégration au Design System IDEAL

Rien de nouveau n'est inventé. Tout vient de `src/App.css`.

**Couleurs.** `--accent` #1AAFE0 · `--green` #8DC63F · `--amber` #F7941D ·
`--dark` #0d2a3b · `--bg` #f0f7fa · `--border` #d0e8f0 · `--red` #c53030 ·
`--muted` #4b5563. Les couleurs de statut de `src/lib/preparations.js`
référencent déjà ces variables : aucune valeur en dur nulle part.

**Formes.** `--radius` 16 px pour les cartes, 10 px pour les boutons, 20 px
pour les pastilles. Ombres portées légères, jamais de bordure épaisse à
l'écran — le double filet du moteur documentaire appartient au papier.

**Typographie.** `Segoe UI`, system-ui. Une seule échelle :

| Rôle | Taille | Graisse |
|---|---|---|
| Titre d'écran | 22 px | 900 |
| Titre de carte | 16 px | 800 |
| Corps | 14 px | 400 |
| Métadonnée | 12 px | 600 |
| Étiquette | 10–11 px | 700, majuscules, interlettrage .04em |

**Espacements.** Multiples de 4 : 4, 8, 12, 16, 24, 32. Aucune valeur
intermédiaire.

**Micro-interactions.** Transitions de 150 ms sur les états de survol et de
sélection, 250 ms sur les apparitions. Une carte traitée quitte la file en
fondu de 300 ms — assez pour être vue, trop court pour faire attendre. Aucune
animation décorative : chaque mouvement dit qu'un état a changé.

**Accessibilité.** Le statut n'est jamais porté par la seule couleur. Contraste
minimum 4.5:1 — les valeurs de `App.css` ont déjà été relevées pour cela
(`--muted` et `--red` portent le commentaire en attestant).

---

## Ce qui reste à trancher

**DÉCISION MÉTIER REQUISE — les sceaux émoji.** Remplacer `🏅` et `👑` par un
sceau dessiné et le monogramme IDEAL, ou les conserver ? (§ 11)

**DÉCISION MÉTIER REQUISE — le ton envers l'enseignant.** « En retard » est
factuel mais sec. Faut-il un libellé plus neutre sur l'écran de l'enseignant
(« Déposée après l'échéance ») tout en gardant « En retard » sur le tableau de
bord de la direction ? La donnée serait la même, l'adresse différente.

**DÉCISION MÉTIER REQUISE — l'échéance par défaut.** `heures_avant_cours` vaut 0
aujourd'hui : la préparation est attendue avant le début du cours. Est-ce la
règle que vous voulez afficher aux enseignants, ou faut-il l'avancer ?

---

## Ordre de réalisation proposé

Une fois ce blueprint validé, dans cet ordre, chaque étape testée avant la
suivante :

1. Le moteur documentaire — pagination, JPEG, métriques A4, `theme.name`,
   provenances manquantes. Il conditionne tout le reste et sert aussi les
   autres services.
2. La migration des statuts des 17 préparations, après validation du mapping.
3. `FichePreparation` branchée sur `src/lib/preparations.js` et sur le moteur.
4. `CorrectionDirecteur` refait sur les appréciations, puis rebranché.
5. La carte cassée de `DirecteurApp`, l'écran T1, les notifications.

Aucune ligne n'est écrite avant votre accord.
