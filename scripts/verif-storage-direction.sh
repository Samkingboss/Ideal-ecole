#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# BUCKET `inscriptions` — LES ACCÈS QUI EXIGENT UNE SESSION
# ═══════════════════════════════════════════════════════════════════════
#
# Les refus `anon` se testent sans compte : je les ai exécutés moi-même.
# Ces quatre-là exigent une session, donc cette commande.
#
# LES CODES D ACCÈS NE SORTENT PAS DE CETTE MACHINE : saisie masquée,
# jamais affichée, jamais dans l historique, jamais dans un fichier,
# effacée sitôt le jeton obtenu. La sortie ne contient que des verdicts.
#
# Deux comptes sont demandés : la direction, puis le responsable
# administratif. Répondre « - » à un identifiant saute ce compte.
#
# ÉCRITURE : le test D3 dépose un fichier témoin dans
# `signatures-direction/`. Il est nommé FIXTURE-STORAGE et listé en fin
# de sortie pour le ménage. Aucune donnée réelle n est touchée.
#
# Usage :  bash ~/Desktop/ideal-ecole/scripts/verif-storage-direction.sh

set -u
URL='https://jircuneixzwsmtktxrkh.supabase.co'
KEY=$(grep -oE "SUPABASE_KEY = '[^']+'" "$(dirname "$0")/../public/inscription.html" | sed "s/.*'\(.*\)'/\1/")
[ -z "$KEY" ] && { echo "ABANDON : cle introuvable dans public/inscription.html"; exit 1; }
DOMAINE='@comptes.ideal-ecole.ml'
OK=0; KO=0

# Objets réels, mesurés à 200 avant la fermeture. Si un GET authentifié
# les rend, la direction lit ; sinon elle est enfermée dehors.
PHOTO='photos/26-27%20A002.jpg'
SIGNA='signatures/26-27%20A002.png'
ACTE='documents/40d89eb9-fa2f-45e6-9d25-8363511e82e2/acte_naissance.png'

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
    if [ -n "$t" ]; then echo "  session $1 ouverte" >&2; printf '%s' "$t"; return 0; fi
    echo "  refuse (essai $essai sur 3)" >&2
  done
  return 1
}

# Un GET est jugé sur le CORPS, jamais sur le statut : sous RLS, un refus
# de lecture Storage se présente en « Object not found », pas en 403.
lire() {  # $1 libellé  $2 chemin  $3 jeton
  local code taille
  read -r code taille <<< "$(curl -sS -o /tmp/ideal-lecture.bin -w '%{http_code} %{size_download}' \
    -H "apikey: $KEY" -H "Authorization: Bearer $3" "$URL/storage/v1/object/inscriptions/$2")"
  if [ "$code" = '200' ] && [ "$taille" -gt 1000 ]; then
    echo "PASS  $1 — $taille o recus"; OK=$((OK+1))
  else
    echo "FAIL  $1 — http $code, $taille o : $(head -c 90 /tmp/ideal-lecture.bin | tr -d '\n')"; KO=$((KO+1))
  fi
}

echo
echo '════════ COMPTE DIRECTION ════════'
T_DIR=$(connexion 'direction') || { echo 'ABANDON : session direction non ouverte'; exit 1; }
echo
echo '--- Lecture des pieces (ce que l ecran Dossiers affiche) ---'
lire 'D1 photo eleve'         "$PHOTO" "$T_DIR"
lire 'D2 signature parent'    "$SIGNA" "$T_DIR"
lire 'D3 acte de naissance'   "$ACTE"  "$T_DIR"

echo
echo '--- D4 lien signe (ce qu appelle reellement InscriptionsValidation) ---'
rep=$(curl -sS -X POST -H "apikey: $KEY" -H "Authorization: Bearer $T_DIR" \
      -H 'Content-Type: application/json' -d '{"expiresIn":900}' \
      "$URL/storage/v1/object/sign/inscriptions/$SIGNA")
