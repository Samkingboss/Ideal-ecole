#!/usr/bin/env bash
# Validation d un dossier, de bout en bout, sur une inscription FIXTURE.
# Appele par verif-storage-direction.sh — args : URL, KEY, JETON DIRECTION.
#
# AUCUN DOSSIER REEL N EST TOUCHE : le script ne travaille que sur une
# inscription dont le nom commence par FIXTURE-CLOTURE, et la cree lui-meme
# si elle n existe pas. S il n arrive pas a en obtenir une, il ECHOUE — il
# ne se rabat jamais sur un dossier d enfant.

set -u
URL="$1"; KEY="$2"; T="$3"
api() { curl -sS -H "apikey: $KEY" -H "Authorization: Bearer $T" "$@"; }
etape() { printf '   %-52s ' "$1"; }

# ── 1 · trouver ou creer la fixture ───────────────────────────────────
etape '1 dossier fixture'
FIX=$(api "$URL/rest/v1/inscriptions?nom=like.FIXTURE-CLOTURE*&statut=eq.en_attente&select=id,signature_chemin&limit=1" \
  | python3 -c 'import sys,json
d=json.load(sys.stdin)
print(d[0]["id"] if d and d[0].get("signature_chemin") else "")' 2>/dev/null)

if [ -z "$FIX" ]; then
  # La classe doit exister, sinon la validation leve `classe_introuvable`.
  CLASSE=$(api "$URL/rest/v1/classes?select=nom&order=ordre&limit=1" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["nom"] if d else "")' 2>/dev/null)
  if [ -z "$CLASSE" ]; then echo 'ECHEC — aucune classe lisible'; exit 1; fi
  # `signature_chemin` doit pointer un objet reel : on le depose d abord.
  SIG="signatures/FIXTURE-CLOTURE-$(date +%s).png"
  echo 'FIXTURE' > /tmp/ideal-sig.txt
  api -o /dev/null -X POST -H 'Content-Type: text/plain' --data-binary @/tmp/ideal-sig.txt \
      "$URL/storage/v1/object/inscriptions/$SIG"
  REP_CREATION=$(api -X POST "$URL/rest/v1/rpc/creer_inscription" -H 'Content-Type: application/json' \
    -d "{\"p_dossier\":{\"eleve\":{\"nom\":\"FIXTURE-CLOTURE\",\"prenom\":\"Recette\",\"date_naissance\":\"2018-01-01\",\"sexe\":\"M\",\"classe_demandee\":\"$CLASSE\"},\"responsable1\":{\"nom\":\"FIXTURE-CLOTURE\",\"prenom\":\"Parent\",\"tel1\":\"+22300000000\"},\"fichiers\":{\"signature_chemin\":\"$SIG\"}}}")
echo "REPONSE_BRUTE creer_inscription : $REP_CREATION"
FIX=$(printf '%s' "$REP_CREATION" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("inscription_id") or "")' 2>/dev/null || true)
  [ -z "$FIX" ] && { echo 'ECHEC — fixture non creee'; exit 1; }
  echo "creee ($FIX)"
else
  echo "reutilisee ($FIX)"
fi

# ── 2 · les pieces du dossier se lisent ───────────────────────────────
etape '2 pieces du dossier lisibles'
api "$URL/rest/v1/documents_inscription?inscription_id=eq.$FIX&select=type,chemin" >/dev/null \
  && echo 'ok' || { echo 'ECHEC'; exit 1; }

# ── 3 · lien signe sur la signature du parent ─────────────────────────
etape '3 lien signe sur la signature parent'
CHEMIN=$(api "$URL/rest/v1/inscriptions?id=eq.$FIX&select=signature_chemin" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["signature_chemin"] if d else "")' 2>/dev/null)
if [ -z "$CHEMIN" ]; then echo 'ECHEC — pas de signature parent'; exit 1; fi
api -X POST -H 'Content-Type: application/json' -d '{"expiresIn":900}' \
    "$URL/storage/v1/object/sign/inscriptions/$(printf '%s' "$CHEMIN" | sed 's/ /%20/g')" \
  | grep -q signedURL && echo 'ok' || { echo 'ECHEC — lien refuse'; exit 1; }

# ── 4 · depot de la signature du directeur ────────────────────────────
etape '4 depot signatures-direction/'
SD="signatures-direction/$FIX-$(date +%s).png"
echo 'FIXTURE' > /tmp/ideal-sd.txt
code=$(api -o /tmp/ideal-sd.json -w '%{http_code}' -X POST -H 'Content-Type: text/plain' \
       --data-binary @/tmp/ideal-sd.txt "$URL/storage/v1/object/inscriptions/$SD")
[ "$code" = '200' ] && echo 'ok' || { echo "ECHEC (http $code) : $(head -c 90 /tmp/ideal-sd.json)"; exit 1; }

# ── 5 · la validation metier aboutit ──────────────────────────────────
etape '5 valider_inscription_direction'
rep=$(api -X POST "$URL/rest/v1/rpc/valider_inscription_direction" -H 'Content-Type: application/json' \
  -d "{\"p_inscription_id\":\"$FIX\",\"p_signature_chemin\":\"$SD\",\"p_directeur_nom\":\"Recette de cloture\"}")
if printf '%s' "$rep" | grep -q '"ok":[[:space:]]*true'; then echo 'ok'
else echo "ECHEC : $(printf '%s' "$rep" | head -c 130)"; exit 1; fi

# ── 6 · rien de tout cela n a ouvert quoi que ce soit a anon ──────────
etape '6 anon ne lit toujours pas la signature deposee'
read -r code taille <<< "$(curl -sS -o /dev/null -w '%{http_code} %{size_download}' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/storage/v1/object/inscriptions/$SD")"
if [ "$code" = '200' ] && [ "$taille" -gt 5 ]; then echo "ECHEC — FUITE ($taille o)"; exit 1; fi
echo 'ok'

echo "   objets fixture deposes : inscriptions/$SD"
rm -f /tmp/ideal-sig.txt /tmp/ideal-sd.txt /tmp/ideal-sd.json
exit 0
