#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# RECETTE — DEPOT D UN DOSSIER PAR LE RESPONSABLE ADMINISTRATIF
# ═══════════════════════════════════════════════════════════════════════
#
# Le parcours cartographie, dans l ordre reel :
#
#   inscription.html:1364   photos/<ref>.jpg               upload
#   inscription.html:1396   documents/<ref>/<piece>.<ext>   upload
#   inscription.html:1433   signatures/<ref>.png            upload
#   inscription.html:1473   rpc creer_inscription
#
# LES CODES D ACCES NE SORTENT PAS DE CETTE MACHINE : saisie masquee,
# jamais affichee, jamais dans l historique, jamais dans un fichier,
# effacee sitot le jeton obtenu. La sortie ne contient que des verdicts.
#
# ECRITURE : les objets deposes portent le prefixe FIXTURE-RA-CLOTURE et
# sont listes en fin de sortie. Aucun droit DELETE n est demande pour les
# retirer -- ils se suppriment au tableau de bord.
#
# Usage :  bash ~/Desktop/ideal-ecole/scripts/verif-depot-ra.sh

set -u
URL='https://jircuneixzwsmtktxrkh.supabase.co'
KEY=$(grep -oE "SUPABASE_KEY = '[^']+'" "$(dirname "$0")/../public/inscription.html" | sed "s/.*'\(.*\)'/\1/")
[ -z "$KEY" ] && { echo 'ABANDON : cle introuvable'; exit 1; }
DOMAINE='@comptes.ideal-ecole.ml'
REF="FIXTURE-RA-CLOTURE-$(date +%s)"
OK=0; KO=0; DEPOSES=()

vert()  { echo "PASS  $1"; OK=$((OK+1)); }
rouge() { echo "FAIL  $1"; KO=$((KO+1)); }

jeton() {
  curl -sS -X POST "$URL/auth/v1/token?grant_type=password" \
    -H "apikey: $KEY" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1$DOMAINE\",\"password\":\"$2\"}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token") or "")' 2>/dev/null
}
connexion() {
  local id mdp t essai
  for essai in 1 2 3; do
    read -r  -p "  Identifiant $1 : " id
    [ "$id" = '-' ] && { echo '  compte saute' >&2; return 2; }
    read -rs -p "  Code d acces $1 : " mdp; echo >&2
    t=$(jeton "$id" "$mdp" | tr -d '\n\r '); mdp=''
    if [ -n "$t" ]; then echo '  session ouverte' >&2; printf '%s' "$t"; return 0; fi
    echo "  refuse (essai $essai sur 3)" >&2
  done
  return 1
}

# Un depot se juge sur le CORPS : un refus RLS arrive en http 400 portant
# 403 « new row violates row-level security policy ». Lire le statut seul
# confondrait ce refus avec une panne reseau.
deposer() {  # $1 libelle  $2 chemin  $3 jeton  $4 attendu: accepte|refuse
  local code refus
  printf 'FIXTURE' > /tmp/ideal-ra.bin
  code=$(curl -sS -o /tmp/ideal-ra.json -w '%{http_code}' -X POST \
    -H "apikey: $KEY" -H "Authorization: Bearer $3" -H 'Content-Type: text/plain' \
    --data-binary @/tmp/ideal-ra.bin "$URL/storage/v1/object/inscriptions/$2")
  refus=0; grep -q 'row-level security' /tmp/ideal-ra.json && refus=1
  if [ "$4" = 'accepte' ]; then
    if [ "$code" = '200' ]; then vert "$1"; DEPOSES+=("inscriptions/$2")
    else rouge "$1 — refuse (http $code) : $(head -c 95 /tmp/ideal-ra.json)"; fi
  else
    if [ "$refus" = '1' ]; then vert "$1 — refuse par la RLS"
    else rouge "$1 — NON refuse (http $code) : $(head -c 95 /tmp/ideal-ra.json)"; fi
  fi
}

# Une lecture se juge sur les OCTETS : sous RLS un refus se presente en
# « Object not found », pas en 403.
lire() {  # $1 libelle  $2 chemin  $3 jeton  $4 attendu: lit|refuse
  local code taille
  read -r code taille <<< "$(curl -sS -o /tmp/ideal-ra-l.bin -w '%{http_code} %{size_download}' \
    -H "apikey: $KEY" -H "Authorization: Bearer $3" "$URL/storage/v1/object/inscriptions/$2")"
  if [ "$4" = 'lit' ]; then
    if [ "$code" = '200' ] && [ "$taille" -gt 3 ]; then vert "$1 — $taille o"
    else rouge "$1 — http $code, $taille o"; fi
  else
    if [ "$code" = '200' ] && [ "$taille" -gt 3 ]; then rouge "$1 — $taille o RECUS : FUITE"
    else vert "$1 — aucun octet"; fi
  fi
}

echo
echo '════════ SESSION RESPONSABLE ADMINISTRATIF ════════'
T_RA=$(connexion 'responsable administratif') || { echo 'ABANDON : session RA non ouverte'; exit 1; }

echo
echo '--- R1 a R4 · le parcours de depot, dans l ordre reel ---'
deposer "R2 photo        photos/$REF.jpg"                   "photos/$REF.jpg"                       "$T_RA" accepte
deposer "R3 acte         documents/$REF/acte_naissance.txt" "documents/$REF/acte_naissance.txt"     "$T_RA" accepte
deposer "R3 vaccination  documents/$REF/vaccination.txt"    "documents/$REF/vaccination.txt"        "$T_RA" accepte
deposer "R4 signature    signatures/$REF.png"               "signatures/$REF.png"                   "$T_RA" accepte

