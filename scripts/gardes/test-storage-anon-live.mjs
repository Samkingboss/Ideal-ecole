// Gardes COMPORTEMENTALES sur le bucket privé `inscriptions`, sans compte.
//
// Ce fichier interroge la production avec la clé publiable — celle que
// n'importe quel visiteur lit dans le source du formulaire d'inscription.
// C'est exactement le pouvoir d'un inconnu. Rien n'est écrit.
//
// POURQUOI PAS UNE LECTURE DE `pg_policies` : une policy bien nommée ne
// prouve rien. On a fermé ce bucket une première fois sur des noms devinés,
// et les trois vraies policies portaient d'autres noms. Ici on demande les
// octets ; s'ils arrivent, la garde tombe.
//
// LE SUJET DE TEST. Storage rend « Object not found » aussi bien pour caché
// que pour inexistant : un chemin inventé rendrait un faux PASS. On vise donc
// un objet dont l'existence est PROUVÉE par une session autorisée —
// `verif-storage-direction.sh`, contrôles D1 et R1, 34 241 octets reçus.
// Si cet objet disparaît, D1 tombe et cette garde devient sans objet : les
// deux se surveillent.

import { readFileSync } from 'node:fs'

const URL_BASE = 'https://jircuneixzwsmtktxrkh.supabase.co'
const TEMOIN = 'photos/26-27 A002.jpg'   // existence prouvée par D1/R1
const KEY = (readFileSync('public/inscription.html', 'utf8')
  .match(/SUPABASE_KEY = '([^']+)'/) || [])[1]

let echecs = 0
const V = '\x1b[0;32m', R = '\x1b[0;31m', G = '\x1b[0;90m', F = '\x1b[0m'
const verifier = (nom, ok, detail = '') => {
  console.log(`  ${nom.padEnd(58)} ${ok ? V + '✓' : R + '✗'}${F}${detail ? ' ' + G + detail + F : ''}`)
  if (!ok) echecs++
}

// ── LES JUGES, isolés pour être auto-testables ────────────────────────────
//
// Aucun ne regarde le statut seul. Sous RLS un refus de lecture Storage se
// présente en 400 { Object not found } et un refus de liste en 200 [] : lire
// le code HTTP confondrait « refusé » avec « en erreur », et « vide » avec
// « autorisé ».
export const aucunOctet = (statut, taille) => !(statut === 200 && taille > 500)
export const listeVide = (statut, corps) => {
  if (statut !== 200) return true
  try { return Array.isArray(JSON.parse(corps)) && JSON.parse(corps).length === 0 }
  catch { return false }
}
export const signatureRefusee = corps => !/signedURL/i.test(corps)

const entetes = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const enc = c => c.split('/').map(encodeURIComponent).join('/')

console.log(`\n${G}── STORAGE anon · le pouvoir d'un inconnu         [INV-SECURITE]${F}`)

if (!KEY) {
  console.log(`  ${R}ABANDON : clé publiable introuvable dans public/inscription.html${F}\n`)
  process.exit(1)
}

// ── G1 · le bucket n'est pas public ───────────────────────────────────────
{
  const r = await fetch(`${URL_BASE}/storage/v1/object/public/inscriptions/${enc(TEMOIN)}`)
  const buf = await r.arrayBuffer()
  verifier('G1 route publique : aucun octet', aucunOctet(r.status, buf.byteLength),
    `http ${r.status} · ${buf.byteLength} o`)
}

// ── G2/G3 · anon ne lit pas un objet existant ─────────────────────────────
{
  const r = await fetch(`${URL_BASE}/storage/v1/object/inscriptions/${enc(TEMOIN)}`, { headers: entetes })
  const buf = await r.arrayBuffer()
  verifier('G3 lecture authentifiée-anon : aucun octet', aucunOctet(r.status, buf.byteLength),
    `http ${r.status} · ${buf.byteLength} o`)
}

