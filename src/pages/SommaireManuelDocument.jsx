import React from 'react'
import html2canvas from 'html2canvas'
import DocumentPrintStudio from './DocumentPrintStudio'
import { manuelParCle, libelleUnite, libelleTome } from '../lib/programmes'

// Sommaire officiel paginé d'un manuel, imprimable et exportable.
//
// Ce document lisait autrefois un sommaire recopié à la main dans son propre
// JSX, alors que le même programme existait déjà dans `src/lib/programmes/`.
// Les deux copies avaient divergé : dix-huit titres s'écartaient, et les
// quatorze morceaux choisis de Boscher avaient perdu toutes leurs attributions
// d'auteur — Perrault, Daudet, Andersen, Anatole France — dans la seule
// version que l'enseignant avait en main.
//
// Le sommaire se lit désormais dans le manuel. Une donnée, une source.
//
// Conséquence directe : les vingt-deux manuels ont ce document, et non plus
// Boscher seul.

// Teintes de section. Le livre n'en porte aucune : elles ne sont qu'un repère
// visuel, attribué dans l'ordre des parties pour que deux sections voisines ne
// se confondent pas. Reprend la rotation du document validé par la direction.
const TEINTES = [
  { trait: '#047857', fond: '#f0fdf4', bordure: '#bbf7d0' },
  { trait: '#0284c7', fond: '#e0f2fe', bordure: '#bae6fd' },
  { trait: '#b45309', fond: '#fffbeb', bordure: '#fde68a' },
  { trait: '#7e22ce', fond: '#faf5ff', bordure: '#e9d5ff' },
  { trait: '#be123c', fond: '#fff1f2', bordure: '#fecdd3' },
  { trait: '#4338ca', fond: '#eef2ff', bordure: '#c7d2fe' },
]

// Nom de fichier sûr : sans accent, sans espace, sans caractère qu'un système
// de fichiers refuse.
const nomFichier = titre =>
  'Sommaire_' + String(titre || 'manuel')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)

// Étendue paginée d'un ensemble de leçons — « pages 4 à 13 », « page 58 ».
const etendue = lecons => {
  const pages = lecons.map(l => l.pageFin || l.page).concat(lecons.map(l => l.page))
                      .filter(p => typeof p === 'number')
  if (!pages.length) return ''
  const min = Math.min(...pages), max = Math.max(...pages)
  return min === max ? `page ${min}` : `pages ${min} à ${max}`
}

// Les parties du livre, quand il en déclare. Boscher groupe ses phases en trois
// parties via `rubrique` ; un manuel qui n'en a pas voit ses unités listées à
// plat, sous une partie unique et sans titre.
const partitionner = unites => {
  const parties = []
  // Le rang sert à choisir la teinte. Il est fixé ici, à la construction, et
  // non pendant le rendu : une variable mutée en cours de rendu n'a pas de
  // valeur stable entre deux passes de React.
  unites.forEach((u, rang) => {
    const nom = u.rubrique || null
    const derniere = parties[parties.length - 1]
    if (derniere && derniere.nom === nom) derniere.unites.push({ ...u, rang })
    else parties.push({ nom, unites: [{ ...u, rang }] })
  })
  return parties
}

// Le titre d'une section répète-t-il celui de sa partie ? On compare le titre
// nu, la partie étant préfixée de son rang — « Deuxième partie — L'alphabet »
// contre « L'alphabet ».
const redondant = (partie, unite) => {
  if (!partie.nom || partie.unites.length > 1) return false
  const nu = s => String(s || '').replace(/^.*?—\s*/, '').trim().toLowerCase()
  return nu(partie.nom) === nu(unite.titre)
}

const Entree = ({ repere, texte, teinte }) => (
  <div style={{
    background: teinte.fond, border: `1px solid ${teinte.bordure}`,
    padding: '6px 10px', borderRadius: 6, fontSize: 12, display: 'flex', gap: 8,
  }}>
    <span style={{ fontWeight: 900, color: teinte.trait, minWidth: 55 }}>{repere} :</span>
    <span style={{ fontWeight: 700, color: '#1e293b' }}>{texte}</span>
  </div>
)

const Grille = ({ children, min = 260 }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
    gap: 6,
  }}>{children}</div>
)

