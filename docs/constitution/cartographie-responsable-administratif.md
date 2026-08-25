# Cartographie — compte Responsable administratif

Établie avant toute modification, contre le code, la base et l'API réelle.
Comptes concernés : **Yacouba OUANGRAOUA** (`youangraoua`, actif) et Actus WANG
(`awang`, inactif).

## Le chemin réel

Le Responsable administratif **n'a pas d'application propre**. `App.jsx` le
route vers `DirecteurApp`, qui contient une branche dédiée de 608 lignes
(`if (user.role === 'responsable_administratif'`) offrant trois sessions :
**Élèves**, **RH & Paie**, **Comptabilité**.

La session Comptabilité ne contient **aucune fonction** : c'est un bouton qui
ouvre `/comptabilite.html`, une page statique de 7 700 lignes. **Tout le
travail financier de l'école se fait là.**

## Où vivent les données financières

Il n'existe **aucune table** `paiements`, `recus`, `frais`, `tarifs`,
`operations_financieres`, `encaissements` ni équivalent — vérifié : les treize
noms plausibles répondent 404.

Il n'existe **aucune colonne financière** sur `inscriptions` — 39 colonnes,
aucune ne porte de montant, de solde ni de règlement.

Toute la finance tient dans **une seule ligne** : `financement_params` où
`id = 'main'`, colonne `state_json`. Un unique document JSON contenant
`students`, `ecritures`, `charges`, `salaires`, `planComptable`,
`recouvrementConfig`.

État à la date de l'audit : `students: []`, `ecritures: []`. **Aucun paiement
n'a jamais été enregistré.**

## Classement des fonctions

### A — présentes et fonctionnelles

| Fonction | Où |
|---|---|
| Cartes scolaires | `CartesScolaires` |
| Certificats de scolarité | `CertificatScolarite` |
| Fiches d'effectifs | `FichesEffectifs` |
| Fiche alimentaire | `FicheAlimentaire` |
| Validation des inscriptions | `InscriptionsValidation` |
| Calcul d'allocation d'un paiement en cascade | `buildPaymentAllocation` |
| Réductions (bourse, fratrie, gratuité) avec comptes SYSCOHADA | `applyReductions` |
| Montant en toutes lettres sur le reçu | `numberToWords` |

### B — présentes mais cassées

| Fonction | Défaut | Preuve |
|---|---|---|
| Enregistrement d'un paiement | Aucun auteur : l'objet écrit est `{ amount, mode, motif, date, receiptId }`. **QUI a encaissé est sans réponse** | lecture de `submitPayment` |
| Date du paiement | Chaîne française `« 25/08/2026 à 14h30 »`, non triable, sans fuseau | idem |
| Numéro de reçu | `REC-AAAAMM-<index>-<4 derniers chiffres de Date.now()>`. L'index vient de `history.length + 1` : **supprimer un paiement fait réémettre un numéro déjà utilisé** | idem |
| Reçu | Ne nomme **pas l'encaisseur**. Les 18 champs du reçu ont été relevés : aucun `r-encaisseur` | relevé des `id="r-…"` |

### C — inaccessibles par un droit

Aucune à ce stade : `financement_params` est ouverte à tous (voir E).

### D — manquantes

| Manque | Conséquence |
|---|---|
| Lien entre un élève de la comptabilité et une `inscription` / un `eleve` | Le RA inscrit un enfant dans le portail, puis **doit le ressaisir à la main** dans la comptabilité (`addStudent` ne demande que nom, prénom, classe). Deux réalités, aucune jointure |
| Protection anti-doublon à l'encaissement | `submitPayment` n'a **aucun verrou** : deux clics = deux paiements |
| Contrôle de concurrence | `saveToSupabase` réécrit **tout l'état** sur la ligne unique `id='main'`. Deux personnes qui encaissent en même temps : la dernière écrase la première, et le paiement disparaît |
| Règle d'annulation / correction | À documenter avant d'inventer quoi que ce soit |

### E — accessibles alors qu'elles ne devraient pas l'être

