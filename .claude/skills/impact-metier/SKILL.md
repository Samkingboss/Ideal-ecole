---
name: impact-metier
description: Analyse d'impact inter-rôles avant toute modification touchant rôles, permissions, flux, notifications, messagerie, élèves, RH, finances, vie scolaire, pédagogie, cantine ou stocks. Consulte le V2.1 et docs/constitution/domaines.md.
---

# Impact métier

## Quand l'appliquer

Avant toute modification touchant l'un des douze domaines : rôles, permissions,
flux de données, notifications, messagerie, dossiers élèves, RH, finances, vie
scolaire, pédagogie, cantine, stocks.

## Pourquoi — le coût de son absence

La chaîne d'allergie est rompue de bout en bout. Un parent déclare « Arachide » à
l'inscription ; la donnée est bien stockée. Puis la fonction de validation ne la
recopie pas, les colonnes n'existent pas dans `eleves`, et l'écran de la cuisinière
affiche « Aucune ».

Chaque maillon fonctionnait. Personne n'avait vérifié **qui consommait la donnée en
aval**. C'est exactement ce que la règle d'or interdit.

## La procédure

**1 · Lire la source.** Le V2.1 d'abord — extraire la section concernée du PDF.
Puis `decisions.md`. Si les deux se taisent : **R13 s'applique, la règle se signale,
elle ne s'invente pas.** Le §23 liste quatorze décisions explicitement ouvertes.

```bash
python3 -c "
from pypdf import PdfReader
r = PdfReader('docs/constitution/IDEAL_Cahier_des_charges_V2.1.pdf')
print('\n'.join(p.extract_text() for p in r.pages))" | grep -A 20 '^14. Cantine'
```

**2 · Ouvrir la fiche du domaine** dans `docs/constitution/domaines.md` : qui
produit, qui consomme, quelles tables, quels workflows en dépendent.

**3 · Remonter et descendre la chaîne.** En amont : d'où vient la donnée, qui en
est propriétaire (R3) ? En aval : **tous** les consommateurs légitimes la
reçoivent-ils ? Un consommateur oublié est une violation de la règle d'or, même si
chaque module pris isolément fonctionne.

**4 · Vérifier les invariants applicables** dans `invariants.md`.

**5 · Vérifier les rôles.** R9 — séparation des responsabilités. R4 — la donnée
circule vers les rôles autorisés **qui en ont besoin**, pas vers tous.

**6 · Écrire l'impact** dans le message de commit : domaines touchés, consommateurs
en aval vérifiés, invariants concernés, règles manquantes signalées.

## Les questions qui font échouer une analyse

- Qui d'autre lit cette donnée ? *(chercher les consommateurs, pas seulement l'écrivain)*
- Que voit ce rôle si la donnée est absente ? *(le silence ne doit jamais ressembler à une réponse)*
- Cette donnée existe-t-elle déjà ailleurs ? *(R2 — zéro double saisie)*
- Un rôle non concerné y a-t-il accès ? *(R4, R9)*
- L'action est-elle tracée ? *(R5, §18)*
- Ai-je inventé une règle ? *(R13 — si oui, revenir en arrière et la signaler)*

## Ce que cette analyse ne remplace pas

Aucun script ne dira qu'un workflow techniquement cohérent est absurde métier. Cette
procédure structure le jugement ; elle ne s'y substitue pas.