export default function SommaireManuelDocument({ manuel = null, cle = 'lecture-cp2', onClose = null }) {
  const livre = manuel || manuelParCle(cle)

  // Un manuel introuvable est une erreur de programmation, pas une donnée
  // manquante : on le dit, plutôt que d'imprimer un document vide.
  if (!livre) {
    return (
      <DocumentPrintStudio type="pedagogie" documentTitle="SOMMAIRE INDISPONIBLE" onClose={onClose}>
        <div style={{ padding: 24, fontSize: 13, color: '#be123c', fontWeight: 700 }}>
          Aucun manuel ne correspond à la référence « {cle} ». Signalez-le à la direction.
        </div>
      </DocumentPrintStudio>
    )
  }

  const zoneId = 'sommaire-manuel-print-area'
  const parties = partitionner(livre.unites || [])
  const plates  = !livre.unites?.length && livre.lecons?.length ? livre.lecons : null
  const total   = (livre.unites || []).flatMap(u => u.lecons).length || (livre.lecons || []).length

  const handleExportJpeg = async () => {
    const elem = document.getElementById(zoneId)
    if (!elem) return
    try {
      const canvas = await html2canvas(elem, {
        scale: 3, useCORS: true, backgroundColor: '#fffdfa', logging: false,
      })
      const link = document.createElement('a')
      link.download = nomFichier(livre.titre) + '.jpg'
      link.href = canvas.toDataURL('image/jpeg', 0.98)
      link.click()
    } catch (err) {
      console.error(err)
      alert('Téléchargement impossible : ' + (err.message || ''))
    }
  }

  // Repère d'une entrée : ce que le livre imprime lui-même. Un manuel numéroté
  // se cite par sa leçon, un manuel paginé par sa page — annoncer « leçon 4 »
  // là où 4 est un numéro de page tromperait l'enseignant.
  const repereDe = l => {
    const p = l.pageFin && l.pageFin !== l.page ? `Pages ${l.page}–${l.pageFin}` : `Page ${l.page}`
    if (livre.numerote === false) return l.tome ? `${libelleTome(livre)} ${l.tome}, ${p.toLowerCase()}` : p
    return `Leçon ${l.numero}`
  }

  return (
    <DocumentPrintStudio
      type="pedagogie"
      documentTitle={`${livre.titre.toUpperCase()} — SOMMAIRE OFFICIEL PAGINÉ`}
      subTitlePill={`📖 ${livre.matiere} · ${livre.groupe} · ${total} séances`}
      onClose={onClose}
      onPrint={handleExportJpeg}
    >
      <div className="no-print" style={{ marginBottom: 20, textAlign: 'center' }}>
        <button
          onClick={handleExportJpeg}
          style={{
            background: 'linear-gradient(135deg, #047857, #0284c7)', color: '#ffffff',
            border: 'none', padding: '12px 26px', borderRadius: 14, fontWeight: 900,
            fontSize: 14, cursor: 'pointer', boxShadow: '0 6px 20px rgba(4,120,87,0.35)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          📸 Télécharger le sommaire (JPEG HD)
        </button>
      </div>

      <div id={zoneId} style={{ background: '#fffdfa', padding: '24px 18px', borderRadius: 20 }}>

        <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '2px double #d97706' }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{livre.titre}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginTop: 4 }}>
            {livre.matiere} · {livre.groupe} · {total} séances
          </div>
        </div>

        {/* Pages liminaires : présentes au sommaire, jamais comptées comme
            séances — c'est la règle posée par le manuel lui-même. */}
        {livre.liminaire?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              background: '#f1f5f9', color: '#0f172a', padding: '8px 14px', borderRadius: 8,
              fontSize: 13, fontWeight: 900, marginBottom: 10,
            }}>
              🏛️ Pages liminaires — hors progression
            </div>
            <Grille min={280}>
              {livre.liminaire.map((e, i) => (
                <div key={i} style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>
                    {String(e.page).includes('–') || String(e.page).includes('-') ? 'Pages' : 'Page'} {e.page} :
                  </span>{' '}
                  {e.titre}
                </div>
              ))}
            </Grille>
          </div>
        )}

        {/* Manuel sans unités : une liste continue, comme « Pas à Pas, je lis ». */}
        {plates && (
          <Grille>
            {plates.map((l, i) => <Entree key={i} repere={repereDe(l)} texte={l.titre} teinte={TEINTES[0]} />)}
          </Grille>
        )}

        {parties.map((partie, ip) => (
          <div key={ip} style={{ marginBottom: 24 }}>
            {partie.nom && (
              <div style={{
                background: '#0f172a', color: '#fff', padding: '8px 14px', borderRadius: 8,
                fontSize: 14, fontWeight: 900, marginBottom: 12,
              }}>
                {partie.nom} ({etendue(partie.unites.flatMap(u => u.lecons))} du livre)
              </div>
            )}

            {partie.unites.map(u => {
              const teinte = TEINTES[u.rang % TEINTES.length]
              return (
                <div key={u.numero} style={{ marginBottom: 16 }}>
                  {/* Une partie qui ne contient qu'une section homonyme n'a pas
                      besoin de la réannoncer : « Deuxième partie — L'alphabet »
                      suivi de « L'alphabet » dirait deux fois la même chose. */}
                  {!redondant(partie, u) && (
                    <div style={{
                      fontSize: 13, fontWeight: 900, color: teinte.trait, marginBottom: 8,
                      borderBottom: '1px solid #e2e8f0', paddingBottom: 4,
                    }}>
                      🔹 {u.titre || `${libelleUnite(livre)} ${u.numero}`} ({etendue(u.lecons)})
                    </div>
                  )}
                  <Grille>
                    {u.lecons.map((l, i) => (
                      <Entree key={i} repere={repereDe(l)} texte={l.titre} teinte={teinte} />
                    ))}
                  </Grille>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </DocumentPrintStudio>
  )
}
