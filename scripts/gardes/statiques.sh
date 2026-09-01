#!/usr/bin/env bash
# Gardes statiques — lecture de fichiers, sans réseau ni secret. < 3 s.
# Matière à Hook PostToolUse : elles attrapent la réintroduction d'un secret
# à l'instant de la frappe.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$RACINE" || exit 2

titre "STATIQUES · le secret ne doit pas revenir dans le code   [INV-SEC-02, INV-SEC-03]"

garde "H1 · aucune lecture de p.code_acces / p.plafond" \
  "grep -rn 'p\.code_acces\|p\.plafond_salaire' src/ public/ 2>/dev/null | wc -l | tr -d ' '" "0"

garde "H2 · aucune écriture directe sur users" \
  "grep -rn \"from('users')\" src/ public/ 2>/dev/null | grep -cE 'insert|update|upsert|delete' | tr -d ' '" "0"

garde "H3 · aucun select de code_acces" \
  "grep -rn 'select.*code_acces' src/ public/ 2>/dev/null | wc -l | tr -d ' '" "0"

# RECALIBRÉE en Phase 2, avec l'accord du directeur.
#
# Elle attendait TROIS appels : `authentifier_par_code`,
# `enregistrer_utilisateur`, `desactiver_utilisateur`. Deux d'entre eux ont
# légitimement disparu du frontend :
#   · `authentifier_par_code` — repli de connexion retiré, puis révoqué en
#     Phase 1. Il ne reste que la phrase qui explique son retrait.
#   · `enregistrer_utilisateur` — la création passe désormais par
#     /api/personnel-creer, qui crée aussi l'identité Auth. Cette RPC n'a
#     plus AUCUN appelant : elle reste en base, confinée, en attente d'un
#     retrait dans une phase ultérieure.
#
# Ce que la garde protège vraiment est ailleurs, et reste inchangé : H2
# interdit toute écriture directe sur `users`. Ici on vérifie simplement que
# la désactivation passe encore par sa RPC, et que rien n'a rouvert un
# chemin direct.
garde "H4 · la désactivation passe encore par sa RPC" \
  "grep -rn 'authentifier_par_code\|enregistrer_utilisateur\|desactiver_utilisateur' src/ 2>/dev/null | wc -l | tr -d ' '" "2"

garde "H5 · liste blanche de session déclarée" \
  "grep -c 'CHAMPS_SESSION' src/App.jsx | tr -d ' '" "2"

garde "H6 · purge des sessions contaminées" \
  "grep -c 'CHAMPS_SENSIBLES.some' src/App.jsx | tr -d ' '" "1"

# La distinction « code faux » / « serveur injoignable » est un acquis explicite.
# La perdre renverrait chercher une panne inexistante.
garde "H7 · distinction code faux / panne réseau" \
  "[ \"$(grep -c 'estPanneReseau' src/pages/LoginPage.jsx)\" -ge 3 ] && echo present || echo absent" "present"

garde "H8 · scripts SQL de la phase 0 versionnés" \
  "ls sql/phase0_*.sql 2>/dev/null | wc -l | tr -d ' '" "6"

titre "STATIQUES · la constitution est en place   [INV-CONT-02]"

garde "H10 · le cahier des charges V2.1 est présent" \
  "[ -f docs/constitution/IDEAL_Cahier_des_charges_V2.1.pdf ] && echo oui || echo non" "oui"

garde "H11 · CLAUDE.md est présent" \
  "[ -f CLAUDE.md ] && echo oui || echo non" "oui"

garde "H12 · invariants et décisions versionnés" \
  "ls docs/constitution/invariants.md docs/constitution/decisions.md 2>/dev/null | wc -l | tr -d ' '" "2"

titre "STATIQUES · aucun fichier suivi ne doit être vide"

# Ajoutée après un incident : `public/rapports.html` s'est retrouvé à zéro
# octet, et mon contrôle de syntaxe l'a déclaré valide — sur un fichier vide
# la boucle ne trouve aucun bloc et conclut « rien à redire ».
# Un fichier suivi par git qui tombe à zéro est toujours un accident.
NB_VIDES=$(git ls-files -z | xargs -0 -I{} sh -c '[ -f "{}" ] && [ ! -s "{}" ] && echo {}' 2>/dev/null | wc -l | tr -d ' ')
cliquet "fichiers_vides" "H13 · fichiers suivis à 0 octet" "$NB_VIDES"

# Une clé `service_role` contourne toute RLS. Committée, elle annule tout le
# travail de sécurité en une ligne. On décode la charge utile de chaque JWT
# suivi par git : chercher le mot « service_role » ne trouverait rien, il est
# encodé en base64 dans le jeton.
garde "H14 · aucun JWT autre que anon dans le depot" \
  "node scripts/gardes/detecter-service-role.mjs >/dev/null 2>&1 && echo propre || echo fuite" "propre"

bilan
