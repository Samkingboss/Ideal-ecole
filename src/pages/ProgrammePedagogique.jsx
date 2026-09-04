import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  manuelsPour, leconsDe, avancement, aDesUnites,
  pagesDe, situationDe, libelleUnite,
} from '../lib/programmes'
import SommaireManuelDocument from './SommaireManuelDocument'
import ProgrammeMaternelleAnnuel from './ProgrammeMaternelleAnnuel'

// Le programme de l'enseignant, organisé comme l'école le pense.
//
// ── Ce que cet écran a cessé d'être ────────────────────────────────────────
//
// Il s'appelait « Programme du manuel » et listait des livres. Un enseignant
// de lecture au CP2 y voyait « Méthode Boscher » comme entrée principale, et
// l'espace pédagogique lui offrait en plus un bouton dédié à ce seul manuel.
// L'organisation donnait à croire que le programme de lecture *était* Boscher.
//
// La règle métier est l'inverse :
//
//   MATIÈRE → PROGRAMME → OBJECTIFS → PROGRESSION → SÉQUENCES → LEÇONS
//                                                            → RESSOURCES
//
// Un manuel est une RESSOURCE. Il sert la matière ; il ne la définit pas.
// L'écran entre donc par la matière, et les livres n'apparaissent qu'au
// dernier volet — celui des ressources.
//
// ── Ce qu'il reste ─────────────────────────────────────────────────────────
//
// L'écran ne se saisit pas : il se lit. Ce qui s'y affiche vient de deux
// sources et de deux seulement — le sommaire du livre (fichier versionné) et
// les préparations réellement déposées (base). Une leçon est « traitée » parce
// qu'une fiche de préparation la vise, jamais parce qu'on a coché une case.
//
// Les matières viennent d'`affectations_matieres` et non de `prof_classes` :
// c'est l'affectation qui dit qui enseigne quoi.

// Comment nommer un manuel quand plusieurs servent la même matière. On coupe
// au premier tiret cadratin — « Treasures — Grade 1 (volumes 1 à 6) » devient
// « Treasures » — mais seulement si ce raccourci reste distinctif : au CM,
// Treasures et son Spelling Practice Book s'appellent tous deux « Treasures »
// avant le tiret, et deux boutons identiques ne départagent rien.
const etiquetteManuel = (manuel, freres) => {
  const court = m => m.titre.split('—')[0].trim()
  const abrege = court(manuel)
  const ambigu = freres.filter(f => court(f) === abrege).length > 1
  return ambigu ? manuel.titre : abrege
}

const pastille = (fond, texte) => ({
  background: fond, color: texte, borderRadius: 6, padding: '1px 7px',
  fontSize: 10, fontWeight: 800, flexShrink: 0,
})

// Les quatre volets, dans l'ordre de la règle métier. « Séquences » et
// « leçons » vivent sous Progression : ce sont les deux échelles d'une même
// lecture, et les séparer obligerait l'enseignant à faire l'aller-retour.
const VOLETS = [
  { id: 'programme',   libelle: 'Programme',   icone: '🎯' },
  { id: 'objectifs',   libelle: 'Objectifs',   icone: '📌' },
  { id: 'progression', libelle: 'Progression', icone: '📈' },
  { id: 'ressources',  libelle: 'Ressources',  icone: '📚' },
]

// Défilement horizontal contenu : sur un téléphone, six matières ne tiennent
// pas sur une ligne, et un retour à la ligne mangerait l'écran. La bande
// défile ; la page, jamais.
const bande = {
  display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  paddingBottom: 6, marginBottom: 12, scrollbarWidth: 'none',
}
const puce = (actif) => ({
  padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800,
  cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
  border: '2px solid ' + (actif ? 'var(--accent)' : 'var(--border)'),
  background: actif ? 'var(--accent)' : 'var(--bg)',
  color: actif ? '#fff' : 'var(--muted)',
})

// Comparaison de libellés saisis à la main : sans accents, sans casse.
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase()

