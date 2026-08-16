import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
const APP_RH = 'rh'

import { pushNotification } from '../lib/notifications'

export default function DemandesEnseignant({ user }) {
  const [tabType, setTabType] = useState('nouvelle') // 'nouvelle' | 'historique'
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [demandes, setDemandes] = useState([])

  // Form state
  const [typeDemande, setTypeDemande] = useState('pret') // pret | avance | absence | permission | achat
  const [formData, setFormData] = useState({
    montant: '',
    duree_mois: '3',
    mois_paie: 'Octobre 2026',
    date_debut: new Date().toISOString().slice(0, 10),
    date_fin: new Date().toISOString().slice(0, 10),
    heure_debut: '08:00',
    heure_fin: '17:00',
    type_permission: 'Absence ponctuelle',
    remplacant: '',
    materiel_nom: '',
    materiel_quantite: '1',
    stade_grossesse: '2 mois (8 SA)',
    date_dpa: '',
    motif: '',
    fichier_justificatif: null,
    fichier_nom: ''
  })

  useEffect(() => {
    loadDemandes()
  }, [user?.id])

  // Les demandes de l'enseignant se lisent dans le registre global, filtrées
  // sur son identifiant. C'est le seul endroit que la direction met à jour
  // quand elle répond.
  //
  // Auparavant chaque enseignant avait sa copie, `demandes_rh_<user_id>`, que
  // personne ne mettait jamais à jour — et qui n'existait même pas en base :
  // son écriture omettait la colonne `app`, obligatoire, et partait donc en
  // 400. La copie ne vivait que dans le localStorage de l'appareil, figée sur
  // « En attente » : la réponse de la direction n'atteignait jamais l'écran.
  const loadDemandes = async () => {
    try {
      const cache = localStorage.getItem(`demandes_rh_${user?.id}`)
      if (cache) { try { setDemandes(JSON.parse(cache)) } catch (e) {} }

      const { data, error } = await supabase
        .from('app_state')
        .select('value')
        .eq('app', APP_RH)
        .eq('key', 'demandes_rh_global')
        .maybeSingle()

      // Sans réponse du serveur on garde le cache : mieux vaut une liste un peu
      // ancienne qu'un écran vide. Mais on ne l'écrase jamais par du vide.
      if (error) { console.error('Demandes RH illisibles :', error.message); return }
      if (!data || !Array.isArray(data.value)) return

      const miennes = data.value.filter(d => d.user_id === user?.id)
      setDemandes(miennes)
      localStorage.setItem(`demandes_rh_${user?.id}`, JSON.stringify(miennes))
    } catch (err) {
      console.error('Erreur chargement des demandes:', err)
    }
  }

  // ⚖️ CALCUL DU CONGÉ DE MATERNITÉ CONFORME AU CODE DU TRAVAIL DU MALI (Loi n° 92-020, Art. L.179 & INPS)
  // 14 semaines au total : 6 semaines pré-natales (-42 jours) + 8 semaines post-natales (+56 jours).
  // +3 semaines supplémentaires (+21 jours) en cas de naissances multiples ou complications médicales.
  const calculerDatesMaterniteMali = (dpaStr, estMultiple = false) => {
    if (!dpaStr) return { debut: '', fin: '', dureeJours: 0, dureeSemaines: 14 }
    const dpaDate = new Date(dpaStr + 'T00:00:00')
    if (isNaN(dpaDate.getTime())) return { debut: '', fin: '', dureeJours: 0, dureeSemaines: 14 }

    // 6 semaines pré-natales (42 jours avant la DPA)
    const debutDate = new Date(dpaDate)
    debutDate.setDate(debutDate.getDate() - 42)

    // 8 semaines post-natales (56 jours après DPA) ou 11 semaines (77 jours) si complications/multiples
    const postNatalJours = estMultiple ? (8 + 3) * 7 : 8 * 7
    const finDate = new Date(dpaDate)
    finDate.setDate(finDate.getDate() + postNatalJours)

    const dureeJours = 42 + postNatalJours
    const dureeSemaines = dureeJours / 7

    return {
      debut: debutDate.toISOString().slice(0, 10),
      fin: finDate.toISOString().slice(0, 10),
      dureeJours,
      dureeSemaines
    }
  }

  const handleDPAChange = (dpaValue, isMultiple = formData.complications_grossesse) => {
    const calc = calculerDatesMaterniteMali(dpaValue, isMultiple)
    setFormData(prev => ({
      ...prev,
      date_dpa: dpaValue,
      complications_grossesse: isMultiple,
      date_debut: calc.debut || prev.date_debut,
      date_fin: calc.fin || prev.date_fin
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        fichier_justificatif: reader.result,
        fichier_nom: file.name
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMsg('')

    const nouvelleDemande = {
      id: Date.now(),
      user_id: user?.id,
      user_name: `${user?.user_metadata?.prenom || ''} ${user?.user_metadata?.nom || ''}`.trim() || user?.email || 'Enseignant',
      type: typeDemande,
      date_soumission: new Date().toISOString(),
      statut: 'En attente', // En attente | Approuvée | Refusée
      reponse_direction: '',
      details: { ...formData }
    }

    try {
      const updatedList = [nouvelleDemande, ...demandes]
      setDemandes(updatedList)

      // Cache local, pour que l'écran survive à une coupure réseau. Ce n'est
      // qu'un reflet du registre global : il n'y a plus de copie par
      // enseignant en base, elle divergeait sans jamais être relue.
      localStorage.setItem(`demandes_rh_${user?.id}`, JSON.stringify(updatedList))

      // Push dans le registre global des demandes RH pour la Direction
      const { data: globalState } = await supabase
        .from('app_state')
        .select('value')
        .eq('app', APP_RH)
        .eq('key', 'demandes_rh_global')
        .maybeSingle()

      const currentGlobal = (globalState && Array.isArray(globalState.value)) ? globalState.value : []
      const updatedGlobal = [nouvelleDemande, ...currentGlobal]

      const { error: eGlobal } = await supabase
        .from('app_state')
        .upsert({
          // `app` fait partie de la cle primaire et ne peut etre nulle :
          // sans elle l'ecriture etait refusee et la demande perdue.
          app: APP_RH,
          key: 'demandes_rh_global',
          value: updatedGlobal,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'app,key' })

      // Une demande perdue en silence est le pire des cas : l'enseignant croit
      // avoir écrit à la direction et attend une réponse qui ne viendra pas.
      if (eGlobal) {
        setLoading(false)
        setSuccessMsg('')
        alert("Votre demande n'a pas pu être transmise : " + eGlobal.message + "\nRéessayez, et prévenez la direction si cela se reproduit.")
        return
      }

      // Push notification au Directeur & Admin
      await pushNotification('directeur', {
        titre: `📩 Nouvelle demande: ${getTypeLabel(typeDemande)}`,
        message: `${nouvelleDemande.user_name} a soumis une nouvelle demande.`,
        type: 'rh',
        tabTarget: 'rh'
      })

      setSuccessMsg('✅ Votre demande a été transmise à la Direction Générale et à la Comptabilité avec succès !')
      setTabType('historique')

      // Reset form
      setFormData({
        montant: '',
        duree_mois: '3',
        mois_paie: 'Octobre 2026',
        date_debut: new Date().toISOString().slice(0, 10),
        date_fin: new Date().toISOString().slice(0, 10),
        heure_debut: '08:00',
        heure_fin: '17:00',
        type_permission: 'Absence ponctuelle',
        remplacant: '',
        materiel_nom: '',
        materiel_quantite: '1',
        materiel_estimation: '',
        urgence: 'Moyen',
        motif: '',
        fichier_justificatif: null,
        fichier_nom: ''
      })
    } catch (err) {
      console.error('Erreur soumission demande:', err)
      alert('Une erreur s\'est produite lors de l\'envoi de la demande.')
    } finally {
      setLoading(false)
    }
  }

  const getTypeLabel = (t) => {
    switch (t) {
      case 'pret': return '🏦 Demande de Prêt'
      case 'avance': return '💵 Demande d\'Avance sur Salaire'
      case 'absence': return '🗂️ Justificatif d\'Absence'
      case 'permission': return '📝 Demande de Permission'
      case 'achat': return '📦 Achat de Matériel Pédagogique'
      default: return t
    }
  }

  const getStatutBadge = (st) => {
    if (st === 'Approuvée') return <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>✅ Approuvée</span>
    if (st === 'Refusée') return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>❌ Refusée</span>
    return <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>⏳ En attente de validation</span>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0d2a3b 0%, #00a8e0 100%)', color: '#fff', borderRadius: 20, padding: '1.8rem', marginBottom: '1.5rem', boxShadow: '0 10px 30px rgba(13,42,59,0.15)' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>PORTAIL ENSEIGNANT</div>
        <h2 style={{ margin: '4px 0 6px', fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>
          📩 Demandes, Prêts &amp; Justificatifs RH
        </h2>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          Soumettez vos demandes de prêt, avance de salaire, permissions, justificatifs d'absence ou achats de matériel en toute simplicité.
        </div>
      </div>

      {/* Tabs Switch */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem' }}>
        <button
          className="btn"
          style={{ background: tabType === 'nouvelle' ? 'var(--dark)' : '#fff', color: tabType === 'nouvelle' ? '#fff' : 'var(--text)', border: '1px solid var(--border)', fontWeight: 700, borderRadius: 10, padding: '0.65rem 1.4rem', cursor: 'pointer' }}
          onClick={() => setTabType('nouvelle')}
        >
          ➕ Nouvelle Demande
        </button>
        <button
          className="btn"
          style={{ background: tabType === 'historique' ? 'var(--dark)' : '#fff', color: tabType === 'historique' ? '#fff' : 'var(--text)', border: '1px solid var(--border)', fontWeight: 700, borderRadius: 10, padding: '0.65rem 1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setTabType('historique')}
        >
          <span>📜 Mes Demandes Soumises</span>
          <span style={{ background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 900 }}>{demandes.length}</span>
        </button>
      </div>

      {successMsg && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '14px 18px', borderRadius: 12, marginBottom: '1.5rem', fontWeight: 700, border: '1px solid #bbf7d0' }}>
          {successMsg}
        </div>
      )}

      {/* TAB 1: FORMULAIRE DE SOUMISSION */}
      {tabType === 'nouvelle' && (
        <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '1.8rem' }}>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--dark)', display: 'block', marginBottom: 8 }}>
              1. Choisissez le type de demande *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.8rem' }}>
              
              <button
                type="button"
                style={{ padding: '1rem 0.8rem', borderRadius: 12, border: typeDemande === 'pret' ? '2px solid var(--accent)' : '1px solid var(--border)', background: typeDemande === 'pret' ? 'rgba(26,175,224,0.08)' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                onClick={() => setTypeDemande('pret')}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>🏦</div>
                <div style={{ fontWeight: 800, fontSize: 12, color: typeDemande === 'pret' ? 'var(--accent)' : 'var(--text)' }}>Demande de Prêt</div>
              </button>

              <button
                type="button"
                style={{ padding: '1rem 0.8rem', borderRadius: 12, border: typeDemande === 'avance' ? '2px solid var(--green)' : '1px solid var(--border)', background: typeDemande === 'avance' ? 'rgba(141,198,63,0.08)' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                onClick={() => setTypeDemande('avance')}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>💵</div>
                <div style={{ fontWeight: 800, fontSize: 12, color: typeDemande === 'avance' ? 'var(--green)' : 'var(--text)' }}>Avance sur Salaire</div>
              </button>

              <button
                type="button"
                style={{ padding: '1rem 0.8rem', borderRadius: 12, border: typeDemande === 'absence' ? '2px solid var(--amber)' : '1px solid var(--border)', background: typeDemande === 'absence' ? 'rgba(247,148,29,0.08)' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                onClick={() => setTypeDemande('absence')}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>🗂️</div>
                <div style={{ fontWeight: 800, fontSize: 12, color: typeDemande === 'absence' ? 'var(--amber)' : 'var(--text)' }}>Justificatif d'Absence</div>
              </button>

              <button
                type="button"
                style={{ padding: '1rem 0.8rem', borderRadius: 12, border: typeDemande === 'permission' ? '2px solid #8e44ad' : '1px solid var(--border)', background: typeDemande === 'permission' ? 'rgba(142,68,173,0.08)' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                onClick={() => setTypeDemande('permission')}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>📝</div>
                <div style={{ fontWeight: 800, fontSize: 12, color: typeDemande === 'permission' ? '#8e44ad' : 'var(--text)' }}>Permission d'Absence</div>
              </button>

              <button
                type="button"
                style={{ padding: '1rem 0.8rem', borderRadius: 12, border: typeDemande === 'maternite' ? '2px solid #ec4899' : '1px solid var(--border)', background: typeDemande === 'maternite' ? 'rgba(236,72,153,0.08)' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                onClick={() => setTypeDemande('maternite')}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>🤰</div>
                <div style={{ fontWeight: 800, fontSize: 12, color: typeDemande === 'maternite' ? '#ec4899' : 'var(--text)' }}>Congé Maternité</div>
              </button>

            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* DEMANDE DE PRÊT */}
            {typeDemande === 'pret' && (
              <div style={{ background: 'var(--bg)', padding: '1.2rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)', marginBottom: 10 }}>🏦 Détails de la Demande de Prêt</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Montant du prêt souhaité (FCFA) *</label>
                    <input type="number" min="5000" step="5000" required value={formData.montant} onChange={(e) => setFormData({ ...formData, montant: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 800, fontSize: 14 }} placeholder="Ex: 100000" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Durée de remboursement souhaitée</label>
                    <select value={formData.duree_mois} onChange={(e) => setFormData({ ...formData, duree_mois: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700 }}>
                      <option value="1">1 mois</option>
                      <option value="2">2 mois</option>
                      <option value="3">3 mois</option>
                      <option value="4">4 mois</option>
                      <option value="5">5 mois</option>
                      <option value="6">6 mois</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* DEMANDE D'AVANCE */}
            {typeDemande === 'avance' && (
              <div style={{ background: 'var(--bg)', padding: '1.2rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)', marginBottom: 10 }}>💵 Détails de la Demande d'Avance sur Salaire</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Montant de l'avance (FCFA) *</label>
                    <input type="number" min="2000" step="2000" required value={formData.montant} onChange={(e) => setFormData({ ...formData, montant: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 800, fontSize: 14, color: 'var(--green)' }} placeholder="Ex: 35000" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Mois de paie concerné</label>
                    <select value={formData.mois_paie} onChange={(e) => setFormData({ ...formData, mois_paie: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700 }}>
                      <option value="Octobre 2026">Octobre 2026</option>
                      <option value="Novembre 2026">Novembre 2026</option>
                      <option value="Décembre 2026">Décembre 2026</option>
                      <option value="Janvier 2027">Janvier 2027</option>
                      <option value="Février 2027">Février 2027</option>
                      <option value="Mars 2027">Mars 2027</option>
                      <option value="Avril 2027">Avril 2027</option>
                      <option value="Mai 2027">Mai 2027</option>
                      <option value="Juin 2027">Juin 2027</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* JUSTIFICATIF D'ABSENCE */}
            {typeDemande === 'absence' && (
              <div style={{ background: 'var(--bg)', padding: '1.2rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)', marginBottom: 10 }}>🗂️ Justification d'une Absence Passée ou à Venir</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Date début d'absence *</label>
                    <input type="date" required value={formData.date_debut} onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Date fin d'absence *</label>
                    <input type="date" required value={formData.date_fin} onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Pièce justificative (Certificat médical, convocation...) *</label>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileChange} style={{ fontSize: 12 }} />
                    {formData.fichier_nom && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, marginLeft: 8 }}>✓ {formData.fichier_nom}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* DEMANDE DE PERMISSION */}
            {typeDemande === 'permission' && (
              <div style={{ background: 'var(--bg)', padding: '1.2rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)', marginBottom: 10 }}>📝 Demande de Permission ou Congé Ponctuel</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Nature de la permission</label>
                    <select value={formData.type_permission} onChange={(e) => setFormData({ ...formData, type_permission: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <option value="Absence ponctuelle (1 jour)">Absence ponctuelle (1 jour)</option>
                      <option value="Absence de quelques heures">Absence de quelques heures</option>
                      <option value="Événement familial (Mariage, Naissance...)">Événement familial (Mariage, Naissance...)</option>
                      <option value="Formation / Stage professionnel">Formation / Stage professionnel</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Date prévue *</label>
                    <input type="date" required value={formData.date_debut} onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Enseignant remplaçant (optionnel)</label>
                    <input type="text" value={formData.remplacant} onChange={(e) => setFormData({ ...formData, remplacant: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)' }} placeholder="Ex: M. KITA" />
                  </div>
                </div>
              </div>
            )}

            {/* DEMANDE D'ACHAT MATÉRIEL */}
            {typeDemande === 'achat' && (
              <div style={{ background: 'var(--bg)', padding: '1.2rem', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--dark)', marginBottom: 10 }}>📦 Demande d'Achat de Matériel Pédagogique</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Intitulé du matériel demandé *</label>
                    <input type="text" required value={formData.materiel_nom} onChange={(e) => setFormData({ ...formData, materiel_nom: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700 }} placeholder="Ex: Rames de papier A4, Boîtes de craie blanche, Kit de géométrie géant..." />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Quantité souhaitée</label>
                    <input type="number" min="1" value={formData.materiel_quantite} onChange={(e) => setFormData({ ...formData, materiel_quantite: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Coût estimé (FCFA)</label>
                    <input type="number" min="0" step="500" value={formData.materiel_estimation} onChange={(e) => setFormData({ ...formData, materiel_estimation: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)' }} placeholder="Ex: 15000" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Degré d'urgence</label>
                    <select value={formData.urgence} onChange={(e) => setFormData({ ...formData, urgence: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700 }}>
                      <option value="Faible">Faible (Planifié)</option>
                      <option value="Moyen">Moyen (Besoin courant)</option>
                      <option value="Urgent">🚨 Urgent (Bloquant pour le cours)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* DEMANDE DE CONGÉ MATERNITÉ */}
            {typeDemande === 'maternite' && (
              <div style={{ background: 'rgba(236,72,153,0.04)', padding: '1.2rem', borderRadius: 12, border: '1px solid rgba(236,72,153,0.3)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#be185d', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🤰 Déclaration &amp; Demande de Congé de Maternité (Code du Travail du Mali - Art. L.179)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Stade actuel de la grossesse *</label>
                    <select value={formData.stade_grossesse} onChange={(e) => setFormData({ ...formData, stade_grossesse: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700 }}>
                      <option value="1 mois (4 SA)">1 mois (4 SA)</option>
                      <option value="2 mois (8 SA)">2 mois (8 SA)</option>
                      <option value="3 mois (12 SA - 1er Trimestre)">3 mois (12 SA - 1er Trimestre)</option>
                      <option value="4 mois (16 SA)">4 mois (16 SA)</option>
                      <option value="5 mois (20 SA - 2ème Trimestre)">5 mois (20 SA - 2ème Trimestre)</option>
                      <option value="6 mois (24 SA)">6 mois (24 SA)</option>
                      <option value="7 mois (28 SA - 3ème Trimestre)">7 mois (28 SA - 3ème Trimestre)</option>
                      <option value="8 mois (32 SA)">8 mois (32 SA)</option>
                      <option value="9 mois (36 SA)">9 mois (36 SA)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#be185d', display: 'block', marginBottom: 2 }}>Date Présumée d'Accouchement (DPA) *</label>
                    <input type="date" required value={formData.date_dpa} onChange={(e) => handleDPAChange(e.target.value)} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1.5px solid #be185d', fontWeight: 800, color: '#be185d' }} />
                  </div>

                  <div style={{ gridColumn: '1 / -1', background: 'rgba(236,72,153,0.08)', padding: '0.8rem 1rem', borderRadius: 8, border: '1px solid rgba(236,72,153,0.2)', fontSize: 12, color: '#9d174d' }}>
                    ⚖️ <b>Réglementation République du Mali (INPS &amp; Code du Travail) :</b>
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>
                      Durée légale totale : <b>14 semaines (98 jours)</b> — 6 semaines pré-natales (-42 jours avant la DPA) + 8 semaines post-natales (+56 jours après la DPA).
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      id="chk-multiple"
                      checked={formData.complications_grossesse || false}
                      onChange={(e) => handleDPAChange(formData.date_dpa, e.target.checked)}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                    <label htmlFor="chk-multiple" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}>
                      Grossesse multiple (jumeaux/triplés) ou prolongation médicale (+3 semaines post-natales)
                    </label>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Date début de congé (Pré-natal - 6 sem) *</label>
                    <input type="date" required value={formData.date_debut} onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700, color: 'var(--accent)' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Date reprise de service (Post-natal) *</label>
                    <input type="date" required value={formData.date_fin} onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })} className="inp" style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700, color: 'var(--green)' }} />
                  </div>

                  <div style={{ gridColumn: '1 / -1', background: '#fff', padding: '0.9rem', borderRadius: 8, border: '1px dashed #f472b6' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#be185d', display: 'block', marginBottom: 4 }}>
                      📄 Importer la fiche d'échographie / Déclaration médicale de grossesse *
                    </label>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileChange} style={{ fontSize: 12 }} />
                    {formData.fichier_nom && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 800, marginLeft: 8 }}>✓ Fiche d'échographie jointe: {formData.fichier_nom}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* CHAMP MOTIF COMMUN */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--dark)', display: 'block', marginBottom: 4 }}>
                Motif détaillé / Explication de la demande *
              </label>
              <textarea
                required
                rows={3}
                value={formData.motif}
                onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
                className="inp"
                style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'sans-serif' }}
                placeholder="Expliquez brièvement les raisons de votre demande à l'attention de la Direction..."
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ padding: '0.85rem 2rem', borderRadius: 12, fontSize: '1rem', fontWeight: 900, background: 'linear-gradient(135deg,#00a8e0,#0078b4)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,168,224,0.3)', marginTop: 8 }}
            >
              {loading ? '⏳ Transmission en cours...' : '🚀 Transmettre la Demande à la Direction'}
            </button>

          </form>

        </div>
      )}

      {/* TAB 2: HISTORIQUE ET SUIVI */}
      {tabType === 'historique' && (
        <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--dark)', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📜 Historique &amp; Suivi de vos Demandes</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{demandes.length} Demande(s) au total</span>
          </div>

          {demandes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--bg)', borderRadius: 12, color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📑</div>
              <p style={{ margin: 0, fontWeight: 700 }}>Aucune demande soumise pour le moment.</p>
              <p style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Utilisez l'onglet « ➕ Nouvelle Demande » pour soumettre un prêt, une avance ou une permission.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {demandes.map(d => (
                <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '1.2rem', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--dark)' }}>{getTypeLabel(d.type)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        Soumis le {new Date(d.date_soumission).toLocaleDateString('fr-FR')} à {new Date(d.date_soumission).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {getStatutBadge(d.statut)}
                  </div>

                  {/* Résumé des détails */}
                  <div style={{ background: '#fff', padding: '0.8rem 1rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, margin: '8px 0' }}>
                    {d.details?.montant && <div style={{ marginBottom: 4 }}>💵 Montant: <b style={{ color: 'var(--accent)' }}>{Number(d.details.montant).toLocaleString('fr-FR')} FCFA</b> {d.details?.duree_mois ? `(Remboursement sur ${d.details.duree_mois} mois)` : ''}</div>}
                    {d.details?.stade_grossesse && <div style={{ marginBottom: 4, color: '#be185d', fontWeight: 800 }}>🤰 Stade de grossesse: {d.details.stade_grossesse} {d.details?.date_dpa ? `· DPA prévisionnelle: ${d.details.date_dpa}` : ''}</div>}
                    {d.details?.materiel_nom && <div style={{ marginBottom: 4 }}>📦 Matériel: <b>{d.details.materiel_nom}</b> (Qté: {d.details.materiel_quantite || 1})</div>}
                    {d.details?.date_debut && <div style={{ marginBottom: 4 }}>📅 Période congé: Du <b>{d.details.date_debut}</b> au <b>{d.details.date_fin || d.details.date_debut}</b></div>}
                    {d.details?.motif && <div>💬 Motif / Notes: <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>« {d.details.motif} »</span></div>}
                    {d.details?.fichier_nom && <div style={{ marginTop: 6, color: 'var(--green)', fontWeight: 800 }}>📎 Pièce jointe / Échographie: {d.details.fichier_nom}</div>}
                  </div>

                  {d.reponse_direction && (
                    <div style={{ background: '#eff6ff', borderLeft: '4px solid var(--accent)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginTop: 8 }}>
                      <b style={{ color: 'var(--accent)' }}>💬 Réponse de la Direction / Comptabilité :</b> {d.reponse_direction}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
