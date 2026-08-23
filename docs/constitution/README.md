# Constitution métier IDEAL

Ce répertoire porte ce qui fait autorité sur le **métier**. Le code décrit ce qui
est ; ces fichiers disent ce qui doit être.

## Rangs d'autorité

| Rang | Fichier | Statut | Portée |
|---|---|---|---|
| **1** | `IDEAL_Cahier_des_charges_V2.1.pdf` | ✅ fourni le 23/08/2026 | Le cahier des charges du promoteur. Prime sur tout. |
| **2** | `decisions.md` | 3 tranchées, 9 ouvertes | Décisions du promoteur là où le V2.1 laisse ouvert. |
| **3** | `../audits/` | dérivé | Audits. Indice, jamais preuve. |
| **4** | code et base | constat | Ce qui est, jamais ce qui doit être. |

Le PDF est la **source**, 9 pages, 23 sections, 13 règles fondatrices R1–R13.
Empreinte `sha256:25b61b19…62c`. Extraction du texte :

```bash
python3 -c "
from pypdf import PdfReader
r = PdfReader('docs/constitution/IDEAL_Cahier_des_charges_V2.1.pdf')
print('\n'.join(p.extract_text() for p in r.pages))"
```

## Fichiers

- **`decisions.md`** — décisions du promoteur, verbatim et horodatées. Ce qui est
  tranché, ce qui reste ouvert, et ce que le V2.1 avait déjà réglé.
- **`invariants.md`** — les règles rendues vérifiables par une machine, chacune
  tracée vers sa source et vers la garde qui la contrôle.
- **`domaines.md`** — pour les douze domaines métier : qui produit, qui consomme,
  quelles tables, quels workflows en dépendent. À lire avant d'implémenter.
- **`loops.md`** — boucles de travail, limites d'oscillation, règles d'escalade.

## La règle qui prime sur les autres

**R13 — validation humaine des règles.** Aucune suggestion d'une IA ne devient une
règle métier officielle sans validation du promoteur. Le §23 du V2.1 liste quatorze
décisions explicitement non formalisées : elles se signalent, elles ne se comblent
pas.

En pratique : quand une implémentation exige une règle absente, elle s'arrête et
pose la question. Une valeur choisie par défaut « pour avancer » devient une règle
de fait que personne n'a validée — c'est exactement ce que R13 interdit.

## Règle d'or (annexe V2.1)

> Une information entre par une porte, est traitée par les bons maillons, puis
> circule automatiquement vers les acteurs autorisés jusqu'à produire le résultat
> attendu — sans double saisie, sans version contradictoire et avec une traçabilité
> complète.

C'est le critère de jugement de tout écart : une donnée qui n'atteint pas son
destinataire est une violation, même si chaque module pris isolément fonctionne.