if printf '%s' "$rep" | grep -q 'signedURL'; then
  echo 'PASS  D4 lien signe delivre'; OK=$((OK+1))
else
  echo "FAIL  D4 lien signe refuse : $(printf '%s' "$rep" | head -c 110)"; KO=$((KO+1))
fi

echo
echo '--- D5 depot de la signature du directeur (validation d un dossier) ---'
# InscriptionsValidation.jsx:123 ecrit dans `signatures-direction/`.
# Aucune policy INSERT ne vise `authenticated` : ce test doit dire la verite,
# quelle qu elle soit.
echo 'FIXTURE-STORAGE' > /tmp/ideal-fixture.txt
rep=$(curl -sS -o /tmp/ideal-depot.json -w '%{http_code}' -X POST \
      -H "apikey: $KEY" -H "Authorization: Bearer $T_DIR" -H 'Content-Type: text/plain' \
      --data-binary @/tmp/ideal-fixture.txt \
      "$URL/storage/v1/object/inscriptions/signatures-direction/FIXTURE-STORAGE.txt")
if [ "$rep" = '200' ]; then
  echo 'PASS  D5 depot accepte — la validation d un dossier peut aboutir'; OK=$((OK+1))
else
  echo "FAIL  D5 depot refuse (http $rep) : $(head -c 110 /tmp/ideal-depot.json)"
  echo '      => la direction ne peut PAS signer un dossier. A corriger avant la rentree.'
  KO=$((KO+1))
fi

echo
echo '════════ COMPTE RESPONSABLE ADMINISTRATIF ════════'
echo '  (DirecteurApp.jsx:765-1152 : le RA atteint l onglet Dossiers,'
echo '   donc il doit lire les pieces. Verifie, pas suppose.)'
T_RA=$(connexion 'responsable administratif'); etat=$?
if [ $etat -eq 0 ]; then
  echo
  lire 'R1 photo eleve'       "$PHOTO" "$T_RA"
  lire 'R2 signature parent'  "$SIGNA" "$T_RA"
  lire 'R3 acte de naissance' "$ACTE"  "$T_RA"
elif [ $etat -eq 2 ]; then
  echo '  R1-R3 non executes'
else
  echo '  FAIL  session RA non ouverte'; KO=$((KO+1))
fi

echo
echo '════════ TEMOIN NEGATIF ════════'
# Une garde qui ne sait pas echouer ne prouve rien. Un compte enseignant
# ne doit RIEN lire de ce bucket. Repondre « - » saute ce controle, mais
# alors les PASS ci-dessus ne prouvent que l acces, pas la restriction.
T_PROF=$(connexion 'enseignant'); etat=$?
if [ $etat -eq 0 ]; then
  code=$(curl -sS -o /tmp/ideal-prof.bin -w '%{http_code}' \
         -H "apikey: $KEY" -H "Authorization: Bearer $T_PROF" \
         "$URL/storage/v1/object/inscriptions/$ACTE")
  taille=$(wc -c < /tmp/ideal-prof.bin | tr -d ' ')
  if [ "$code" = '200' ] && [ "$taille" -gt 1000 ]; then
    echo "FAIL  N1 un enseignant lit un acte de naissance ($taille o) — FUITE"; KO=$((KO+1))
  else
    echo 'PASS  N1 enseignant : aucun octet'; OK=$((OK+1))
  fi
else
  echo '  N1 non execute — la restriction reste non prouvee'
fi

echo
echo '═══════════════════════════════════════'
echo "  $OK PASS · $KO FAIL"
[ $KO -eq 0 ] && echo '  LECTURE DIRECTION/RA CONFORME' || echo '  A CORRIGER'
echo
echo '  Menage a prevoir si D5 a reussi :'
echo '    inscriptions/signatures-direction/FIXTURE-STORAGE.txt'
rm -f /tmp/ideal-lecture.bin /tmp/ideal-depot.json /tmp/ideal-prof.bin /tmp/ideal-fixture.txt
