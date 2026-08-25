# La complétude d'un dossier est contextuelle

## La règle

**Une pièce manquante ne bloque jamais l'inscription ni l'encaissement.**
Elle se dit, se compte et se rattrape.

Et un enfant de petite section qui n'a jamais été scolarisé ne doit pas être
marqué INCOMPLET faute d'un bulletin de l'année précédente qui n'existe pas.

## Ce que les données permettent d'établir

| Contexte | Signal | Fiable ? |
|---|---|---|
| **Réinscription** | `type_inscription = 'reinscription'` | **Oui.** Posé par le parcours, jamais saisi à la main. L'école détient déjà la scolarité antérieure. |
| **Vient d'un autre établissement** | `ancienne_ecole` renseignée et ≠ IDEAL | **Oui.** Une valeur présente et explicite. |
| **Première scolarisation** | `ancienne_ecole` vide | **Non.** Le champ est libre et facultatif — l'étiquette du formulaire dit « Ancienne école (si applicable) ». Un vide peut signifier « jamais scolarisé » comme « personne ne l'a rempli ». |

## Ce qui en découle

| Contexte | Acte + vaccination | Bulletin + transfert |
|---|---|---|
| Réinscription | exigés | **sans objet** — l'école les a déjà |
| Vient d'ailleurs | exigés | **exigés** |
| Indéterminé | exigés | **à confirmer** — ni comptés manquants, ni tenus pour acquis |

Le troisième cas n'est pas deviné. Il est affiché tel quel :

> La scolarisation antérieure n'est pas renseignée sur ce dossier. Ces pièces
> ne sont **pas comptées comme manquantes** — mais si l'enfant vient d'un autre
> établissement, elles sont à réclamer.

C'est le choix le plus sûr dans les deux sens : aucun enfant de maternelle
n'est marqué incomplet à tort, et aucun transfert ne passe en silence pour un
dossier acquis.

## La donnée métier qui lèverait l'ambiguïté

Une seule question, posée une fois au dépôt du dossier, et **obligatoire** :

> **Situation scolaire de l'enfant**
> ○ Première scolarisation
> ○ Vient d'un autre établissement
> ○ Déjà élève à IDEAL

Trois valeurs, un champ, plus aucun « indéterminé ». Tant qu'elle n'existe
pas, le troisième état reste — et se voit.

## Tests

Les six scénarios A à F sont tenus par la garde `P2`, et la règle de la
première scolarisation par `P3`. Chaque garde est auto-testée en réintroduisant
son défaut.

| Cas | Contexte | Résultat |
|---|---|---|
| A · maternelle, acte + vaccination | indéterminé | **COMPLET** |
| B · acte manquant | indéterminé | INCOMPLET · 1 |
| C · d'ailleurs, bulletin manquant | venant d'ailleurs | INCOMPLET · 1 |
| D · d'ailleurs, transfert manquant | venant d'ailleurs | INCOMPLET · 1 |
| E · d'ailleurs, tout fourni | venant d'ailleurs | **COMPLET** |
| F · réinscription, acte + vaccination | réinscription | **COMPLET** |