echo
echo '--- R8 · le RA relit ce qu il vient de deposer ---'
lire "R8 relecture de la photo" "photos/$REF.jpg" "$T_RA" lit

echo
echo '--- N3 · hors des prefixes du parcours ---'
# Le RA n a pas de droit general sur le bucket : seulement ce que son
# parcours exige.
deposer "N3 RA -> interdit/"          "interdit/$REF.txt"           "$T_RA" refuse
deposer "N3 RA -> justificatifs/"     "justificatifs/$REF.txt"      "$T_RA" refuse

echo
echo '--- R7 · remplacement d une piece ---'
# Le code ne remplace jamais une piece : aucun upsert, aucun update sur ce
# bucket dans ce parcours. Le second depot du meme chemin doit donc buter
# sur le doublon, PAS sur la RLS -- c est la difference entre « le droit
# n existe pas » et « le droit n a pas lieu d etre ».
code=$(curl -sS -o /tmp/ideal-ra.json -w '%{http_code}' -X POST \
  -H "apikey: $KEY" -H "Authorization: Bearer $T_RA" -H 'Content-Type: text/plain' \
  --data-binary @/tmp/ideal-ra.bin "$URL/storage/v1/object/inscriptions/photos/$REF.jpg")
if grep -q 'Duplicate\|already exists' /tmp/ideal-ra.json; then
  vert 'R7 second depot : refus pour DOUBLON, pas pour droit manquant'
elif grep -q 'row-level security' /tmp/ideal-ra.json; then
  rouge 'R7 second depot refuse par la RLS — le droit INSERT manque'
else
  rouge "R7 second depot : reponse inattendue (http $code) : $(head -c 90 /tmp/ideal-ra.json)"
fi

echo
echo '════════ SESSION DIRECTION ════════'
T_DIR=$(connexion 'direction'); etat=$?
if [ $etat -eq 0 ]; then
  lire 'D lecture de la piece deposee par le RA' "documents/$REF/acte_naissance.txt" "$T_DIR" lit
  deposer 'D depot photo (meme parcours)' "photos/$REF-dir.jpg" "$T_DIR" accepte
elif [ $etat -eq 2 ]; then echo '  controles direction non executes'
else rouge 'session direction non ouverte'; fi

echo
echo '════════ TEMOINS NEGATIFS ════════'
echo '  Une garde qui ne sait pas echouer ne prouve rien : si une policy'
echo '  devient trop large, ces trois-la doivent rougir.'
T_PROF=$(connexion 'enseignant'); etat=$?
if [ $etat -eq 0 ]; then
  deposer 'N1 enseignant -> photos/'     "photos/$REF-intrus.jpg"                   "$T_PROF" refuse
  deposer 'N2 enseignant -> documents/'  "documents/$REF/intrus.txt"                "$T_PROF" refuse
  deposer 'N2 enseignant -> signatures/' "signatures/$REF-intrus.png"               "$T_PROF" refuse
  lire    'N enseignant lit une piece'   "documents/$REF/acte_naissance.txt"        "$T_PROF" refuse
elif [ $etat -eq 2 ]; then
  echo '  N1-N2 non executes — la restriction reste NON PROUVEE'; KO=$((KO+1))
else rouge 'session enseignant non ouverte'; fi

echo
echo '--- N4 · N5 · anon ---'
lire 'N4 anon lit une piece' "documents/$REF/acte_naissance.txt" "$KEY" refuse
printf '  %-58s ' 'N5 anon liste le bucket'
corps=$(curl -sS -X POST -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"prefix":"","limit":100}' \
  "$URL/storage/v1/object/list/inscriptions")
if [ "$corps" = '[]' ]; then echo 'PASS — aucune entree'; OK=$((OK+1))
else echo "FAIL — $(printf '%s' "$corps" | head -c 80)"; KO=$((KO+1)); fi

# Le parcours du PARENT non connecte doit rester intact : c est la moitie du
# sujet, et l elargir aurait ete la facon la plus simple de « faire marcher »
# le RA.
printf '  %-58s ' 'P anon depose toujours une photo'
code=$(curl -sS -o /tmp/ideal-ra.json -w '%{http_code}' -X POST \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: text/plain' \
  --data-binary @/tmp/ideal-ra.bin "$URL/storage/v1/object/inscriptions/photos/$REF-parent.jpg")
if [ "$code" = '200' ]; then echo 'PASS'; OK=$((OK+1)); DEPOSES+=("inscriptions/photos/$REF-parent.jpg")
else echo "FAIL (http $code) : $(head -c 80 /tmp/ideal-ra.json)"; KO=$((KO+1)); fi

echo
echo '═══════════════════════════════════════'
echo "  $OK PASS · $KO FAIL"
[ $KO -eq 0 ] && echo '  DEPOT RA : PARCOURS PROUVE' || echo '  A CORRIGER'
if [ ${#DEPOSES[@]} -gt 0 ]; then
  echo
  echo '  Fixtures deposees — a supprimer au tableau de bord'
  echo '  (Storage > inscriptions > selectionner > Delete) :'
  for o in "${DEPOSES[@]}"; do echo "    $o"; done
fi
rm -f /tmp/ideal-ra.bin /tmp/ideal-ra.json /tmp/ideal-ra-l.bin
