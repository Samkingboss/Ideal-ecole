#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# RECETTE DE CLOTURE — DOSSIERS ENFANTS, bucket prive `inscriptions`
# ═══════════════════════════════════════════════════════════════════════
#
# Prouve le workflow complet, de bout en bout :
#
#   DEPOT PUBLIC -> STOCKAGE PRIVE -> LECTURE DIRECTION/RA
#                -> SIGNATURE DIRECTION -> VALIDATION -> AUCUNE LECTURE ANON
#
# Ce qui se teste sans compte est ailleurs et tourne seul :
#   node scripts/gardes/test-storage-anon-live.mjs
#   node scripts/gardes/test-storage-inscriptions.mjs
#
# LES CODES D ACCES NE SORTENT PAS DE CETTE MACHINE : saisie masquee,
# jamais affichee, jamais dans l historique, jamais dans un fichier,
# effacee sitot le jeton obtenu. La sortie ne contient que des verdicts.
#
# AUCUN DOSSIER REEL N EST TOUCHE. La validation de bout en bout travaille
# sur une inscription FIXTURE-CLOTURE, creee par le script s il le faut.
# Les objets deposes sont listes en fin de sortie pour le menage.
#
# Usage :  bash ~/Desktop/ideal-ecole/scripts/verif-storage-direction.sh

set -u
URL='https://jircuneixzwsmtktxrkh.supabase.co'
KEY=$(grep -oE "SUPABASE_KEY = '[^']+'" "$(dirname "$0")/../public/inscription.html" | sed "s/.*'\(.*\)'/\1/")
[ -z "$KEY" ] && { echo 'ABANDON : cle introuvable dans public/inscription.html'; exit 1; }
DOMAINE='@comptes.ideal-ecole.ml'
OK=0; KO=0; ORPHELINS=()

# Objets reels du bucket. Leur existence est prouvee par D1/D2 eux-memes :
# s ils rendent des octets, ils existent ; s ils n en rendent pas, le test
# echoue et dit pourquoi. Aucun autre chemin n est ecrit en dur — les pieces
# du dossier sont DECOUVERTES par listing avec la session ouverte, parce que
# Storage rend « Object not found » aussi bien pour cache que pour inexistant
# et qu un chemin recopie de memoire produirait un faux PASS.
PHOTO='photos/26-27%20A002.jpg'
SIGNA='signatures/26-27%20A002.png'

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
    [ "$id" = '-' ] && { echo "  compte saute" >&2; return 2; }
    read -rs -p "  Code d acces $1 : " mdp; echo >&2
    t=$(jeton "$id" "$mdp" | tr -d '\n\r '); mdp=''
    if [ -n "$t" ]; then echo "  session ouverte" >&2; printf '%s' "$t"; return 0; fi
    echo "  refuse (essai $essai sur 3)" >&2
  done
  return 1
}

# Un GET se juge sur le CORPS, jamais sur le statut : sous RLS un refus de
# lecture Storage se presente en 400 { Object not found }, pas en 403.
lire() {  # $1 libelle  $2 chemin  $3 jeton  $4 attendu: lit|refuse
  local code taille
  read -r code taille <<< "$(curl -sS -o /tmp/ideal-l.bin -w '%{http_code} %{size_download}' \
    -H "apikey: $KEY" -H "Authorization: Bearer $3" "$URL/storage/v1/object/inscriptions/$2")"
  if [ "$4" = 'lit' ]; then
    if [ "$code" = '200' ] && [ "$taille" -gt 500 ]; then vert "$1 — $taille o recus"
    else rouge "$1 — http $code, $taille o : $(head -c 80 /tmp/ideal-l.bin | tr -d '\n')"; fi
  else
    if [ "$code" = '200' ] && [ "$taille" -gt 500 ]; then rouge "$1 — $taille o RECUS : FUITE"
    else vert "$1 — aucun octet"; fi
  fi
}

deposer() {  # $1 libelle  $2 chemin  $3 jeton  $4 attendu: accepte|refuse
  local code
  echo 'FIXTURE-CLOTURE' > /tmp/ideal-fx.txt
  code=$(curl -sS -o /tmp/ideal-d.json -w '%{http_code}' -X POST \
    -H "apikey: $KEY" -H "Authorization: Bearer $3" -H 'Content-Type: text/plain' \
    --data-binary @/tmp/ideal-fx.txt "$URL/storage/v1/object/inscriptions/$2")
  local refus_rls=0
  grep -q 'row-level security' /tmp/ideal-d.json && refus_rls=1
  if [ "$4" = 'accepte' ]; then
    if [ "$code" = '200' ]; then vert "$1 — depot accepte"; ORPHELINS+=("inscriptions/$2")
    else rouge "$1 — refuse (http $code) : $(head -c 90 /tmp/ideal-d.json)"; fi
  else
    if [ "$refus_rls" = '1' ]; then vert "$1 — depot refuse par la RLS"
    else rouge "$1 — NON refuse (http $code) : $(head -c 90 /tmp/ideal-d.json)"; fi
  fi
}

