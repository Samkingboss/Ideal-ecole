// Couche de données de la plateforme Devoirs & Élèves.
//
// La page rangeait tout dans le localStorage du navigateur : les élèves et
// les devoirs n'existaient que sur l'appareil qui les avait saisis. Deux
// enseignants sur deux téléphones ne voyaient pas les mêmes devoirs, la
// direction n'en voyait aucun, et vider le cache effaçait l'année.
//
// Ce fichier remplace ce stockage par Supabase, sans toucher à l'interface.
// Le principe : `students` et `homeworks` restent les mêmes tableaux, avec
// exactement les mêmes champs qu'avant — tout le code d'affichage,
// d'impression et de message aux parents continue de fonctionner tel quel.
// Seuls le chargement initial et les points de sauvegarde changent.
//
// Le devoir garde sa forme d'origine dans la colonne `contenu` (jsonb), et
// ses champs principaux sont recopiés dans les colonnes de la table pour
// rester lisibles par le reste de la plateforme — le compte directeur, les
// rapports, le portail React.

const SB_URL = 'https://jircuneixzwsmtktxrkh.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcmN1bmVpeHp3c210a3R4cmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzI0ODQsImV4cCI6MjA4Nzc0ODQ4NH0.MLAV60tPKhFP8BixVavW3SU-npe8YvS0lKQ493AYNls'
const _sb = supabase.createClient(SB_URL, SB_KEY)

// Correspondance nom de classe ↔ identifiant, pour traduire le `grade` de
// l'interface (« CP1 ») en `classe_id` de la base.
let _classes = []
const classeParNom = nom => _classes.find(c => c.nom === nom) || null

// Qui est connecté. La page est ouverte depuis le portail, qui a déposé la
// session dans le localStorage — c'est la seule chose qu'on continue d'y lire.
function utilisateurCourant() {
  try { return JSON.parse(localStorage.getItem('ideal_user') || 'null') } catch (e) { return null }
}

// ── Lecture ────────────────────────────────────────────────────────────────

async function chargerClasses() {
  const { data } = await _sb.from('classes').select('id, nom').order('ordre')
  _classes = data || []
  return _classes
}

// Les élèves, dans la forme attendue par l'interface : { id, name, grade }.
async function chargerEleves() {
  const { data, error } = await _sb
    .from('eleves').select('id, prenom, nom, classe_id, classes(nom)')
    .eq('actif', true).order('nom')
  if (error) { console.error('Élèves illisibles :', error.message); return [] }
  return (data || []).map(e => ({
    id: e.id,
    name: [e.prenom, e.nom].filter(Boolean).join(' ').trim(),
    grade: (e.classes && e.classes.nom) || '',
    centralKey: e.id,
  }))
}

// Les devoirs. `contenu` porte la forme d'origine ; les colonnes servent de
// secours pour les lignes créées ailleurs que sur cette page.
async function chargerDevoirs() {
  const { data, error } = await _sb
    .from('devoirs').select('*').order('created_at', { ascending: false })
  if (error) { console.error('Devoirs illisibles :', error.message); return [] }
  return (data || []).map(r => {
    const c = r.contenu || {}
    return {
      ...c,
      id: r.id,
      subject: c.subject || r.matiere || '',
      grade: c.grade || r.groupe || '',
      content: c.content || r.description || '',
      dueDate: c.dueDate || r.date_rendu || '',
      images: (r.fichiers || []).map(f => f.url),
      date: c.date || (r.date_donne
        ? new Date(r.date_donne + 'T00:00:00').toLocaleDateString('fr-FR')
        : ''),
    }
  })
}

// ── Écriture ───────────────────────────────────────────────────────────────

