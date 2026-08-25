# Ce qui reste ouvert à la clé publique

Relevé après la fermeture de `financement_params`, `inscriptions` et
`responsables`. Mesuré depuis la clé publiable, avec en-têtes anti-cache.

## Fermé

| Table | Vérification |
|---|---|
| `financement_params` | SELECT 0 ligne · INSERT 401 · UPDATE 0 ligne · DELETE 0 ligne |
| `inscriptions` | SELECT 0 ligne |
| `responsables` | SELECT 0 ligne |

## Encore ouvert

| Table | Lignes | Ce qu'un visiteur obtient |
|---|---|---|
| `documents_inscription` | 18 | type, nom de fichier et **chemin de stockage** de l'acte de naissance, du carnet de vaccination, du bulletin et du certificat de transfert de chaque enfant |
| `eleves` | 12 | nom, prénom, classe, matricule — les colonnes familiales sont vides sur les lignes actuelles, mais la lecture n'est pas fermée |
| `users` | 13 | prénom, nom, rôle et **identifiant de connexion** de tout le personnel |
| `disciplines` | 4 | motif et gravité des incidents — « Gifler son maître », grave |
| `preparations` | 22 | contenu pédagogique, `url_doc` |
| `devoirs` | 15 | énoncés, pièces jointes |
| `app_state` | 32 | **les boîtes de notification**, dont celles de la direction |
| `demandes_materiel`, `maternelle_preparations`, `classes` | 1, 1, 8 | données de service |

### Ce qui protège encore

Les **fichiers** eux-mêmes ne sont pas téléchargeables : le bucket
`inscriptions` est privé, l'URL publique répond `400 · Bucket not found`. Seules
les **métadonnées** fuient — mais elles nomment l'enfant et le document.

### Ordre de gravité

1. **`documents_inscription`** — la nature des pièces d'un enfant nommé.
2. **`users`** — les identifiants de connexion de tout le personnel. Ce n'est
   pas un secret d'authentification, le code l'est ; mais c'est la moitié de
   chaque compte, offerte.
3. **`disciplines`** — ce qu'un enfant a fait, et la sanction.
4. **`app_state`** — les notifications de la direction, déjà documenté dans
   `fermeture-app-state.md`, et dont la fermeture attend la migration des
   dix-sept écritures.
5. Le reste — pédagogique, moins sensible, mais sans raison d'être public.

### Pourquoi ce n'est pas fermé d'un coup

Chaque table a des lecteurs. Fermer sans les avoir tracés casserait des écrans,
comme la fermeture d'`inscriptions` aurait cassé le secrétariat si
`inscription.html` n'avait pas d'abord partagé sa session. La méthode qui a
fonctionné pour les trois premières s'applique aux suivantes : établir qui lit,
faire passer ces lecteurs en session authentifiée, puis fermer, puis mesurer.