// ── G2 · aucune liste ─────────────────────────────────────────────────────
for (const prefix of ['', 'photos', 'signatures', 'documents']) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/list/inscriptions`, {
    method: 'POST', headers: { ...entetes, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 100 }),
  })
  const corps = await r.text()
  verifier(`G2 liste « ${prefix || 'racine'} » : rien`, listeVide(r.status, corps),
    `http ${r.status} · ${corps.slice(0, 40)}`)
}

// ── G4 · anon n'obtient pas de lien signé ─────────────────────────────────
//
// La voie qui compte le plus : un lien signé anonyme annulerait la fermeture
// sans qu'aucune policy de lecture n'apparaisse.
{
  const r = await fetch(`${URL_BASE}/storage/v1/object/sign/inscriptions/${enc(TEMOIN)}`, {
    method: 'POST', headers: { ...entetes, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 60 }),
  })
  const corps = await r.text()
  verifier('G4 lien signé : refusé', signatureRefusee(corps), `http ${r.status}`)
}

// ── G13 · anon n'atteint pas la validation d'un dossier ───────────────────
//
// Le bucket n'est qu'une moitié du sujet. `valider_inscription_direction`
// était `grant execute … to anon` et ne vérifiait aucun droit : avec la seule
// clé publiable on recevait `inscription_introuvable` — la logique métier,
// pas un refus. Et l'identifiant n'est pas un secret : `creer_inscription`
// rend `inscription_id` au parent qui vient de déposer. Ce parent tenait donc
// l'identifiant de son propre dossier et pouvait le valider lui-même.
//
// L'UUID nul ne correspond à aucun dossier : la garde ne peut rien valider.
export const validationRefusee = corps =>
  /42501|permission denied|validation_reservee_direction|PGRST202/i.test(corps)
{
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/valider_inscription_direction`, {
    method: 'POST', headers: { ...entetes, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_inscription_id: '00000000-0000-0000-0000-000000000000',
      p_signature_chemin: 'x', p_directeur_nom: 'x',
    }),
  })
  const corps = await r.text()
  verifier('G13 validation d\'un dossier : hors de portée', validationRefusee(corps),
    `http ${r.status} · ${corps.slice(0, 46)}`)
}

// ── AUTO-TESTS · une garde qui ne sait pas échouer ne prouve rien ─────────
console.log(`\n${G}  auto-tests des juges${F}`)
const auto = (nom, obtenu, attendu) => verifier(nom, obtenu === attendu)

auto('aucunOctet · 200 + 34 241 o (fuite)',   aucunOctet(200, 34241), false)
auto('aucunOctet · 200 + 88 o (JSON)',        aucunOctet(200, 88),    true)
auto('aucunOctet · 400 + 88 o (refus RLS)',   aucunOctet(400, 88),    true)
auto('aucunOctet · 200 + 501 o (petite img)', aucunOctet(200, 501),   false)
auto('listeVide · 200 + []',                  listeVide(200, '[]'),   true)
auto('listeVide · 200 + un objet (fuite)',    listeVide(200, '[{"name":"a.jpg"}]'), false)
auto('listeVide · 400 + erreur',              listeVide(400, '{"error":"x"}'), true)
auto('listeVide · 200 + corps illisible',     listeVide(200, 'nginx'), false)
auto('signatureRefusee · lien délivré',       signatureRefusee('{"signedURL":"/object/sign/…"}'), false)
auto('signatureRefusee · refus',              signatureRefusee('{"error":"not_found"}'), true)
auto('validationRefusee · metier atteint',    validationRefusee('{"code":"P0001","message":"inscription_introuvable"}'), false)
auto('validationRefusee · dossier valide !',  validationRefusee('{"ok":true,"matricule":"26-27 A099"}'), false)
auto('validationRefusee · droit retire',      validationRefusee('{"code":"42501","message":"permission denied for function"}'), true)
auto('validationRefusee · garde interne',     validationRefusee('{"code":"P0001","message":"validation_reservee_direction"}'), true)

console.log(echecs === 0
  ? `\n  ${V}Bucket inscriptions : fermé à l'inconnu${F}\n`
  : `\n  ${R}${echecs} écart(s) — le bucket fuit ou une garde ment${F}\n`)
process.exit(echecs === 0 ? 0 : 1)
