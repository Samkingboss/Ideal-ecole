import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { manuelsPour, leconsDe, avancement, aDesUnites, pagesDe, situationDe, libelleUnite } from '../lib/programmes'

// Le programme de l'enseignant, tel qu'il est imprimé dans le manuel.
//
// L'écran ne se saisit pas : il se lit. Ce qui s'y affiche vient de deux
// sources et de deux seulement — le sommaire du livre (fichier versionné) et
// les préparations réellement déposées (base). Une leçon est « traitée » parce
// qu'une fiche de préparation la vise, jamais parce qu'on a coché une case :
// il n'y a donc pas d'avancement déclaré qui ne corresponde à aucun cours.
//
// Les matières de l'enseignant viennent d'`affectations_matieres` et non de
// `prof_classes` : c'est l'affectation qui dit qui enseigne quoi, et le
// document officiel garantit une matière = un enseignant sur toute l'année.

const pastille = (fond, texte) => ({
  background: fond, color: texte, borderRadius: 6, padding: '1px 7px',
  fontSize: 10, fontWeight: 800, flexShrink: 0,
})

export default function ProgrammeManuel({ user }) {
  const [matieres, setMatieres] = useState([])     // affectations qui ont un manuel
  const [sansManuel, setSansManuel] = useState([]) // affectations sans manuel
  const [choix, setChoix] = useState(null)         // { groupe, matiere, manuel }
  const [preparations, setPreparations] = useState([])
  // `undefined` = laisser l'écran choisir. Un manuel ne commence pas forcément
  // à l'unité 1 : le second volume de Singapour ouvre à l'unité 8. On déplie
  // donc l'unité où la classe en est, pas un numéro fixé d'avance.
  const [uniteOuverte, setUniteOuverte] = useState(undefined)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => { charger() }, [user.id])

  async function charger() {
    setChargement(true); setErreur(null)
    const { data, error } = await supabase
      .from('affectations_matieres')
      .select('groupe, matiere')
      .eq('prof_id', user.id)
      .order('groupe')
    if (error) { setErreur('Chargement impossible : ' + error.message); setChargement(false); return }

    // Une matière peut porter plusieurs manuels — l'anglais en a deux. On
    // liste donc des manuels, pas des matières : chacun a son avancement.
    const avec = [], sans = []
    ;(data || []).forEach(a => {
      const manuels = manuelsPour(a.groupe, a.matiere)
      if (!manuels.length) { sans.push({ ...a, manuel: null }); return }
      manuels.forEach(manuel => avec.push({ ...a, manuel }))
    })
    setMatieres(avec); setSansManuel(sans)
    setChoix(avec[0] || null)
    setChargement(false)
  }

  // Les préparations de la matière choisie, tous dépôts confondus.
  useEffect(() => {
    if (!choix) { setPreparations([]); return }
    let annule = false
    ;(async () => {
      const { data, error } = await supabase
        .from('preparations')
        .select('date_cours, sequence, contenu')
        .eq('groupe', choix.groupe)
        .eq('matiere', choix.matiere)
        .order('date_cours')
      if (annule) return
      if (error) { setErreur('Avancement illisible : ' + error.message); return }
      setPreparations(data || [])
    })()
    return () => { annule = true }
  }, [choix])

  if (chargement) return <div className="empty-state"><p>Chargement du programme…</p></div>

  if (erreur) return <div className="empty-state"><div className="empty-icon">🛠️</div><p>{erreur}</p></div>

  if (!matieres.length) return (
    <div style={{ padding: '1rem 0' }}>
      <div className="empty-state">
        <div className="empty-icon">📘</div>
        <p>Aucune de vos matières n'a encore de manuel enregistré sur la plateforme.</p>
      </div>
      {sansManuel.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--muted)' }}>
          Vos matières : {sansManuel.map(m => `${m.matiere} (${m.groupe})`).join(', ')}.
          Leurs préparations restent libres.
        </div>
      )}
    </div>
  )

  const manuel = choix.manuel
  const lecons = leconsDe(manuel)
  const av = avancement(manuel, preparations)

  // Unité dépliée : celle où la classe en est tant que l'enseignant n'a rien
  // ouvert lui-même, la sienne ensuite.
  const uniteVisible = uniteOuverte === undefined
    ? (av.prochaine?.unite ?? manuel.unites?.[0]?.numero ?? null)
    : uniteOuverte

  // Rang de chaque entrée dans le livre entier, calculé sur la liste à plat et
  // non sur la position dans l'unité : chez Boscher, la 3ᵉ page de la phase 2
  // est la 13ᵉ du manuel, et c'est ce second chiffre qui situe la classe.
  const rangs = new Map(lecons.map((l, i) => [l.numero, i + 1]))

  // Une ligne du sommaire. Rendue à l'identique dans les deux mises en page,
  // pour qu'un enseignant qui change de matière retrouve les mêmes repères.
  // La pastille porte la référence imprimée du livre quand il en a une — un
  // numéro de leçon, ou un code de section comme « 9.2 » chez Cambridge — et
  // sinon le rang. Jamais la page : elle est déjà écrite juste en dessous.
  const ligneLecon = l => {
    const seq = av.seances[l.numero]?.length || 0
    const estProchaine = av.prochaine?.numero === l.numero
    return (
      <div key={l.numero} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px', borderTop: '1px solid var(--border)',
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
            {pagesDe(l, manuel)}{l.bilan ? ` · Mon journal p. ${l.journal}` : ''}
            {seq > 0 && ` · ${seq} séquence${seq > 1 ? 's' : ''} préparée${seq > 1 ? 's' : ''}`}
          </div>
        </div>
        <span style={{ fontSize: 15, color: seq ? 'var(--green)' : 'var(--border)' }}>{seq ? '✓' : '○'}</span>
      </div>
    )
  }

  return (
    <>
      {/* Choix de la matière, seulement si l'enseignant en a plusieurs à manuel */}
      {matieres.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {matieres.map(m => {
            const actif = choix.manuel.cle === m.manuel.cle
            return (
              <button key={m.groupe + m.matiere + m.manuel.cle} onClick={() => { setChoix(m); setUniteOuverte(undefined) }}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  border: '2px solid ' + (actif ? 'var(--accent)' : 'var(--border)'),
                  background: actif ? 'var(--accent)' : 'var(--bg)',
                  color: actif ? '#fff' : 'var(--muted)',
                }}>
                {m.matiere} · {m.groupe}
                {/* Le titre du manuel n'apparaît que s'il faut départager :
                    « English · CP1 » ne suffit plus quand deux livres le
                    servent. */}
                {matieres.filter(x => x.groupe === m.groupe && x.matiere === m.matiere).length > 1 && (
                  <span style={{ fontWeight: 600, opacity: .85 }}> · {m.manuel.titre.split('—')[0].trim()}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="section-head">
        <div className="section-title">{manuel.titre}</div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{choix.groupe}</span>
      </div>

      {/* ── Où en est la classe ── */}
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
          {av.nbFaits} entrée{av.nbFaits > 1 ? 's' : ''} sur {av.total} · {av.pourcentage} % du manuel
        </div>
      </div>

      {/* ── Prochaine leçon ── */}
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
            {matieres.filter(m => m.groupe === choix.groupe && m.matiere === choix.matiere).length > 1
              ? <>C'est elle qui sera proposée dès que vous choisirez ce manuel dans une préparation de {choix.matiere}.</>
              : <>C'est elle qui sera proposée par défaut à votre prochaine préparation de {choix.matiere}.</>}
          </div>
        </div>
      )}

      {/* ── Le manuel : liste continue, pour un livre sans unités ── */}
      {!aDesUnites(manuel) && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ background: '#0d2a3b', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
            <span>Progression du manuel</span>
            <span style={{ opacity: .7 }}>{av.nbFaits}/{av.total}</span>
          </div>
          {lecons.map(ligneLecon)}
        </div>
      )}

      {/* ── Le manuel, unité par unité ── */}
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
                <div style={{ fontWeight: 800, fontSize: 13 }}>{u.titre}</div>
                {/* Mention imprimée au-dessus de l'unité dans le sommaire :
                    un domaine chez Singapour, une partie chez Boscher. */}
                {u.rubrique && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{u.rubrique}</div>}
                {/* Activités pratiques du chapitre. Elles se déroulent pendant
                    les leçons, aux mêmes pages : on les rappelle sans les
                    compter dans l'avancement, sinon la même séance serait
                    comptée deux fois. */}
                {ouvert && u.activites?.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                    <b>Activités :</b> {u.activites.join(' · ')}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: faits === u.lecons.length ? 'var(--green)' : 'var(--muted)' }}>
                {faits}/{u.lecons.length}
              </span>
              <span style={{ color: 'var(--muted)', transform: ouvert ? 'rotate(180deg)' : 'none', transition: '.2s' }}>⌄</span>
            </div>

            {ouvert && u.lecons.map(ligneLecon)}
          </div>
        )
      })}

      <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 2px 10px', lineHeight: 1.5 }}>
        Une leçon est marquée traitée dès qu'une fiche de préparation la vise. Le compte de
        séquences est celui des demi-heures réellement préparées pour cette leçon.
        {' '}{lecons.length} entrées au sommaire
        {lecons.some(l => l.bilan) && `, dont ${lecons.filter(l => l.bilan).length} bilans`}
        {lecons.some(l => l.motOutil) && `, dont ${lecons.filter(l => l.motOutil).length} mots outils`}.
      </div>

      {sansManuel.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--muted)' }}>
          Sans manuel enregistré : {sansManuel.map(m => `${m.matiere} (${m.groupe})`).join(', ')}.
          Leurs préparations restent libres.
        </div>
      )}
    </>
  )
}
