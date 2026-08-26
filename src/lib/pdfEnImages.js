// Un PDF joint devient N images — une par page.
//
// ── Pourquoi au DÉPÔT, et non à l'impression ──────────────────────────────
//
// Le document imprimable ne sait manipuler que des images : c'est ce que
// toute la chaîne — pagination, pleine page, JPEG, WhatsApp — traite déjà.
// Rastériser au moment d'imprimer obligerait le téléphone de l'enseignant à
// refaire le travail à chaque aperçu, pour chaque élève du publipostage.
//
// On le fait donc une fois, quand la fiche est déposée. Ensuite, un PDF de
// trois pages est indiscernable de trois photos : rien en aval n'a besoin de
// savoir qu'il a existé.
//
// ── Pourquoi un import dynamique ──────────────────────────────────────────
//
// `pdfjs-dist` pèse plus lourd que tout le reste du portail. Un enseignant
// qui consulte son emploi du temps n'a aucune raison de le télécharger. Il
// n'est demandé qu'au moment où un PDF est réellement choisi — donc jamais
// au démarrage.

// L'échelle de rendu. 2 donne ~150 dpi sur une page A4 : lisible à
// l'impression sans produire des fichiers que le réseau de l'école ne passe
// pas. Au-delà, le poids double sans gain visible sur du papier ordinaire.
export const ECHELLE_RENDU = 2

/**
 * L'invariant du lot : un PDF de N pages donne N images. Ni plus, ni moins.
 *
 * Isolé pour être éprouvé sans navigateur — le rendu, lui, exige un canvas.
 * Rend un message quand le compte ne tombe pas juste,  sinon. Un
 * document amputé qui passerait pour complet est le seul défaut que ce
 * module puisse produire sans qu'on s'en aperçoive.
 */
export const ecartDePages = (pagesSource, imagesRendues, nom = 'le document') =>
  pagesSource === imagesRendues
    ? null
    : `« ${nom} » compte ${pagesSource} page(s) mais ${imagesRendues} ont été rendues`

export const estFichierPdf = (f) =>
  /\.pdf$/i.test(f?.name || '') || f?.type === 'application/pdf'

// Rien de ce qui suit ne doit pouvoir attendre indéfiniment. Un worker qui ne
// démarre pas laisse `getDocument` en suspens POUR TOUJOURS : l'écran reste
// sur « Lecture… » et l'enseignant n'apprend jamais ce qui s'est passé. Une
// panne doit se dire.
const DELAI_MAX_MS = 20000
const avecDelai = (promesse, quoi) => Promise.race([
  promesse,
  new Promise((_, rejeter) => setTimeout(
    () => rejeter(new Error(`${quoi} n'a pas répondu en ${DELAI_MAX_MS / 1000} s`)), DELAI_MAX_MS)),
])

let moteur = null
const chargerMoteur = async () => {
  if (moteur) return moteur
  const pdfjs = await avecDelai(import('pdfjs-dist'), 'le lecteur de PDF')
  // Le worker est instancié explicitement plutôt que désigné par une URL :
  // `workerSrc` pointant sur un chemin que le bundler n'a pas produit ne
  // provoque aucune erreur — pdf.js attend simplement un worker qui ne
  // viendra jamais. `new Worker(new URL(...))` échoue franchement si le
  // fichier manque.
  const worker = new Worker(
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' })
  pdfjs.GlobalWorkerOptions.workerPort = worker
  moteur = pdfjs
  return moteur
}

/**
 * Rend chaque page d'un PDF en un fichier image.
 *
 * Renvoie `{ pages, images, erreur }` :
 *   pages   le nombre de pages du PDF SOURCE
 *   images  un `File` par page, dans l'ordre
 *   erreur  un message lisible, ou null
 *
 * `pages` et `images.length` doivent toujours coïncider. C'est la seule
 * garantie qui compte : un PDF de trois pages qui n'en rendrait qu'une
 * passerait autrement pour un document complet.
 */
export async function pdfEnImages(fichier, surProgres = null) {
  let pdfjs
  try {
    pdfjs = await chargerMoteur()
  } catch (e) {
    return { pages: 0, images: [], erreur: `le lecteur de PDF n'a pas pu être chargé (${e.message})` }
  }

  let doc
  try {
    const donnees = new Uint8Array(await fichier.arrayBuffer())
    // Les polices standard et les tables de caracteres sont servies depuis
    // /public. Sans elles, pdf.js les cherche a une adresse qui n'existe pas
    // et le rendu N'ABOUTIT JAMAIS -- mesure : page.render() reste en
    // suspens, sans erreur. Une panne muette de plus.
    doc = await avecDelai(pdfjs.getDocument({
      data: donnees,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
    }).promise, `« ${fichier.name} »`)
  } catch (e) {
    return { pages: 0, images: [], erreur: `« ${fichier.name} » n'a pas pu être lu (${e.message})` }
  }

  const pages = doc.numPages
  const images = []
  const base = String(fichier.name || 'document').replace(/\.pdf$/i, '')

  for (let n = 1; n <= pages; n++) {
    // L'orientation vient du PDF lui-même : `getViewport` applique la
    // rotation déclarée. Une page paysage ressort paysage.
    const page = await doc.getPage(n)
    const vue = page.getViewport({ scale: ECHELLE_RENDU })
    const toile = document.createElement('canvas')
    toile.width = Math.floor(vue.width)
    toile.height = Math.floor(vue.height)
    const ctx = toile.getContext('2d')
    // Le PDF n'a pas de fond : sans ce remplissage, les zones vides sortent
    // noires en JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, toile.width, toile.height)
    // `intent: 'print'` n'est pas un detail. Sans lui, pdf.js cadence son
    // rendu sur `requestAnimationFrame` -- qui NE TOURNE PAS dans un onglet
    // masque. Mesure : onglet cache, `render()` reste en suspens
    // indefiniment ; onglet visible, il aboutit. Une enseignante qui change
    // d'application pendant l'envoi verrait sa conversion se figer.
    //
    // Ce mode est de toute facon le bon : on rasterise POUR IMPRIMER.
    await avecDelai(page.render({ canvasContext: ctx, viewport: vue, intent: 'print' }).promise, `la page ${n}`)

    const blob = await new Promise(r => toile.toBlob(r, 'image/jpeg', 0.92))
    if (!blob) {
      return { pages, images, erreur: `la page ${n} de « ${fichier.name} » n'a pas pu être convertie` }
    }
    // Le rang est dans le NOM : l'ordre survit ainsi au stockage, qui ne
    // garantit rien, et se lit sur le papier.
    images.push(new File([blob], `${base} — page ${n} sur ${pages}.jpg`, { type: 'image/jpeg' }))
    if (surProgres) surProgres(n, pages)
    toile.width = toile.height = 0   // libère la mémoire du téléphone
  }

  // La garantie, vérifiée ici et pas seulement dans les tests : si le compte
  // ne tombe pas juste, on le dit plutôt que de livrer un document amputé.
  const manque = ecartDePages(pages, images.length, fichier.name)
  return manque ? { pages, images, erreur: manque } : { pages, images, erreur: null }
}
