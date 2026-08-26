import { readFileSync } from 'node:fs'

const lire = fichier => readFileSync(fichier, 'utf8')
const directeur = lire('src/pages/DirecteurApp.jsx')
const composant = lire('src/pages/ComptabiliteRA.jsx')
const css = lire('src/pages/ComptabiliteRA.css')
const app = lire('src/App.jsx')
let echecs = 0
const verifier = (nom, condition) => {
  console.log(`${condition ? '✓' : '✗'} ${nom}`)
  if (!condition) echecs++
}

const blocRa = directeur.match(/if \(user\.role === 'responsable_administratif'\)[\s\S]*?INTERFACE DIRECTEUR/)?.[0] || ''

verifier('C1 · le clic Comptabilité reste dans le document React',
  /setTab\('compta'\)/.test(blocRa) && !/href="\/comptabilite\.html"/.test(blocRa))
verifier('C2 · le module reçoit le client de la session existante',
  /<ComptabiliteRA supabase=\{supabase\} user=\{user\}/.test(blocRa)
  && !/createClient|storageKey/.test(composant))
verifier('C3 · la vue native est rendue dans le layout RA',
  /data-comptabilite-native="true"/.test(composant) && /className="page-content/.test(blocRa))
verifier('C4 · les fonctions principales sont présentes',
  ['enregistrer_paiement', 'Recouvrement', 'Charges', 'Trésorerie', 'SYSCOHADA', 'Export CSV', 'Historique',
    'Encaissement famille', 'Réduction', 'contre-passation', 'Grand livre', 'Balance', 'Plan comptable',
    'Nouvelle écriture', 'Justificatif', 'Synchroniser les inscriptions', 'Nouvel élève comptable',
    'Prévisions', 'Salaires & paie', 'Caisse disponible', 'Recouvrement urgent', 'Débiteurs prioritaires']
    .every(terme => composant.includes(terme)))
verifier('C5/C6 · lecture et écriture RA passent par les surfaces existantes',
  /from\('financement_params'\)\.select/.test(composant)
  && /rpc\('enregistrer_paiement'/.test(composant))
verifier('C7/C8 · aucun contournement RLS ni clé privilégiée',
  !/service[_-]?role|SUPABASE_ANON_KEY|createClient/.test(composant))
verifier('C9 · aucune policy ou migration embarquée dans la vue',
  !/create policy|alter table|storage\.from/.test(composant.toLowerCase()))
verifier('C10 · garde responsive sans débordement global',
  /@media \(max-width:600px\)/.test(css) && /overflow-x:auto/.test(css)
  && /max-height:calc\(100vh - 32px\)/.test(css))
verifier('C11 · aucun lien RA vers la page standalone', !/comptabilite\.html/.test(blocRa))
verifier('C12 · retour Élèves/RH conservé dans le même état React',
  /setTab\('eleves'\)/.test(blocRa) && /setTab\('rh'\)/.test(blocRa)
  && /responsable_administratif/.test(app))
verifier('C13 · synchronisation automatique, dédoublonnée et sans écriture dans les inscriptions',
  /Promise\.all/.test(composant)
  && /from\('inscriptions'\)\.select/.test(composant)
  && /sourceInscription/.test(composant)
  && /matricules\.has/.test(composant)
  && /inscription\.statut !== 'validee'/.test(composant)
  && /eq\('updated_at', comptabilite\.data\.updated_at\)/.test(composant)
  && !/from\('inscriptions'\)\.(insert|update|delete|upsert)/.test(composant))
verifier('C14 · cockpit caisse, prévision 90 élèves et masse salariale sont revenus',
  /situationCaisse/.test(composant)
  && /CourbeCaisse/.test(composant)
  && /BarresFinancieres/.test(composant)
  && /EFFECTIFS_PREVISIONNELS/.test(lire('src/lib/comptabiliteRA.js'))
  && /totalSauve === 90/.test(lire('src/lib/comptabiliteRA.js'))
  && /enregistrerSalaires/.test(composant)
  && ['État mensuel de paie','Primes','Retenues','Masse nette'].every(terme => composant.includes(terme)))

console.log(echecs ? `\n${echecs} garde(s) en échec.` : '\n14 contrôles au vert.')
process.exit(echecs ? 1 : 0)
