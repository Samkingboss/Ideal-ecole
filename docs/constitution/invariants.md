# Invariants IDEAL

Le pont entre la constitution et la machine. Chaque invariant porte un identifiant,
sa source dans le V2.1 ou dans une décision, et la garde qui le vérifie.

**Un invariant sans garde est un vœu.** La colonne « vérifié par » est la seule qui
distingue une règle appliquée d'une règle affichée. Celles marquées *jugement* ne
s'automatisent pas : elles relèvent du skill `impact-metier`.

---

## Sécurité

| # | Invariant | Source | Vérifié par |
|---|---|---|---|
| `INV-SEC-01` | Aucune colonne secrète n'est lisible par `anon` | D5 / V2.1 §19 | `reseau.sh` L1, L2, L4 |
| `INV-SEC-02` | Aucune écriture directe du frontend sur une table protégée | V2.1 §19 | `statiques.sh` H2 |
| `INV-SEC-03` | Aucun secret dans le code ni dans une session persistée | D5 | `statiques.sh` H1, H3, H5, H6 |
| `INV-SEC-04` | `journal_audit` ne perd jamais de ligne | V2.1 §18 | `reseau.sh` L8 (plancher) |
| `INV-SEC-05` | Aucune RPC ne révèle un code d'accès | D5 | `reseau.sh` L10 |
| `INV-SEC-06` | Une correction sensible conserve ancienne valeur, nouvelle, auteur, motif | V2.1 §18 | *jugement* |

## Cantine — sécurité des enfants

| # | Invariant | Source | Vérifié par |
|---|---|---|---|
| `INV-CANT-01` | Une fiche alimentaire non validée ne s'affiche jamais « Aucune », « None », « RAS » ou équivalent | **D1** | `invariants.sh` + test workflow |
| `INV-CANT-02` | Un état validé exige `validated_by` et `validated_at` non nuls | **D1** | contrainte `CHECK` + `invariants.sh` |
| `INV-CANT-03` | La déclaration libre du parent n'est jamais traitée comme une validation | **D1** | `invariants.sh` |
| `INV-CANT-04` | `eleves.cantine` est à trois états : `NULL` inconnu, `TRUE` inscrit, `FALSE` non inscrit. L'inconnu n'est jamais une inscription confirmée | **D4-T4** | `invariants.sh` |
| `INV-CANT-05` | La création d'un menu compare les ingrédients aux restrictions et alerte avant validation | **V2.1 §14** | *à construire — phase 6* |
| `INV-CANT-06` | Les présences officielles alimentent l'effectif du jour | **V2.1 §14, §7** | *à construire — phase 6* |

## Identité de l'élève

| # | Invariant | Source | Vérifié par |
|---|---|---|---|
| `INV-ELEVE-01` | Aucune fusion automatique de deux élèves. Le système signale, l'humain tranche | **D3** | `invariants.sh` |
| `INV-ELEVE-02` | L'identité technique est l'UUID. Le matricule est un identifiant métier | **D3** / V2.1 §4 | `invariants.sh` |
| `INV-ELEVE-03` | Le parcours annuel est une historisation interne, jamais une réinscription imposée au parent | **V2.1 §4** | *jugement* |

## Signature et validation

| # | Invariant | Source | Vérifié par |
|---|---|---|---|
| `INV-SIG-01` | Une signature enregistre l'autorité **et** le signataire réel, séparément | **D2** | `invariants.sh` |
| `INV-SIG-02` | Aucun identifiant fourni par le client ne vaut preuve d'identité | **D2** | `invariants.sh` |
| `INV-SIG-03` | La signature reste désactivée jusqu'à l'authentification serveur | **D2 option B** | `invariants.sh` |

## Interface et non-régression

| # | Invariant | Source | Vérifié par |
|---|---|---|---|
| `INV-UI-01` | Tout écran de `src/pages` est monté, ou déclaré dans `orphelins-assumes` | **V2.1 §21** | `ecrans.sh` |
| `INV-UI-02` | Une erreur ne se rend jamais comme un vide. Chargement, erreur et vide sont trois états | audit §10 | `cliquets.sh` (plafond décroissant) |
| `INV-UI-03` | Aucune donnée de démonstration n'est utilisée comme état initial d'un écran de production | régression constatée | `invariants.sh` |

## Circulation des données — la règle d'or

| # | Invariant | Source | Vérifié par |
|---|---|---|---|
| `INV-FLUX-01` | Une donnée fondamentale est saisie une fois, à sa source | **R1, R2** | *jugement* |
| `INV-FLUX-02` | Aucune donnée métier nouvelle dans `app_state` | **R1** | `invariants.sh` |
| `INV-FLUX-03` | Une donnée saisie atteint tous ses consommateurs légitimes | **règle d'or** | *jugement* — `domaines.md` |
| `INV-FLUX-04` | Aucun numéro personnel pour communiquer avec les familles | **V2.1 §8** | `invariants.sh` |
| `INV-FLUX-05` | Toute communication parentale est traçable | **V2.1 §8** | *à construire — phase 6* |

## Continuité

| # | Invariant | Source | Vérifié par |
|---|---|---|---|
| `INV-CONT-01` | Aucune table, fonction ou composant supprimé sans analyse de dépendances | **V2.1 §21** | *jugement* + `ecrans.sh` |
| `INV-CONT-02` | Aucune règle métier inventée là où le V2.1 ou `decisions.md` se taisent | **R13** | *jugement* |
| `INV-CONT-03` | Les données de recette sont préservées jusqu'aux tests de non-régression | **règle QA** | `reseau.sh` L7 |
| `INV-QA-01` | Le système se comporte correctement **avec** les données de test présentes | **règle QA** | `reseau.sh` |

---

## Comment ajouter un invariant

1. Il doit venir d'une source de rang 1 ou 2, citée. Pas d'une préférence.
2. Il doit être **falsifiable** : on doit pouvoir dire ce qui le violerait.
3. Il reçoit soit une garde, soit la mention *jugement* — jamais rien.
4. Si la source n'existe pas encore, il va dans `decisions.md` comme question
   ouverte. **R13 interdit de l'écrire ici comme s'il était validé.**
