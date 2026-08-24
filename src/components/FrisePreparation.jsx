import { raconter, ACTIONS } from '../lib/preparations'
import { libelleSection } from '../lib/remarques'

// La chronologie d'une préparation, rendue à l'identique des deux côtés.
//
// ── Pourquoi un composant partagé ──────────────────────────────────────────
//
// La direction voyait l'historique ; l'enseignante ne voyait rien. Non parce
// que la remarque manquait — elle est bien enregistrée dans
// `preparations.historique_statuts` — mais parce que `FichePreparation` ne
// chargeait que `id, contenu, heure_depot, sequence`. Le texte partait du
// serveur et l'écran ne le demandait jamais.
//
// Une enseignante lisait donc « à corriger » sans savoir quoi corriger.
//
// Deux rendus séparés auraient fini par diverger. Celui-ci lit la seule source
// — `historique_statuts` — par la seule fonction — `raconter()`. Ce que la
// direction écrit est exactement ce que l'enseignante lit.

const COULEURS = {
  [ACTIONS.correction_demandee]: { trait: '#b45309', fond: '#fffbeb', bord: '#fde68a' },
  [ACTIONS.validation]:         { trait: '#15803d', fond: '#f0fdf4', bord: '#bbf7d0' },
  [ACTIONS.depot]:              { trait: '#0284c7', fond: '#f0f9ff', bord: '#bae6fd' },
  [ACTIONS.modification]:       { trait: '#0284c7', fond: '#f0f9ff', bord: '#bae6fd' },
  [ACTIONS.reouverture]:        { trait: '#7e22ce', fond: '#faf5ff', bord: '#e9d5ff' },
}
const NEUTRE = { trait: '#64748b', fond: 'var(--bg)', bord: 'var(--border)' }

export default function FrisePreparation({ historique, titre = 'Historique', compact = false, contenu = null }) {
  const entrees = Array.isArray(historique) ? historique : []
  if (!entrees.length) return null

  // La plus récente en premier : ce qui vient d'arriver est ce qu'on cherche.
  const ordonnees = [...entrees].reverse()

  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
      }}>{titre} · {entrees.length}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 9 }}>
        {ordonnees.map((e, k) => {
          // La chronologie nomme la rubrique en clair, pas par sa clé.
          const r = raconter(e.section
            ? { ...e, section: libelleSection(e.section, contenu) }
            : e)
          const c = COULEURS[e.action] || NEUTRE
          return (
            <div key={k} style={{
              borderLeft: `3px solid ${c.trait}`, paddingLeft: 10,
              // `minWidth: 0` : sans lui, une remarque longue sans espace
              // pousse la colonne hors de l'écran sur un téléphone.
              minWidth: 0,
            }}>
              <div style={{ fontSize: compact ? 11 : 12.5, fontWeight: 700, color: 'var(--text)',
                            overflowWrap: 'anywhere' }}>
                {r.texte}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1 }}>{r.quand}</div>
              {/* La remarque de la direction. C'est elle qui manquait, et
                  c'est elle qui dit à l'enseignante ce qu'elle doit corriger :
                  elle est mise en évidence, pas reléguée en note de bas de
                  page. */}
              {r.commentaire && (
                <div style={{
                  marginTop: 5, padding: '8px 10px', borderRadius: 8,
                  background: c.fond, border: `1px solid ${c.bord}`,
                  fontSize: compact ? 11.5 : 12.5, color: 'var(--text)',
                  lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                }}>
                  {r.commentaire}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
