#!/usr/bin/env bash
# Socle commun des gardes. Sourcé par les modules, jamais exécuté seul.

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ETAT="$RACINE/.ideal-etat.json"

OK=0; KO=0; ALERTES=()
C_OK='\033[0;32m'; C_KO='\033[0;31m'; C_ATT='\033[0;33m'; C_GRIS='\033[0;90m'; C_FIN='\033[0m'

titre() { printf "\n${C_GRIS}── %s ──${C_FIN}\n" "$1"; }

# garde <libellé> <commande> <attendu>
garde() {
  local libelle="$1" cmd="$2" attendu="$3" obtenu
  obtenu=$(eval "$cmd" 2>/dev/null)
  printf "  %-54s " "$libelle"
  if [ "$obtenu" = "$attendu" ]; then
    printf "${C_OK}✓${C_FIN}\n"; OK=$((OK+1))
  else
    printf "${C_KO}✗  attendu %s, obtenu %s${C_FIN}\n" "$attendu" "${obtenu:-<vide>}"
    KO=$((KO+1)); ALERTES+=("$libelle : attendu $attendu, obtenu ${obtenu:-<vide>}")
  fi
}

# Un cliquet s'abaisse quand la dette baisse — mais supprimer du code fait
# aussi baisser tous les compteurs. Quand `public/rapports.html` s'est
# retrouvé vide, ses deux appels wa.me ont disparu et le plafond s'est
# abaissé sur une régression prise pour un progrès. Un plafond faussé ainsi
# rend ensuite le retour à la normale impossible sans intervention.
#
# On refuse donc d'abaisser un plafond tant que l'arbre de travail contient
# un fichier suivi supprimé.
etat_sain() {
  local supprimes
  supprimes=$(cd "$RACINE" && git diff --name-only --diff-filter=D 2>/dev/null | wc -l | tr -d ' ')
  [ "${supprimes:-0}" -eq 0 ]
}

# Cliquet décroissant : la dette ne remonte jamais, et le plafond baisse seul.
# C'est ce qui permet d'avancer sans exiger zéro, tout en interdisant le recul.
cliquet() {
  local cle="$1" libelle="$2" actuel="$3" plafond
  plafond=$(python3 -c "
import json,sys
try: print(json.load(open('$ETAT'))['plafonds'].get('$cle','999999'))
except Exception: print('999999')")
  printf "  %-54s " "$libelle"
  if [ "${actuel:-999999}" -le "${plafond:-999999}" ] 2>/dev/null; then
    if [ "$actuel" -lt "$plafond" ] 2>/dev/null && etat_sain; then
      python3 - "$ETAT" "$cle" "$actuel" <<'PY'
import json,sys
p,cle,val=sys.argv[1],sys.argv[2],int(sys.argv[3])
d=json.load(open(p)); d['plafonds'][cle]=val
json.dump(d,open(p,'w'),indent=2,ensure_ascii=False)
PY
      printf "${C_OK}✓ %s${C_FIN}  ${C_GRIS}(plafond abaissé depuis %s)${C_FIN}\n" "$actuel" "$plafond"
    else
      printf "${C_OK}✓ %s${C_FIN}\n" "$actuel"
    fi
    OK=$((OK+1))
  else
    printf "${C_KO}✗ %s — plafond %s dépassé${C_FIN}\n" "$actuel" "$plafond"
    KO=$((KO+1)); ALERTES+=("$libelle : $actuel > plafond $plafond")
  fi
}

# Plancher croissant : le journal d'audit croît, il ne perd jamais de ligne.
plancher() {
  local cle="$1" libelle="$2" actuel="$3" seuil
  seuil=$(python3 -c "
import json
try: print(json.load(open('$ETAT'))['planchers'].get('$cle','0'))
except Exception: print('0')")
  printf "  %-54s " "$libelle"
  if [ "${actuel:-0}" -ge "${seuil:-0}" ] 2>/dev/null; then
    if [ "$actuel" -gt "$seuil" ] 2>/dev/null; then
      python3 - "$ETAT" "$cle" "$actuel" <<'PY'
import json,sys
p,cle,val=sys.argv[1],sys.argv[2],int(sys.argv[3])
d=json.load(open(p)); d['planchers'][cle]=val
json.dump(d,open(p,'w'),indent=2,ensure_ascii=False)
PY
    fi
    printf "${C_OK}✓ %s${C_FIN}\n" "$actuel"; OK=$((OK+1))
  else
    printf "${C_KO}✗ %s < plancher %s — PERTE${C_FIN}\n" "$actuel" "$seuil"
    KO=$((KO+1)); ALERTES+=("$libelle : $actuel < plancher $seuil (perte de données)")
  fi
}

bilan() {
  printf "\n"
  if [ "$KO" -eq 0 ]; then
    printf "  ${C_OK}%s garde(s) au vert, aucune en échec.${C_FIN}\n\n" "$OK"; return 0
  fi
  printf "  ${C_KO}%s au vert, %s EN ÉCHEC :${C_FIN}\n" "$OK" "$KO"
  for a in "${ALERTES[@]}"; do printf "    ${C_KO}·${C_FIN} %s\n" "$a"; done
  printf "\n"; return 1
}
