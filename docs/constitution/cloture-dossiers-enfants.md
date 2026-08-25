# Dossiers enfants — bucket privé `inscriptions`

Le bucket contient les pièces d'identité d'enfants : acte de naissance,
photo, signature du responsable légal. Il a été lisible par la clé publiable
pendant toute la phase de mise en service.

## Le workflow à prouver

```
DÉPÔT PUBLIC → STOCKAGE PRIVÉ → LECTURE DIRECTION/RA
             → SIGNATURE DIRECTION → VALIDATION → AUCUNE LECTURE ANON
```

## Ce qui a été trouvé, dans l'ordre

| | défaut | mécanisme |
|---|---|---|
| 1 | `anon` téléchargeait un acte de naissance | policy `lecture_inscriptions_storage` · SELECT · `{anon}` |
| 2 | la direction ne pouvait pas signer un dossier | aucune policy INSERT ne visait `authenticated` |
| 3 | `anon` pouvait **valider** un dossier | `valider_inscription_direction` : `grant … to anon`, aucun contrôle interne |

Le troisième est le plus grave et le moins visible. `creer_inscription` rend
`inscription_id` au parent qui vient de déposer : ce parent tenait
l'identifiant exact de son propre dossier. Il pouvait le valider lui-même —
création de l'élève, attribution du matricule, envoi du WhatsApp — en passant
n'importe quoi comme chemin de signature, jamais vérifié. `SECURITY DEFINER`
retire la RLS du chemin ; le `grant` suffisait.

## Deux règles apprises ici

**Un nom de policy ne prouve rien.** Ce bucket a été « fermé » une première
fois par un `drop policy if exists` sur neuf noms inventés. `drop policy if
exists` sur un nom inexistant est un no-op silencieux : rien n'a été fermé et
tout avait l'air fait.

**`Object not found` ne veut pas dire « refusé ».** Storage rend le même
message pour caché et pour inexistant. Un chemin recopié de mémoire produit
donc un faux PASS — c'est arrivé, sur un mauvais UUID. Toute pièce testée est
désormais découverte par listing avec la session ouverte.

## Ce qui garde la fermeture

| garde | fichier | ce qu'elle interroge |
|---|---|---|
| G1–G4, G13 | `scripts/gardes/test-storage-anon-live.mjs` | la production, avec la clé publiable : les octets, pas les noms |
| G8–G12 | `scripts/gardes/test-storage-inscriptions.mjs` | le code : `getPublicUrl`, `remove()`, préfixes, liens signés |
| G5–G7, E2E | `scripts/verif-storage-direction.sh` | ce qui exige un compte — saisie masquée, sortie en verdicts |

## Décisions assumées

**Aucune policy DELETE.** Un droit de suppression sur tout le bucket pour
rattraper une panne rare est un mauvais échange. Si le dépôt de signature
réussit et que la validation échoue, le fichier reste — et son chemin est
écrit dans la console. Un orphelin rare vaut mieux qu'un droit large.

**`justificatifs/` n'est pas réparé ici.** Les policies du dossier visent
`anon` ; son seul écrivain, `comptabilite.html`, agit désormais en session
authentifiée. Cela ne concerne pas les dossiers enfants : c'est le
justificatif d'absence d'un enseignant.
