import { readFileSync } from 'node:fs'

const source = readFileSync('src/pages/DirecteurApp.jsx', 'utf8')
let echecs = 0

const verifier = (nom, condition) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${nom}`)
  if (!condition) echecs += 1
}

verifier('un registre actif unique alimente la Direction et le Responsable administratif',
  /const requetePersonnelActif = \(\) => supabase\.from\('users'\)[\s\S]*?\.eq\('actif', true\)/.test(source)
  && (source.match(/requetePersonnelActif\(\)/g) || []).length >= 2)

verifier('toutes les fonctions creees sont conservees dans la liste',
  !/requetePersonnelActif[\s\S]{0,300}\.in\('role'/.test(source)
  && !/requetePersonnelActif[\s\S]{0,300}\.eq\('role'/.test(source))

verifier('le Responsable administratif suit les créations et modifications du personnel',
  /personnel-administration-[\s\S]*?table: 'users'/.test(source))

verifier('les affectations de classes sont elles aussi synchronisées',
  /personnel-administration-[\s\S]*?table: 'prof_classes'/.test(source))

verifier('le retour au premier plan force une remise à jour',
  /document\.addEventListener\('visibilitychange', auRetour\)/.test(source)
  && /document\.visibilityState === 'visible'/.test(source))

verifier('un contrôle de secours couvre une connexion Realtime suspendue',
  /setInterval\(synchroniser, 30000\)/.test(source)
  && /clearInterval\(controleSecours\)/.test(source))

verifier('la session RH annonce clairement tout le personnel actif',
  source.includes('Tout le personnel actif')
  && source.includes('La liste se synchronise automatiquement avec les comptes créés par la Direction.'))

process.exit(echecs ? 1 : 0)
