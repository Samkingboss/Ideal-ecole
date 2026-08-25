# La carte scolaire ne donne pas accès au dossier

## Ce qui était en ligne

`public/fiche.html` **est la cible du QR imprimé sur la carte scolaire**
(`src/pages/CartesScolaires.jsx`, `public/inscription.html`).

À partir du seul matricule, la page lisait `inscriptions` en `select('*')`,
puis `responsables` en `select('*')`, et affichait :

| De l'élève | Du responsable légal |
|---|---|
| nom, prénom, sexe, photo | nom, prénom, lien de parenté |
| date et lieu de naissance | **téléphone** |
| nationalité, langue à la maison | **WhatsApp** |
| **adresse du domicile** | **courriel** |
| **allergies et restrictions** | **profession** |
| ancienne école, classe précédente | |

Vérifié sur les données de production :

```
MATRICULE '26-27 A001'
   adresse          Adresse fictive TEST, Bamako
   date_naissance   2020-04-22
   allergies        TEST allergie arachide
   RESPONSABLE LÉGAL
     tel1           +22300000099
     whatsapp       +22300000099
     email          test.integration@exemple.invalid
```

**Une carte perdue livrait l'adresse de l'enfant et les coordonnées de ses
parents à qui la ramassait.**

## Ce qui est en ligne maintenant

La page appelle `verifier_carte_scolaire(p_matricule, p_nom)` — une surface
serveur qui existait déjà, et que le QR alimentait déjà (`&nom=`). Elle ne rend
que : `reconnue`, `prenom`, `nom`, `classe`, `annee_scolaire`.

Elle ne touche ni `inscriptions` ni `responsables`. La photo n'est plus
affichée : le portrait d'un enfant n'a pas à apparaître au scan d'une carte
ramassée dans la rue.

La page indique quoi faire d'une carte trouvée, et le numéro de l'école.

### Ce que matricule + nom NE sont PAS

Ce ne sont pas deux facteurs d'authentification. Les deux sont **imprimés sur
la même carte** : qui tient la carte tient les deux.

Ils empêchent une seule chose : l'énumération. Les matricules sont séquentiels ;
un QR ne portant que le matricule aurait laissé extraire le nom et la classe de
tous les élèves de l'école par une simple boucle.

Ce qui protège le dossier, ce n'est pas cette paire — **c'est que la page ne
lit plus le dossier.** La page ne montre rien que la carte, dans la main du
lecteur, ne montre déjà.

## Tests négatifs, exécutés dans le navigateur

| Cas | Reconnue | Identité révélée | Données familiales |
|---|---|---|---|
| matricule seul, sans nom | non | non | non |
| nom faux | non | non | non |
| matricule voisin (énumération) | non | non | non |
| matricule inconnu | non | non | non |
| matricule + nom exacts | **oui** | oui (celle de la carte) | **non** |

Le refus est identique dans les quatre cas : rien ne distingue « matricule
inexistant » de « nom qui ne correspond pas ». Un scanneur ne peut donc pas
s'en servir pour deviner.

## Ce que la direction n'a pas perdu

Le lien « Ouvrir la fiche complète ↗ » de `InscriptionsValidation` pointait
vers cette même page publique : le lien de travail de la direction et le QR
d'une carte perdue étaient le même lien.

Le dossier complet se lit désormais **dans le portail**, dans un bloc dépliable
de l'écran de validation, où la session existe. Les données étaient déjà
chargées : rien de nouveau n'est demandé au serveur.

## Gardes

`C1` (aucune page publique ne lit `responsables`), `C8` (aucun `select('*')`
public sur une table sensible), `C9` (la surface publique se limite à la
vérification de carte), `C4` et `C6` (le lien de vérification porte matricule
et nom) — toutes vertes.
