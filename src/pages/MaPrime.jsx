import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  CONFIG_DEFAUT, calculerPoints, montantEte, valeurAction, avantagesDe, detailIndicateur,
} from '../lib/points'
import { agreger, messageLisible } from '../lib/chargement'

const fcfa = n => (Math.round(Number(n) || 0)).toLocaleString('fr-FR') + ' F'

// Libellés des sources, pour nommer la panne en français plutôt qu'en tables.
const LIBELLE_BLOC = {
  bareme: 'barème des points',
  saisie_manuelle: 'saisies de la direction',
  preparations: 'préparations',
  fins_de_cours: 'fiches de fin de cours',
  pointages: 'pointages',
  rapports: 'rapports élèves',
  absences: 'absences',
  affectations: 'affectations de matières',
  emploi_du_temps: 'emploi du temps',
}

/**
 * Vue enseignant : ce que ses efforts lui rapportent pour les vacances.
 * Consultable en permanence — c'est la visibilité continue qui pilote
 * les comportements, bien plus que le versement lui-même.
 *
 * compact : bandeau résumé (écran d'accueil) · sinon vue détaillée.
 */
export default function MaPrime({ user, compact = false, onOuvrir }) {
  const [config, setConfig] = useState(CONFIG_DEFAUT)
  const [calc, setCalc] = useState(null)
  const [ete, setEte] = useState({ total: 0, mois: [] })
  const [av, setAv] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [donnees, setDonnees] = useState(null)
  const [triOuvert, setTriOuvert] = useState(null)
  const [detailOuvert, setDetailOuvert] = useState(null)
  // La prime est un chiffre unique agrégé : contrairement à un tableau de bord
  // où chaque bloc vit sa vie, une seule source manquante fausse le total. On
  // refuse alors d'afficher un montant — un « 0 F » ferait croire à un
  // enseignant qu'il n'a rien gagné.
  const [erreur, setErreur] = useState(null)
  const [blocsEnEchec, setBlocsEnEchec] = useState([])
  const [avantagesEnEchec, setAvantagesEnEchec] = useState(false)

  useEffect(() => { charger() }, [user?.id])

  const charger = async () => {
    setChargement(true)
    setErreur(null)
    setBlocsEnEchec([])
    setAvantagesEnEchec(false)
    try {
      const [cfgRes, persRes, manRes, prepRes, cpRes, perfRes, rapRes, absRes, affRes, edtRes] = await Promise.all([
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'points_config').maybeSingle(),
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'personnel').maybeSingle(),
        supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'saisie_manuelle').maybeSingle(),
        supabase.from('preparations').select('user_id, date_cours, heure_cours, heure_depot, status, historique_statuts').eq('user_id', user.id),
        supabase.from('comprehensions').select('prof_id, date_cours, matiere').eq('prof_id', user.id),
        supabase.from('performances').select('prof_id, date_jour, heure_arrivee').eq('prof_id', user.id),
        supabase.from('app_state').select('value').eq('app', 'rapports_eleves'),
        supabase.from('absences_enseignants').select('prof_id, date_absence, justifiee').eq('prof_id', user.id),
        supabase.from('affectations_matieres').select('groupe, matiere').eq('prof_id', user.id),
        supabase.from('emploi_du_temps').select('groupe, matiere'),
      ])

      // Toutes ces sources alimentent un seul et même total. Une seule en
      // échec — un refus RLS, une session non prête — et le calcul rend un
      // pourcentage inférieur au réel, sans que rien ne le signale.
      const sourcesDuCalcul = {
        bareme: cfgRes,
        saisie_manuelle: manRes,
        preparations: prepRes,
        fins_de_cours: cpRes,
        pointages: perfRes,
        rapports: rapRes,
        absences: absRes,
        affectations: affRes,
        emploi_du_temps: edtRes,
      }
      const bilan = agreger(sourcesDuCalcul)
      if (bilan.aDesEchecs) {
        const premiere = sourcesDuCalcul[bilan.blocsEnEchec[0]].error
        setBlocsEnEchec(bilan.blocsEnEchec.map(cle => LIBELLE_BLOC[cle] || cle))
        setErreur(messageLisible(premiere))
        setCalc(null)
        setDonnees(null)
        return
      }

      const cfg = cfgRes.data?.value ? { ...CONFIG_DEFAUT, ...cfgRes.data.value } : CONFIG_DEFAUT
      setConfig(cfg)

      const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.trim()
      const liste = r => (Array.isArray(r?.data) ? r.data : [])
      // Charge hebdomadaire réelle : 30 min par créneau des matières qui lui
      // sont confiées. Elle sert à proratiser les cibles, pour ne pas exiger
      // d'un enseignant à 10 h ce qu'on attend d'un enseignant à 20 h.
      const miennes = new Set(liste(affRes).map(a => `${a.groupe}|${a.matiere}`))
      const creneaux = liste(edtRes).filter(c => miennes.has(`${c.groupe}|${c.matiere}`)).length
      const heures = creneaux ? (creneaux * 30) / 60 : null

      const donnees = {
        preparations: liste(prepRes),
        comprehensions: liste(cpRes),
        performances: liste(perfRes),
        rapports: liste(rapRes).map(r => r.value).filter(Boolean),
        saisieManuelle: manRes.data?.value || {},
        absencesEnseignants: liste(absRes),
        heuresParProf: heures ? { [user.id]: heures } : {},
      }

      setDonnees(donnees)
      const c = calculerPoints(cfg, donnees, user.id, nomComplet)
      setCalc(c)
      setEte(montantEte(c.pourcentage, cfg))
      // La fiche RH ne pèse que sur l'ancienneté et les bourses, pas sur le
      // total des points : son échec ne condamne pas l'écran, mais il ne doit
      // pas se lire comme « aucune ancienneté ».
      if (persRes.error) {
        setAvantagesEnEchec(true)
        setAv(null)
      } else {
        const perso = (persRes.data?.value || {})[user.id]
        setAv(avantagesDe(c.pourcentage, (perso || {}).dateEmbauche, perso, cfg))
      }
    } catch (e) {
      console.error('Chargement de la prime impossible', e)
      setErreur(messageLisible(e))
      setCalc(null)
    } finally {
      setChargement(false)
    }
  }

  if (chargement) {
    return compact ? null : <div className="empty-state"><div className="empty-icon">🏆</div><p>Calcul en cours…</p></div>
  }

  // Erreur — et surtout pas « 0 F ». Un enseignant qui lit zéro conclut qu'il
  // n'a rien gagné ; il faut qu'il lise que la plateforme, elle, ne sait pas.
  if (erreur || !calc) {
    const detail = blocsEnEchec.length > 0
      ? `Sources indisponibles : ${blocsEnEchec.join(', ')}.`
      : null
    const message = erreur || 'Chargement impossible. Réessayez dans un instant.'

    if (compact) {
      return (
        <div style={{
          background: 'rgba(220,38,38,.1)', border: '1px solid var(--red)', borderRadius: 16,
          padding: '1rem 1.2rem', marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, opacity: .85, fontWeight: 700, color: 'var(--red)' }}>MES VACANCES GAGNÉES</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 2, color: 'var(--red)' }}>—</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
            Montant indisponible : {message} Ce n’est pas un montant nul.
          </div>
          <button onClick={e => { e.stopPropagation(); charger() }}
            style={{ marginTop: 8, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      )
    }

    return (
      <>
        <div className="section-head">
          <div className="section-title">Ma prime d'été</div>
        </div>
        <div style={{ background: 'rgba(220,38,38,.08)', border: '1px solid var(--red)', borderLeft: '4px solid var(--red)', borderRadius: 14, padding: '1.1rem 1.2rem' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--red)' }}>Prime non calculable pour l’instant</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--red)', margin: '6px 0 4px' }}>—</div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
            {message}
          </div>
          {detail && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{detail}</div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
            Aucun montant n’est affiché tant que toutes les sources n’ont pas répondu : un total
            calculé sur des données partielles serait inférieur au vôtre. <b>Ce tiret ne veut pas
            dire zéro.</b> Si le problème persiste, signalez-le à la direction.
          </div>
          <button onClick={charger}
            style={{ marginTop: 12, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      </>
    )
  }

  const aujourdhui = new Date().toISOString().slice(0, 10)
  const tris = config.trimestres || []
  const triEnCours = tris.find(t => aujourdhui >= t.debut && aujourdhui <= t.fin) || null
  // Hors période de classe, on se réfère au trimestre à venir (ou au dernier si
  // l'année est achevée) pour la valeur des gestes, sans afficher « en cours ».
  const triReference = triEnCours
    || (tris.length && aujourdhui < tris[0].debut ? tris[0] : null)
    || tris[tris.length - 1]
    || null
  const horsPeriode = !triEnCours

  if (compact) {
    return (
      <div onClick={onOuvrir} style={{
        background:'linear-gradient(135deg, #0d2a3b, #1565a0)', borderRadius:16, padding:'1rem 1.2rem',
        marginBottom:12, cursor:'pointer', color:'#fff',
      }}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:11, opacity:.75, fontWeight:600}}>MES VACANCES GAGNÉES</div>
            <div style={{fontSize:26, fontWeight:900, marginTop:2}}>{fcfa(ete.total)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:20, fontWeight:900}}>{calc.pourcentage}%</div>
            <div style={{fontSize:10, opacity:.75}}>{calc.total} / {calc.max} pts</div>
          </div>
        </div>
        <div style={{background:'rgba(255,255,255,.2)', borderRadius:20, height:6, marginTop:10, overflow:'hidden'}}>
          <div style={{width:`${calc.pourcentage}%`, height:'100%', background:'#8DC63F', borderRadius:20}}></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="section-head">
        <div className="section-title">Ma prime d'été</div>
      </div>

      <div style={{background:'linear-gradient(135deg, #0d2a3b, #1565a0)', borderRadius:16, padding:'1.2rem', color:'#fff', marginBottom:12}}>
        <div style={{fontSize:11, opacity:.75, fontWeight:600}}>GAGNÉ À CE JOUR</div>
        <div style={{fontSize:34, fontWeight:900, margin:'2px 0 12px'}}>{fcfa(ete.total)}</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
          {ete.mois.map(m => (
            <div key={m.mois} style={{background:'rgba(255,255,255,.14)', borderRadius:10, padding:'8px 4px', textAlign:'center'}}>
              <div style={{fontSize:10, opacity:.8}}>{m.mois}</div>
              <div style={{fontSize:14, fontWeight:800}}>{fcfa(m.montant)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div className="card-header">Mes points · {calc.total} sur {calc.max}</div>
        <div className="card-body">
          <div style={{fontSize:11, color:'var(--muted)', marginBottom:10, fontStyle:'italic'}}>
            Touchez un trimestre, puis un indicateur, pour voir le détail de ce qui a été compté.
          </div>
          {calc.parTrimestre.map(t => {
            const pct = t.pondereMax > 0 ? Math.round((t.pondere / t.pondereMax) * 100) : 0
            const encours = !!triEnCours && t.id === triEnCours.id
            const ouvert = triOuvert === t.id || (triOuvert === null && encours)
            return (
              <div key={t.id} style={{marginBottom:12}}>
                <div onClick={() => { setTriOuvert(ouvert ? 'aucun' : t.id); setDetailOuvert(null) }}
                  style={{display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, marginBottom:4, cursor:'pointer'}}>
                  <span>
                    {ouvert ? '▾' : '▸'} {t.label} <span style={{color:'var(--accent)'}}>×{t.coef}</span>
                    {encours && <span style={{color:'var(--amber)', fontSize:10, marginLeft:6}}>EN COURS</span>}
                  </span>
                  <span style={{color:'var(--muted)'}}>{t.pondere} / {t.pondereMax}</span>
                </div>
                <div className="progress-wrap" style={{height:14}}>
                  <div className="progress-fill" style={{width:`${pct}%`, background: pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--accent)'}}></div>
                </div>

                {ouvert && (
                  <div style={{marginTop:8}}>
                    {t.detail.map(d => {
                      const cle = `${t.id}:${d.id}`
                      const affiche = detailOuvert === cle
                      const auto = (config.indicateurs.find(i => i.id === d.id) || {}).auto
                      const lignes = affiche && donnees
                        ? detailIndicateur(config, donnees, user.id, `${user.prenom || ''} ${user.nom || ''}`.trim(), t.id, d.id)
                        : []
                      return (
                        <div key={d.id}>
                          <div onClick={() => auto && setDetailOuvert(affiche ? null : cle)}
                            style={{display:'flex', alignItems:'center', gap:8, fontSize:11, padding:'4px 0', color:'var(--muted)', cursor: auto ? 'pointer' : 'default'}}>
                            <span style={{flex:1}}>{auto && (affiche ? '▾ ' : '▸ ')}{d.label}</span>
                            <span style={{fontWeight:700, color:'var(--text)'}}>{d.realise}/{d.cible}</span>
                            <span style={{minWidth:44, textAlign:'right'}}>{d.points} pt</span>
                          </div>
                          {affiche && (
                            <div style={{background:'var(--bg)', borderRadius:8, padding:'6px 8px', margin:'2px 0 8px'}}>
                              {lignes.length === 0 ? (
                                <div style={{fontSize:11, color:'var(--muted)', fontStyle:'italic'}}>Rien d'enregistré sur ce trimestre.</div>
                              ) : lignes.map((l, k) => (
                                <div key={k} style={{display:'flex', gap:6, fontSize:10, padding:'2px 0', alignItems:'flex-start'}}>
                                  <span>{l.compte ? '✅' : '❌'}</span>
                                  <span style={{flex:1}}>
                                    <b>{l.date}</b> · {l.info}
                                    <div style={{color: l.compte ? 'var(--muted)' : 'var(--red)'}}>{l.raison}</div>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{background:'rgba(26,175,224,.1)', border:'1px solid var(--border)', borderRadius:12, padding:'.9rem 1rem', marginBottom:12}}>
        <div style={{fontSize:12, fontWeight:800, marginBottom:6}}>
          ⚡ Ce que rapporte chaque geste{triReference ? ` — ${triReference.label}` : ''}
        </div>
        {horsPeriode && (
          <div style={{fontSize:11, color:'var(--muted)', fontStyle:'italic', marginBottom:6}}>
            Hors période de classe : montants du prochain trimestre.
          </div>
        )}
        {config.indicateurs.filter(i => i.auto).map(i => (
          <div key={i.id} style={{display:'flex', justifyContent:'space-between', fontSize:11, padding:'2px 0'}}>
            <span style={{color:'var(--muted)'}}>{i.label}</span>
            <span style={{fontWeight:800, color:'var(--green)'}}>+{fcfa(valeurAction(i.id, triReference?.id, config))}</span>
          </div>
        ))}
        {config.trimestres[2] && triReference?.id !== config.trimestres[2].id && (
          <div style={{fontSize:11, color:'var(--amber)', marginTop:6, fontStyle:'italic'}}>
            Au 3<sup>e</sup> trimestre, ces montants seront multipliés par {(config.trimestres[2].coef / (triReference?.coef || 1)).toFixed(1)}.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">Mes avantages</div>
        <div className="card-body">
          {/* Une ancienneté absente et une ancienneté illisible ne sont pas la
              même chose : la seconde conditionne des bourses, elle se dit. */}
          {avantagesEnEchec ? (
            <div style={{fontSize:11, color:'var(--red)', marginBottom:8, lineHeight:1.6}}>
              Ancienneté : — · votre fiche de rémunération n’a pas pu être lue. Les bourses qui en
              dépendent ne sont pas vérifiables ici pour l’instant.
              <button onClick={charger}
                style={{marginLeft:8, padding:'3px 9px', borderRadius:7, border:'1px solid var(--red)', background:'transparent', color:'var(--red)', fontSize:10, fontWeight:800, cursor:'pointer'}}>
                Réessayer
              </button>
            </div>
          ) : av?.anciennete !== null && av?.anciennete !== undefined && (
            <div style={{fontSize:11, color:'var(--muted)', marginBottom:8}}>Ancienneté : {av.anciennete} an{av.anciennete > 1 ? 's' : ''}</div>
          )}
          {config.paliers.map(p => {
            const acquis = calc.pourcentage >= p.seuil
            return (
              <div key={p.id} style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0', fontSize:12, opacity: acquis ? 1 : .55}}>
                <span style={{fontSize:16}}>{acquis ? '✅' : '🔒'}</span>
                <span style={{flex:1}}>
                  <b>{p.label}</b> · bourse enfant {p.bourseEnfant} %
                  {p.formation > 0 && ` · formation ${p.formation} %`}
                </span>
                <span style={{color: acquis ? 'var(--green)' : 'var(--muted)', fontWeight:700}}>{p.seuil} %</span>
              </div>
            )
          })}
          {av?.messages?.length > 0 && (
            <div style={{borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8}}>
              {av.messages.map((m, i) => (
                <div key={i} style={{fontSize:11, color:'var(--muted)', fontStyle:'italic'}}>{m}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