// Les exercices sont saisis en base64 par l'interface (lecture locale du
// fichier). On les dépose dans le bucket `devoirs` et on ne garde que les
// adresses : une image de cahier pèse plusieurs centaines de kilo-octets, et
// trente devoirs en base64 dépassaient déjà le quota du localStorage.
async function deposerImages(images, grade) {
  const deposees = []
  for (let i = 0; i < images.length; i++) {
    const src = images[i]
    if (typeof src !== 'string') continue
    if (!src.startsWith('data:')) { deposees.push({ url: src, nom: `image ${i + 1}` }); continue }
    const blob = await (await fetch(src)).blob()
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    const chemin = `${(grade || 'classe').replace(/[^a-zA-Z0-9-]/g, '_')}/${Date.now()}_${i + 1}.${ext}`
    const { error } = await _sb.storage.from('devoirs').upload(chemin, blob, { contentType: blob.type })
    if (error) throw new Error(`Image ${i + 1} refusée : ${error.message}`)
    deposees.push({ url: _sb.storage.from('devoirs').getPublicUrl(chemin).data.publicUrl, nom: `image ${i + 1}` })
  }
  return deposees
}

// Enregistre un devoir et renvoie l'objet tel que l'interface l'attend.
async function enregistrerDevoir(devoir) {
  const fichiers = await deposerImages(devoir.images || [], devoir.grade)
  const classe = classeParNom(devoir.grade)
  const u = utilisateurCourant()

  // `contenu` garde tout ce que l'interface manipule — type, période,
  // objectifs, barème, destinataires — que les colonnes ne savent pas porter.
  const contenu = { ...devoir, images: fichiers.map(f => f.url) }
  delete contenu.id

  const { data, error } = await _sb.from('devoirs').insert({
    user_id: u && u.id ? u.id : null,
    classe_id: classe ? classe.id : null,
    groupe: devoir.grade || null,
    matiere: devoir.subject || null,
    description: devoir.content || null,
    date_donne: new Date().toISOString().slice(0, 10),
    // `date_rendu` est obligatoire en base : sans date choisie, on retient le
    // jour même plutôt que de laisser l'enregistrement échouer.
    date_rendu: devoir.dueDate || new Date().toISOString().slice(0, 10),
    fichiers,
    fichier_url: fichiers[0] ? fichiers[0].url : null,
    fichier_nom: fichiers[0] ? fichiers[0].nom : null,
    contenu,
  }).select().single()

  if (error) throw new Error('Enregistrement refusé : ' + error.message)
  return { ...contenu, id: data.id, images: fichiers.map(f => f.url) }
}

async function supprimerDevoir(id) {
  const { error } = await _sb.from('devoirs').delete().eq('id', id)
  if (error) throw new Error('Suppression refusée : ' + error.message)
}

// Ajoute un élève. L'interface ne connaît qu'un nom complet ; la base sépare
// prénom et nom — le premier mot est le prénom, le reste le nom, ce qui est
// la convention déjà retenue ailleurs sur la plateforme.
async function enregistrerEleve(nomComplet, grade) {
  const classe = classeParNom(grade)
  if (!classe) throw new Error(`Classe « ${grade} » inconnue.`)
  const morceaux = nomComplet.trim().split(/\s+/)
  const prenom = morceaux.shift() || ''
  const nom = morceaux.join(' ')
  const { data, error } = await _sb.from('eleves')
    .insert({ prenom, nom, classe_id: classe.id, actif: true }).select().single()
  if (error) throw new Error('Élève refusé : ' + error.message)
  return { id: data.id, name: [prenom, nom].filter(Boolean).join(' '), grade, centralKey: data.id }
}

// Un élève retiré n'est pas effacé : il devient inactif, comme partout
// ailleurs sur la plateforme. Ses devoirs et ses notes gardent leur sens.
async function retirerEleve(id) {
  const { error } = await _sb.from('eleves').update({ actif: false }).eq('id', id)
  if (error) throw new Error('Retrait refusé : ' + error.message)
}

window.Donnees = {
  chargerClasses, chargerEleves, chargerDevoirs,
  enregistrerDevoir, supprimerDevoir,
  enregistrerEleve, retirerEleve,
  utilisateurCourant,
}
