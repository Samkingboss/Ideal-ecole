#!/usr/bin/env bash
# INV-UI-01 · V2.1 §21 — tout écran est monté, ou son abandon est déclaré.
#
# C'est la régression la plus fréquente du projet : six écrans terminés sont
# aujourd'hui débranchés, dont un livré la semaine de sa perte. Rien ne le
# signalait : le code compile, le lint passe, l'écran disparaît en silence.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$RACINE" || exit 2

titre "ÉCRANS · tout composant est monté ou son abandon est déclaré   [INV-UI-01]"

ORPHELINS=$(python3 - <<'PY'
import re, glob, os, json
src = ''.join(open(f, encoding='utf-8', errors='ignore').read()
              for f in glob.glob('src/**/*.jsx', recursive=True)
                     + glob.glob('src/**/*.js', recursive=True))
assumes = set()
try: assumes = set(json.load(open('.ideal-etat.json')).get('orphelins_assumes', []))
except Exception: pass
orph = [os.path.basename(p)[:-4] for p in sorted(glob.glob('src/pages/*.jsx'))
        if not re.search(rf'<{os.path.basename(p)[:-4]}[\s/>]', src)]
print('\n'.join(o for o in orph if o not in assumes))
PY
)
NB=$(printf '%s' "$ORPHELINS" | grep -c . || true)

cliquet "ecrans_orphelins" "E1 · écrans jamais montés" "$NB"

if [ -n "$ORPHELINS" ]; then
  printf "  ${C_ATT}⧗${C_FIN} non montés : %s\n" "$(printf '%s' "$ORPHELINS" | tr '\n' ' ')"
  printf "  ${C_GRIS}   Rebrancher, ou déclarer dans .ideal-etat.json → orphelins_assumes${C_FIN}\n"
fi

bilan