| Surface | Mesure |
|---|---|
| `financement_params` en **lecture** par `anon` | `GET` → **200**. Salaires de tout le personnel, charges, plan comptable, lisibles avec la clé publique |
| `financement_params` en **écriture** par `anon` | `POST` → **201** |
| `financement_params` en **suppression** par `anon` | `DELETE` → **204**. Toute la comptabilité de l'école tient dans une ligne, supprimable par quiconque |
| Garde d'accès de `comptabilite.html` | `localStorage.getItem('ideal_user')` — **une valeur que l'utilisateur contrôle**. Et de toute façon inutile : les données sont lisibles directement par l'API |

### F — succès affiché sans preuve en base

| Écran | Ce qui se passe |
|---|---|
| `submitPayment` | Le paiement est ajouté **en mémoire**, le reçu s'imprime, WhatsApp est proposé — puis `autoSave()` programme l'écriture Supabase **2 secondes plus tard** (`setTimeout(…, 2000)`). Le RA a déjà le reçu en main avant que la base ait vu quoi que ce soit |
| `saveToSupabase` | Lit bien `{ error }` — mais l'envoie dans `console.error`. **Aucun écran, aucun message.** Un refus du serveur est invisible |

## Ce que cela signifie pour septembre

Le Responsable administratif peut aujourd'hui encaisser, imprimer un reçu
numéroté et l'envoyer au parent — **sans qu'aucune trace ne parvienne
nécessairement en base, sans que son nom figure nulle part, et sans qu'un
deuxième clic soit empêché.**

C'est le point de départ des boucles de correction.

---

## Concurrence — prouvée en conditions réelles

Deux sessions authentifiées indépendantes, deux requêtes HTTP lancées en
parallèle, même dossier.

| Avant | Après |
|---|---|
| 41 000 F · 2 opérations | **121 000 F · 4 opérations** |

**+80 000 F exactement.** Aucune opération perdue.

### La preuve de sérialisation est dans les réponses elles-mêmes

```
Réponse B : {"ok": true, "par": "Directeur IDEAL",     "paye":  91000, "operations": 3}
Réponse A : {"ok": true, "par": "Yacouba OUANGRAOUA",  "paye": 121000, "operations": 4}
```

B a écrit le premier : 41 000 + 50 000 = 91 000, trois opérations. A, parti en
même temps, rend **121 000 et quatre opérations** — il a donc lu l'état
POSTÉRIEUR à B. Le `for update` a fait attendre A, qui est reparti de ce que B
venait d'écrire au lieu de l'écraser.

C'est exactement le scénario qui perdait un paiement avant la correction.

| Critère | Résultat |
|---|---|
| Deux opérations persistées | ✓ 2 → 4 |
| Total ajouté | ✓ exactement 80 000 |
| Aucun écrasement | ✓ |
| Références distinctes | ✓ `COURSE-…-A`, `COURSE-…-B` |
| Auteurs distincts, résolus par le serveur | ✓ « Yacouba OUANGRAOUA », « Directeur IDEAL » |
| Horodatages distincts | ✓ 4/4, les deux derniers à 116 ms d'écart |
| Aucune dépendance au stockage local | ✓ deux clients HTTP, aucun navigateur |
| Aucune réécriture globale | ✓ le client n'envoie qu'un paiement |
| Total dérivé de l'historique | ✓ somme = 121 000 = champ `paye` |

### Trois pannes de mon outil de test, avant d'y arriver

Toutes de la même famille — une panne rendue muette — dans l'outil même qui
devait débusquer ce travers.

1. `curl -s` masquait les erreurs : deux réponses vides ont été prises pour un
   résultat, et le verdict a annoncé FAIL. Une réponse vide n'est plus un
   résultat : le script s'arrête en disant que c'est une panne.
2. Le `echo` suivant la saisie masquée écrivait sur `stdout`. Il était donc
   capturé dans la variable du jeton et se retrouvait **en tête de l'en-tête
   HTTP** — `curl: (43)`, code 000, la requête ne partait jamais. Reproduit
   puis vérifié : jeton précédé de `\n` → 43/000 ; nettoyé → 200.
3. Un abandon au premier code erroné, corrigé en trois essais par compte.