# Descend documents/<dossier>/<piece> et rend le chemin d une piece reelle.
decouvrir_piece() {  # $1 jeton
  local dossier piece
  dossier=$(curl -sS -X POST -H "apikey: $KEY" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' -d '{"prefix":"documents","limit":100}' \
    "$URL/storage/v1/object/list/inscriptions" \
    | python3 -c 'import sys,json
o=[x["name"] for x in json.load(sys.stdin) if not x.get("id")]
print(o[0] if o else "")' 2>/dev/null)
  [ -z "$dossier" ] && return 1
  piece=$(curl -sS -X POST -H "apikey: $KEY" -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' -d "{\"prefix\":\"documents/$dossier\",\"limit\":100}" \
    "$URL/storage/v1/object/list/inscriptions" \
    | python3 -c 'import sys,json
o=[x["name"] for x in json.load(sys.stdin) if x.get("id")]
print(o[0] if o else "")' 2>/dev/null)
  [ -z "$piece" ] && return 1
  printf 'documents/%s/%s' "$dossier" "$piece" | sed 's/ /%20/g'
}

echo
echo '════════ SESSION DIRECTION ════════'
T_DIR=$(connexion 'direction') || { echo 'ABANDON : session direction non ouverte'; exit 1; }

echo
echo '--- G5 · la direction lit les pieces ---'
lire 'D1 photo eleve'      "$PHOTO" "$T_DIR" lit
lire 'D2 signature parent' "$SIGNA" "$T_DIR" lit
PIECE=$(decouvrir_piece "$T_DIR")
if [ -z "$PIECE" ]; then rouge 'D3 aucune piece listee sous documents/ — la direction ne voit rien'
else echo "      piece trouvee par listing : $PIECE"; lire 'D3 piece du dossier' "$PIECE" "$T_DIR" lit; fi

echo
echo '--- D4 · lien signe (ce qu appelle InscriptionsValidation) ---'
rep=$(curl -sS -X POST -H "apikey: $KEY" -H "Authorization: Bearer $T_DIR" \
      -H 'Content-Type: application/json' -d '{"expiresIn":900}' \
      "$URL/storage/v1/object/sign/inscriptions/$SIGNA")
printf '%s' "$rep" | grep -q 'signedURL' && vert 'D4 lien signe delivre' \
  || rouge "D4 lien signe refuse : $(printf '%s' "$rep" | head -c 100)"

echo
echo '--- G6 · depot de la signature de validation ---'
deposer 'D5 signatures-direction/' "signatures-direction/FIXTURE-CLOTURE-$(date +%s).txt" "$T_DIR" accepte
deposer 'D6 ailleurs dans le bucket (doit etre refuse)' "interdit/FIXTURE-CLOTURE.txt" "$T_DIR" refuse

echo
echo '════════ VALIDATION D UN DOSSIER, DE BOUT EN BOUT ════════'
bash "$(dirname "$0")/cloture-validation-debug.sh" "$URL" "$KEY" "$T_DIR"
etat_e2e=$?
if [ $etat_e2e -eq 0 ]; then vert 'E2E validation du dossier fixture'
else rouge 'E2E validation du dossier fixture (voir ci-dessus)'; fi

echo
echo '--- JUSTIFICATIFS · l ecrivain reel est authentifie, pas anon ---'
# comptabilite.html:7357 depose ici, en session. Les policies du dossier
# visent `anon`. Ce test dit si la fonction marche, il ne la repare pas.
deposer 'J1 justificatifs/ en session' "justificatifs/FIXTURE-CLOTURE-$(date +%s).txt" "$T_DIR" accepte

echo
echo '════════ SESSION RESPONSABLE ADMINISTRATIF ════════'
echo '  (DirecteurApp.jsx:765-1152 : le RA atteint l onglet Dossiers,'
echo '   donc il doit lire les pieces. Constate dans le code, pas suppose.)'
T_RA=$(connexion 'responsable administratif'); etat=$?
if [ $etat -eq 0 ]; then
  echo
  lire 'R1 photo eleve'      "$PHOTO" "$T_RA" lit
  lire 'R2 signature parent' "$SIGNA" "$T_RA" lit
  R_PIECE=$(decouvrir_piece "$T_RA")
  if [ -z "$R_PIECE" ]; then rouge 'R3 aucune piece listee — le RA ne voit rien'
  else lire 'R3 piece du dossier' "$R_PIECE" "$T_RA" lit; fi
elif [ $etat -eq 2 ]; then echo '  R1-R3 non executes'
else rouge 'session RA non ouverte'; fi

echo
echo '════════ TEMOIN NEGATIF · G7 ════════'
# Une garde qui ne sait pas echouer ne prouve rien. Un enseignant ne doit
# RIEN lire de ce bucket, et ne doit RIEN pouvoir y deposer.
T_PROF=$(connexion 'enseignant'); etat=$?
if [ $etat -eq 0 ]; then
  lire 'N1 enseignant lit une piece' "${PIECE:-$PHOTO}" "$T_PROF" refuse
  lire 'N2 enseignant lit la photo'  "$PHOTO"           "$T_PROF" refuse
  deposer 'N3 enseignant depose une signature' 'signatures-direction/FIXTURE-INTRUS.txt' "$T_PROF" refuse
elif [ $etat -eq 2 ]; then
  echo '  N1-N3 non executes — la restriction reste NON PROUVEE'
  KO=$((KO+1))
else rouge 'session enseignant non ouverte'; fi

echo
echo '═══════════════════════════════════════'
echo "  $OK PASS · $KO FAIL"
[ $KO -eq 0 ] && echo '  DOSSIERS ENFANTS : WORKFLOW PROUVE' || echo '  A CORRIGER'
if [ ${#ORPHELINS[@]} -gt 0 ]; then
  echo
  echo '  Objets deposes par cette recette — a supprimer au tableau de bord'
  echo '  (Storage > inscriptions > selectionner > Delete) :'
  for o in "${ORPHELINS[@]}"; do echo "    $o"; done
fi
rm -f /tmp/ideal-l.bin /tmp/ideal-d.json /tmp/ideal-fx.txt
