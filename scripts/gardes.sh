#!/usr/bin/env bash
# Orchestrateur des gardes IDEAL.
#
#   ./scripts/gardes.sh              tout
#   ./scripts/gardes.sh --statique   sans les modules shell lents — usage Hook
#   ./scripts/gardes.sh --metier     invariants métier seulement
#
# Sortie 0 si tout passe, 1 sinon.
#
# ── Pourquoi une DÉCOUVERTE et non une liste ──────────────────────────────
#
# Cet orchestrateur nommait ses gardes une par une. Treize fichiers de garde
# ont ainsi été écrits, validés, commités — et jamais exécutés une seule fois,
# faute d'avoir été ajoutés ici. Le même oubli s'était déjà produit avec
# `test-devoirs-selection.mjs`. Ce n'est pas une étourderie répétée : c'est le
# dispositif qui l'invite, puisqu'il demande deux gestes là où l'auteur n'en
# voit qu'un.
#
# Une garde qui ne s'exécute pas ne protège rien, et coûte pire que rien :
# elle donne le sentiment d'être couvert. On ne liste donc plus. On découvre
# tout `scripts/gardes/test-*.mjs`, dans l'ordre alphabétique. Écrire le
# fichier suffit désormais à le faire tourner.
cd "$(dirname "$0")/.." || exit 2
D=scripts/gardes
ECHECS=0

lance() { "$D/$1" || ECHECS=$((ECHECS+1)); }
# Les gardes écrites en JS sont lancées par Node : pas de shebang à maintenir,
# pas de bit exécutable à perdre au fil des copies.
lanceJS() { node "$D/$1" || ECHECS=$((ECHECS+1)); }

# ── L'INVENTAIRE VIENT DE GIT, PAS DU DISQUE ──────────────────────────────
#
# Une découverte par `for f in "$D"/test-*.mjs` sait exécuter ce qu'elle
# trouve. Elle ne sait pas qu'il MANQUE quelque chose. Renommer une garde la
# faisait disparaître en silence et l'orchestrateur restait vert : le défaut
# exact de la liste figée, retourné comme un gant. On avait échangé « la liste
# oublie les gardes neuves » contre « la découverte ne voit pas les
# disparitions ».
#
# L'index Git tient donc l'inventaire des gardes ATTENDUES. Une garde suivie
# par Git mais absente du répertoire de travail est un ÉCHEC NOMMÉ, pas un
# silence. Les gardes neuves, pas encore ajoutées à l'index, sont exécutées
# elles aussi : écrire le fichier suffit toujours à le faire tourner.
#
# Hors dépôt Git — archive, copie sans `.git` — on retombe sur le disque,
# plutôt que d'annoncer un filet absent qui ne l'est pas.
lanceToutesLesGardesJS() {
  local attendues manquantes=0 lancees=0 f
  attendues=$( { git ls-files 'scripts/gardes/test-*.mjs' 2>/dev/null
                 git ls-files --others --exclude-standard 'scripts/gardes/test-*.mjs' 2>/dev/null
               } | sort -u )
  [ -z "$attendues" ] && attendues=$(ls "$D"/test-*.mjs 2>/dev/null)

  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if [ ! -e "$f" ]; then
      printf '\033[0;31m  GARDE ATTENDUE MAIS ABSENTE : %s\033[0m\n' "$f"
      manquantes=$((manquantes+1))
      ECHECS=$((ECHECS+1))
      continue
    fi
    lancees=$((lancees+1))
    lanceJS "$(basename "$f")"
  done <<EOF
$attendues
EOF

  # Une découverte qui ne trouve rien passerait pour un succès complet.
  if [ "$lancees" -eq 0 ] && [ "$manquantes" -eq 0 ]; then
    printf '\033[0;31m  AUCUNE GARDE DÉCOUVERTE — le filet est absent, pas vert.\033[0m\n'
    ECHECS=$((ECHECS+1))
  fi
  if [ "$manquantes" -gt 0 ]; then
    printf '\033[0;31m  %s garde(s) attendue(s) introuvable(s) — supprimées ou renommées.\033[0m\n' "$manquantes"
  fi
}

case "${1:-}" in
  --statique) lance statiques.sh; lance ecrans.sh; lance cliquets.sh
              lanceToutesLesGardesJS ;;
  --metier)   lance invariants.sh ;;
  *)          lance statiques.sh; lance ecrans.sh; lance cliquets.sh
              lanceToutesLesGardesJS
              lance invariants.sh; lance reseau.sh ;;
esac

printf '\033[0;90m═══════════════════════════════════════════════════════\033[0m\n'
if [ "$ECHECS" -eq 0 ]; then
  printf '  \033[0;32mTOUS LES MODULES AU VERT\033[0m\n\n'; exit 0
else
  printf '  \033[0;31m%s MODULE(S) EN ÉCHEC\033[0m\n\n' "$ECHECS"; exit 1
fi