export default function ProgrammePedagogique({ user, maternelle = false, classes = [], preparations = [] }) {
  if (maternelle) return <ProgrammeMaternelleAnnuel user={user} classes={classes} preparations={preparations} />
  return <ProgrammePrimaire user={user} />
}

function ProgrammePrimaire({ user }) {
  const [matieres, setMatieres]         = useState([])   // [{ groupe, matiere, manuels[] }]
  const [choix, setChoix]               = useState(null) // la matière courante
  const [volet, setVolet]               = useState('programme')
  const [manuelActif, setManuelActif]   = useState(null) // clé, dans Progression
  const [preparations, setPreparations] = useState([])
  const [objectifs, setObjectifs]       = useState(null) // null = pas encore lu
  const [sommaire, setSommaire]         = useState(null) // clé du manuel à imprimer
  // `undefined` = laisser l'écran choisir. Un manuel ne commence pas forcément
  // à l'unité 1 : le second volume de Singapour ouvre à l'unité 8.
  const [uniteOuverte, setUniteOuverte] = useState(undefined)
  const [chargement, setChargement]     = useState(true)
  const [erreur, setErreur]             = useState(null)

  useEffect(() => {
    let annule = false
    ;(async () => {
      setChargement(true); setErreur(null)
      const { data, error } = await supabase
        .from('affectations_matieres')
        .select('groupe, matiere')
        .eq('prof_id', user.id)
        .order('groupe')
      if (annule) return
      if (error) { setErreur('Chargement impossible : ' + error.message); setChargement(false); return }

      // Une matière, une entrée — même quand plusieurs livres la servent.
      // L'anglais du CM en a trois : Treasures, Spelling, Grammar. Ils sont
      // trois ressources d'une seule matière, pas trois matières.
      const parMatiere = new Map()
      ;(Array.isArray(data) ? data : []).forEach(a => {
        const cle = `${a.groupe}§${a.matiere}`
        if (!parMatiere.has(cle)) {
          parMatiere.set(cle, { groupe: a.groupe, matiere: a.matiere, manuels: manuelsPour(a.groupe, a.matiere) })
        }
      })
      const liste = [...parMatiere.values()]
      setMatieres(liste)
      setChoix(liste[0] || null)
      setChargement(false)
    })()
    return () => { annule = true }
  }, [user.id])

  // Préparations et objectifs de la matière choisie.
  useEffect(() => {
    // Sans matière choisie, l'écran affiche déjà le chargement ou l'état vide :
    // remettre les listes à zéro ici ne changerait rien à l'affichage et
    // déclencherait un rendu de plus.
    if (!choix) return
    let annule = false
    ;(async () => {
      const [prep, obj] = await Promise.all([
        supabase.from('preparations')
          .select('date_cours, sequence, contenu')
          .eq('groupe', choix.groupe).eq('matiere', choix.matiere)
          .order('date_cours'),
        // Les objectifs sont rattachés à une planification, pas à une matière :
        // on les filtre sur `discipline`, le seul champ qui porte le nom de la
        // matière. Sans planification déposée, la liste est vide — et l'écran
        // le dit, plutôt que de laisser croire qu'il n'y a pas d'objectifs.
        supabase.from('objectifs')
          .select('description, discipline, ordre')
          .order('ordre'),
      ])
      if (annule) return
      if (prep.error) { setErreur('Avancement illisible : ' + prep.error.message); return }
      setPreparations(Array.isArray(prep.data) ? prep.data : [])
      setObjectifs(obj.error
        ? []
        : (Array.isArray(obj.data) ? obj.data : []).filter(o => norm(o.discipline) === norm(choix.matiere)))
    })()
    return () => { annule = true }
  }, [choix])

  if (chargement) return <div className="empty-state"><p>Chargement du programme…</p></div>
  if (erreur) return <div className="empty-state"><div className="empty-icon">🛠️</div><p>{erreur}</p></div>

  if (!matieres.length) return (
    <div className="empty-state">
      <div className="empty-icon">📘</div>
      <p>Aucune matière ne vous est encore affectée sur la plateforme.</p>
    </div>
  )

  const manuels = choix.manuels
  // Le manuel suivi se déduit, il ne se stocke pas : changer de matière
  // rendrait obsolète une clé mémorisée, et la resynchroniser dans un effet
  // déclencherait un rendu en cascade. On retombe donc sur le premier manuel
  // dès que la clé retenue n'appartient plus à la matière courante.
  const manuel  = manuels.find(m => m.cle === manuelActif) || manuels[0] || null
  const lecons  = manuel ? leconsDe(manuel) : []
  const av      = manuel ? avancement(manuel, preparations) : null

  const uniteVisible = uniteOuverte === undefined
    ? (av?.prochaine?.unite ?? manuel?.unites?.[0]?.numero ?? null)
    : uniteOuverte

  const rangs = new Map(lecons.map((l, i) => [l.numero, i + 1]))

  // ── Une ligne de leçon ────────────────────────────────────────────────────
  const ligneLecon = l => {
    const seq = av.seances[l.numero]?.length || 0
    const estProchaine = av.prochaine?.numero === l.numero
    return (
      <div key={l.numero} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderTop: '1px solid var(--border)',
        background: estProchaine ? 'rgba(26,175,224,.06)' : 'transparent',
      }}>
        <span style={pastille(seq ? 'rgba(46,158,79,.15)' : 'var(--bg)', seq ? 'var(--green)' : 'var(--muted)')}>
          {l.code ?? (manuel.numerote === false ? rangs.get(l.numero) : l.numero)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: l.bilan || l.motOutil ? 800 : 600 }}>
            {l.titre}
            {estProchaine && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 800, marginLeft: 6 }}>À VENIR</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {/* « Mon journal » n'existe que chez Singapour CP1, où le bilan
                d'unité renvoie à une page de journal. Ailleurs un bilan est un
                bilan, sans page associée. */}
            {pagesDe(l, manuel)}{l.bilan && l.journal ? ` · Mon journal p. ${l.journal}` : ''}
            {seq > 0 && ` · ${seq} séquence${seq > 1 ? 's' : ''} préparée${seq > 1 ? 's' : ''}`}
          </div>
          {/* Livre unique : une leçon couvre plusieurs domaines dans la même
              séance. Les montrer, sinon l'enseignant ne voit qu'un titre de
              texte et ignore ce que la leçon demande. */}
          {l.domaines?.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
              {l.domaines.map((d, i) => (
                <div key={i}>{d.nom} : <b style={{ color: 'var(--text)' }}>{d.contenu}</b></div>
              ))}
            </div>
          )}
        </div>
        <span style={{ fontSize: 15, color: seq ? 'var(--green)' : 'var(--border)' }}>{seq ? '✓' : '○'}</span>
      </div>
    )
  }

  const sansManuel = manuels.length === 0

  return (
    <>
      {/* ══ 1 · LA MATIÈRE ═══════════════════════════════════════════════ */}
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
        Matières que vous enseignez
      </div>
      <div style={bande}>
        {matieres.map(m => (
          <button key={m.groupe + m.matiere}
            onClick={() => { setChoix(m); setVolet('programme'); setManuelActif(null); setUniteOuverte(undefined) }}
            style={puce(choix.groupe === m.groupe && choix.matiere === m.matiere)}>
            {m.matiere} · {m.groupe}
          </button>
        ))}
      </div>

      <div className="section-head" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {choix.matiere}
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{choix.groupe}</span>
      </div>

      {/* ══ 2 · LES VOLETS ═══════════════════════════════════════════════ */}
      <div style={bande} role="tablist" aria-label="Volets du programme">
        {VOLETS.map(v => (
          <button key={v.id} role="tab" aria-selected={volet === v.id}
            onClick={() => setVolet(v.id)} style={puce(volet === v.id)}>
            {v.icone} {v.libelle}
            {v.id === 'ressources' && manuels.length > 0 && (
              <span style={{ opacity: .7, fontWeight: 600 }}> · {manuels.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Matière sans manuel : le dire une fois, à sa place ─────────── */}
      {sansManuel && volet !== 'objectifs' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          Aucun manuel n'est enregistré pour {choix.matiere} en {choix.groupe}. Les
          préparations de cette matière restent libres, et l'avancement se lit dans
          les préparations déposées.
        </div>
      )}

      {/* ══ VOLET · PROGRAMME ════════════════════════════════════════════ */}
      {volet === 'programme' && manuel && av && (
        <>
          <div style={{ background: 'linear-gradient(135deg,#0d2a3b,#1565a0)', borderRadius: 14, padding: '14px 16px', marginBottom: 12, color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: .75, fontWeight: 700, textTransform: 'uppercase' }}>Où en est la classe</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 6, lineHeight: 1.35 }}>
              {av.courante
                ? <>
                    {av.courante.uniteTitre || av.courante.titre}
                    <div style={{ fontSize: 13, fontWeight: 600, opacity: .9 }}>
                      {av.courante.uniteTitre ? `${av.courante.titre} · ` : ''}
                      {situationDe(manuel, av.courante)}
                    </div>
                  </>
                : 'Le programme n’a pas encore commencé.'}
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,.18)', borderRadius: 5, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${av.pourcentage}%`, height: '100%', background: '#1AAFE0', borderRadius: 5, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 11, opacity: .8, marginTop: 6 }}>
              {av.nbFaits} entrée{av.nbFaits > 1 ? 's' : ''} sur {av.total} · {av.pourcentage} %
            </div>
          </div>

          {av.prochaine && (
            <div style={{ background: 'rgba(26,175,224,.08)', border: '1px solid rgba(26,175,224,.4)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                {av.prochaine.motOutil ? 'Prochaine étape · mot outil' : 'Prochaine leçon'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{av.prochaine.titre}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {situationDe(manuel, av.prochaine)}
                {av.prochaine.journal && ` · Explorons p. ${av.prochaine.page}, Mon journal p. ${av.prochaine.journal}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                {manuels.length > 1
                  ? <>C'est elle qui sera proposée dès que vous choisirez cette ressource dans une préparation de {choix.matiere}.</>
                  : <>C'est elle qui sera proposée par défaut à votre prochaine préparation de {choix.matiere}.</>}
              </div>
            </div>
          )}
        </>
      )}

      {volet === 'programme' && !manuel && (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="empty-icon">🎯</div>
          <p>L'avancement de {choix.matiere} se lit dans les préparations déposées :
             aucun manuel n'est rattaché à cette matière.</p>
        </div>
      )}

      {/* ══ VOLET · OBJECTIFS ════════════════════════════════════════════ */}
      {volet === 'objectifs' && (
        objectifs === null ? (
          <div className="empty-state"><p>Lecture des objectifs…</p></div>
        ) : objectifs.length > 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {objectifs.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <span style={pastille('var(--bg)', 'var(--muted)')}>{i + 1}</span>
                <div style={{ fontSize: 13, minWidth: 0, overflowWrap: 'anywhere' }}>{o.description}</div>
              </div>
            ))}
          </div>
        ) : (
          // Distinguer « aucun objectif » de « objectifs pas encore saisis » :
          // le second n'est pas une bonne nouvelle, c'est une absence de saisie.
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '14px 16px', fontSize: 13, color: '#92400e' }}>
            <strong>Aucun objectif enregistré pour {choix.matiere}.</strong>
            <div style={{ marginTop: 6, lineHeight: 1.55 }}>
              Les objectifs se déposent avec la planification de période. Tant qu'aucune
              planification n'en porte pour cette matière, cette liste reste vide — ce
              qui ne veut pas dire que la matière n'a pas d'objectifs.
            </div>
          </div>
        )
      )}

      {/* ══ VOLET · PROGRESSION ══════════════════════════════════════════ */}
      {volet === 'progression' && manuel && av && (
        <>
          {/* Plusieurs ressources pour une même matière : on choisit celle dont
              on suit la progression. Le titre du livre n'apparaît qu'ici. */}
          {manuels.length > 1 && (
            <div style={bande}>
              {manuels.map(m => (
                <button key={m.cle} onClick={() => { setManuelActif(m.cle); setUniteOuverte(undefined) }}
                  style={puce(m.cle === manuel.cle)}>
                  {etiquetteManuel(m, manuels)}
                </button>
              ))}
            </div>
          )}

          {!aDesUnites(manuel) && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ background: '#0d2a3b', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>Séquences et leçons</span>
                <span style={{ opacity: .7, flex: 'none' }}>{av.nbFaits}/{av.total}</span>
              </div>
              {lecons.map(ligneLecon)}
            </div>
          )}

          {aDesUnites(manuel) && manuel.unites.map(u => {
            const ouvert = uniteVisible === u.numero
            const faits = u.lecons.filter(l => av.faits.includes(l.numero)).length
            return (
              <div key={u.numero} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                <div onClick={() => setUniteOuverte(ouvert ? null : u.numero)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', background: ouvert ? 'rgba(26,175,224,.05)' : 'transparent' }}>
                  {/* Initiale du mot qu'emploie le livre : U pour unité, T pour thème. */}
                  <span style={pastille('#0d2a3b', '#fff')}>{libelleUnite(manuel)[0]}{u.numero}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, overflowWrap: 'anywhere' }}>{u.titre}</div>
                    {u.rubrique && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{u.rubrique}</div>}
                    {/* Activités pratiques du chapitre : rappelées, jamais
                        comptées — sinon la même séance compterait deux fois. */}
                    {ouvert && u.activites?.length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                        <b>Activités :</b> {u.activites.join(' · ')}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, flex: 'none', color: faits === u.lecons.length ? 'var(--green)' : 'var(--muted)' }}>
                    {faits}/{u.lecons.length}
                  </span>
                  <span style={{ color: 'var(--muted)', flex: 'none', transform: ouvert ? 'rotate(180deg)' : 'none', transition: '.2s' }}>⌄</span>
                </div>
                {ouvert && u.lecons.map(ligneLecon)}
              </div>
            )
          })}

          <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 2px 10px', lineHeight: 1.5 }}>
            Une leçon est marquée traitée dès qu'une fiche de préparation la vise. Le compte
            de séquences est celui des demi-heures réellement préparées.
            {' '}{lecons.length} entrées
            {lecons.some(l => l.bilan) && `, dont ${lecons.filter(l => l.bilan).length} bilans`}
            {lecons.some(l => l.motOutil) && `, dont ${lecons.filter(l => l.motOutil).length} mots outils`}.
          </div>
        </>
      )}

      {volet === 'progression' && !manuel && (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <div className="empty-icon">📈</div>
          <p>La progression se suit dans vos préparations : aucun manuel n'est rattaché
             à {choix.matiere}.</p>
        </div>
      )}

      {/* ══ VOLET · RESSOURCES ═══════════════════════════════════════════ */}
      {volet === 'ressources' && (
        manuels.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <div className="empty-icon">📚</div>
            <p>Aucune ressource enregistrée pour {choix.matiere} en {choix.groupe}.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {manuels.map(m => {
              const n = leconsDe(m).length
              return (
                <div key={m.cle} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Manuel · {m.langue === 'en' ? 'anglais' : 'français'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, marginTop: 3, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                    {m.titre}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {n} entrée{n > 1 ? 's' : ''} au sommaire
                    {m.unites?.length ? ` · ${m.unites.length} ${libelleUnite(m).toLowerCase()}s` : ''}
                  </div>
                  {/* Une seule action ici : ouvrir la fiche. Impression et image
                      appartiennent à la fiche, pas à la liste — c'est ce qui
                      évitait d'injecter un A4 dans la page. */}
                  <button onClick={() => setSommaire(m.cle)} style={{
                    marginTop: 10, width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: 'none', background: 'var(--accent)', color: '#fff',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  }}>
                    Voir la ressource
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* La fiche ressource s'ouvre en surcouche, jamais dans le flux de la
          page : c'est le moteur documentaire qui porte impression et image. */}
      {sommaire && <SommaireManuelDocument cle={sommaire} onClose={() => setSommaire(null)} />}
    </>
  )
}
