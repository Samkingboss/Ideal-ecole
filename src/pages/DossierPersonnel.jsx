import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { NOM_ECOLE } from '../lib/ecole'

export default function DossierPersonnel({ user, profInfo, roleLabel = 'Enseignant' }) {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)

  // State du dossier RH
  const [formData, setFormData] = useState({
    photo_url: '',
    nom: profInfo?.nom || '',
    prenom: profInfo?.prenom || '',
    genre: 'M',
    date_naissance: '',
    lieu_naissance: 'Bamako',
    nationalite: 'Malienne',
    numero_nina: '',
    situation_matrimoniale: 'Célibataire',
    nombre_enfants: 0,
    nombre_enfants_total: 0,
    nombre_enfants_mineurs: 0,
    enfants_liste: [],
    adresse: '',
    telephone: user?.phone || '',
    whatsapp: '',
    email: user?.email || '',
    contact_urgence_nom: '',
    contact_urgence_parent: '',
    contact_urgence_tel: '',
    diplome_eleve: 'Licence',
    specialite: 'Enseignement Bilingue',
    numero_inps: '',
    date_embauche: '2023-10-01',
    type_contrat: 'CDI',
    mode_paiement: 'Espèces',
    banque_nom: '',
    rib_compte: '',
    mobile_money_num: '',
    // Statut des documents joints
    doc_cni: null,
    doc_diplome: null,
    doc_cv: null,
    doc_contrat: null,
    doc_rib: null,
    doc_medical: null,
  })

  // Gestion dynamique de la liste des enfants
  const handleAddEnfant = () => {
    setFormData(prev => {
      const list = [
        ...(prev.enfants_liste || []),
        { id: Date.now(), nom_prenom: '', age: '', classe: '', scolarise_ideal: false }
      ]
      return {
        ...prev,
        enfants_liste: list,
        nombre_enfants_total: list.length
      }
    })
  }

  const handleUpdateEnfant = (index, field, value) => {
    setFormData(prev => {
      const list = [...(prev.enfants_liste || [])]
      if (list[index]) {
        list[index] = { ...list[index], [field]: value }
      }
      const minorCount = list.filter(child => {
        const a = parseInt(child.age, 10)
        return !isNaN(a) && a < 18
      }).length

      return {
        ...prev,
        enfants_liste: list,
        nombre_enfants_total: list.length,
        nombre_enfants_mineurs: minorCount
      }
    })
  }

  const handleRemoveEnfant = (index) => {
    setFormData(prev => {
      const list = [...(prev.enfants_liste || [])].filter((_, i) => i !== index)
      const minorCount = list.filter(child => {
        const a = parseInt(child.age, 10)
        return !isNaN(a) && a < 18
      }).length

      return {
        ...prev,
        enfants_liste: list,
        nombre_enfants_total: list.length,
        nombre_enfants_mineurs: minorCount
      }
    })
  }

  // Chargement du dossier RH depuis Supabase ou LocalStorage
  useEffect(() => {
    loadDossier()
  }, [user?.id])

  const loadDossier = async () => {
    setLoading(true)
    try {
      const storageKey = `dossier_rh_${user.id}`
      const localData = localStorage.getItem(storageKey)
      if (localData) {
        setFormData(prev => ({ ...prev, ...JSON.parse(localData) }))
      }

      // Supabase app_state
      const { data } = await supabase
        .from('app_state')
        .select('value')
        .eq('key', `dossier_rh_${user.id}`)
        .maybeSingle()

      if (data && data.value) {
        setFormData(prev => ({ ...prev, ...data.value }))
      }
    } catch (err) {
      console.error('Erreur chargement dossier RH:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Traitement du téléversement d'image/document en Base64 pour persistance instantanée
  const handleFileUpload = (fieldName, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        [fieldName]: reader.result,
        [`${fieldName}_name`]: file.name
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const storageKey = `dossier_rh_${user.id}`
      localStorage.setItem(storageKey, JSON.stringify(formData))

      // Sauvegarde Cloud Supabase.
      //
      // Le client Supabase ne lève pas d'exception : il rend `{ error }`. Le
      // `try/catch` autour de cet appel n'attrapait donc rien, et `setSaved`
      // s'exécutait quoi qu'il arrive — l'employé lisait « enregistré » même
      // quand le serveur avait refusé. On lit le résultat.
      const { error: errDossier } = await supabase
        .from('app_state')
        .upsert({
          // Sans `app`, colonne obligatoire de la clé primaire, le dossier
          // partait en 400 : il ne quittait jamais le téléphone de l'employé.
          app: 'rh',
          key: `dossier_rh_${user.id}`,
          value: formData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'app,key' })

      if (errDossier) {
        alert("Votre dossier n'a pas été enregistré sur le serveur : "
          + errDossier.message
          + "\n\nIl reste sur cet appareil. Signalez-le à la direction.")
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err) {
      console.error('Erreur sauvegarde dossier RH:', err)
      alert('Erreur lors de la sauvegarde du dossier.')
    } finally {
      setLoading(false)
    }
  }

  // Calcul du taux de complétude du dossier
  const fieldsToCheck = [
    'nom', 'prenom', 'date_naissance', 'lieu_naissance', 'numero_nina',
    'adresse', 'telephone', 'contact_urgence_nom', 'contact_urgence_tel',
    'diplome_eleve', 'mode_paiement', 'doc_cni', 'doc_diplome', 'doc_cv'
  ]
  const completedFields = fieldsToCheck.filter(f => Boolean(formData[f])).length
  const percentComplete = Math.round((completedFields / fieldsToCheck.length) * 100)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* ── EN-TÊTE / COMPLÉTUDE ── */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0d2a3b 0%, #1565a0 100%)', color: '#fff', borderRadius: 20, padding: '1.8rem', marginBottom: '1.5rem', boxShadow: '0 10px 30px rgba(13,42,59,0.15)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Avatar / Photo */}
          <div style={{ position: 'relative', width: 90, height: 90, borderRadius: '50%', background: '#fff', border: '4px solid rgba(255,255,255,0.3)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {formData.photo_url ? (
              <img src={formData.photo_url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ fontSize: 38, textAlign: 'center', width: '100%', color: '#0d2a3b' }}>👤</div>
            )}
            <label style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, textAlign: 'center', padding: '3px 0', cursor: 'pointer', fontWeight: 700 }}>
              📷 Photo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload('photo_url', e.target.files[0])} />
            </label>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>DOSSIER RH &amp; ADMINISTRATIF — {roleLabel}</div>
            <h2 style={{ margin: '4px 0 6px', fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>
              {formData.prenom || 'Prénom'} {formData.nom || 'Nom'}
            </h2>
            <div style={{ fontSize: 12, opacity: 0.85, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>💼 {formData.specialite || roleLabel}</span>
              <span>📄 Contrat: <b>{formData.type_contrat}</b></span>
              <span>📅 Embauche: <b>{formData.date_embauche || '2023'}</b></span>
            </div>
          </div>

          {/* Jauge de complétude */}
          <div style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 16, padding: '12px 18px', textAlign: 'center', minWidth: 160 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', fontWeight: 700, marginBottom: 4 }}>Complétude Dossier</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: percentComplete >= 80 ? '#8DC63F' : '#F7941D' }}>
              {percentComplete}%
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, height: 6, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${percentComplete}%`, background: percentComplete >= 80 ? '#8DC63F' : '#F7941D', transition: 'width 0.3s' }}></div>
            </div>
          </div>

        </div>
      </div>

      {/* Barre d'action rapide */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          🔒 Vos données sont confidentielles et sécurisées par la Direction Générale.
        </div>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button className="btn-ghost" style={{ padding: '0.6rem 1.2rem', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }} onClick={handlePrint}>
            🖨️ Imprimer la Fiche RH (PDF)
          </button>
          <button className="btn-primary" style={{ padding: '0.6rem 1.4rem', borderRadius: 10, cursor: 'pointer', fontWeight: 800, background: 'var(--accent)', color: '#fff', border: 'none' }} onClick={handleSave} disabled={loading}>
            {loading ? '⏳ Sauvegarde...' : '💾 Sauvegarder mon Dossier'}
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: 12, marginBottom: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #bbf7d0' }}>
          <span>✅</span> Votre dossier RH a été sauvegardé avec succès !
        </div>
      )}

      {/* ── FORMULAIRE PAR SECTIONS ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* SECTION 1 : ÉTAT CIVIL & IDENTITÉ */}
        <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '1.5rem' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--bg)', paddingBottom: 8 }}>
            <span>🪪</span> 1. État Civil &amp; Identité de l'Employé
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nom de famille *</label>
              <input type="text" name="nom" value={formData.nom} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: COULIBALY" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Prénom(s) *</label>
              <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: Mahamadou" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Genre</label>
              <select name="genre" value={formData.genre} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Date de naissance *</label>
              <input type="date" name="date_naissance" value={formData.date_naissance} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Lieu de naissance</label>
              <input type="text" name="lieu_naissance" value={formData.lieu_naissance} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: Bamako, Ségou, Sikasso..." />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nationalité</label>
              <input type="text" name="nationalite" value={formData.nationalite} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: Malienne" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>N° NINA / CNI / Passeport *</label>
              <input type="text" name="numero_nina" value={formData.numero_nina} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: 1 985 0000 1234 56" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Situation matrimoniale</label>
              <select name="situation_matrimoniale" value={formData.situation_matrimoniale} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }}>
                <option value="Célibataire">Célibataire</option>
                <option value="Marié(e)">Marié(e)</option>
                <option value="Divorcé(e)">Divorcé(e)</option>
                <option value="Veuf/Veuve">Veuf/Veuve</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 1.B : SITUATION FAMILIALE & ENFANTS À CHARGE */}
        <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '1.5rem' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid var(--bg)', paddingBottom: 8, flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>👨‍👩‍👧‍👦</span> Situation Familiale &amp; Enfants du Personnel
            </div>
            <button type="button" className="btn-sm" style={{ background: 'rgba(0,168,224,0.1)', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }} onClick={handleAddEnfant}>
              + Ajouter un enfant
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', marginBottom: '1.2rem' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre total d'enfants</label>
              <input type="number" min="0" name="nombre_enfants_total" value={formData.nombre_enfants_total ?? (formData.enfants_liste?.length || 0)} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700 }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre d'enfants mineurs (&lt; 18 ans)</label>
              <input type="number" min="0" name="nombre_enfants_mineurs" value={formData.nombre_enfants_mineurs ?? 0} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 700, color: 'var(--accent)' }} />
            </div>
          </div>

          {/* Liste dynamique des enfants */}
          {(formData.enfants_liste || []).length === 0 ? (
            <div style={{ background: 'var(--bg)', padding: '1.2rem', borderRadius: 10, textAlign: 'center', color: 'var(--muted)', fontSize: 12, fontStyle: 'italic' }}>
              Aucun enfant renseigné pour le moment. Cliquez sur le bouton « + Ajouter un enfant » pour saisir le prénom, l'âge et la classe de vos enfants.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {(formData.enfants_liste || []).map((enf, idx) => (
                <div key={enf.id || idx} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.9rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr)) 40px', gap: '0.8rem', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Nom &amp; Prénom enfant #{idx + 1}</label>
                    <input type="text" value={enf.nom_prenom || ''} onChange={(e) => handleUpdateEnfant(idx, 'nom_prenom', e.target.value)} className="inp" style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600 }} placeholder="Ex: COULIBALY Fanta" />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Âge (ans)</label>
                    <input type="number" min="0" max="40" value={enf.age || ''} onChange={(e) => handleUpdateEnfant(idx, 'age', e.target.value)} className="inp" style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700 }} placeholder="Ex: 8" />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Classe / Niveau scolaire</label>
                    <input type="text" value={enf.classe || ''} onChange={(e) => handleUpdateEnfant(idx, 'classe', e.target.value)} className="inp" style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }} placeholder="Ex: CP1, 6ème, Lycée..." />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Élève à IDEAL ?</label>
                    <select value={enf.scolarise_ideal ? 'Oui' : 'Non'} onChange={(e) => handleUpdateEnfant(idx, 'scolarise_ideal', e.target.value === 'Oui')} className="inp" style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: enf.scolarise_ideal ? 'var(--green)' : 'var(--muted)' }}>
                      <option value="Oui">✓ Oui (IDEAL)</option>
                      <option value="Non">Non (Autre)</option>
                    </select>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <button type="button" onClick={() => handleRemoveEnfant(idx)} style={{ background: 'rgba(237,28,36,0.1)', color: 'var(--red)', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', fontWeight: 900, marginTop: 12 }} title="Supprimer cet enfant">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* SECTION 2 : COORDONNÉES & CONTACT D'URGENCE */}
        <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '1.5rem' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--bg)', paddingBottom: 8 }}>
            <span>📍</span> 2. Coordonnées &amp; Personne à Contacter en Cas d'Urgence
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Adresse de résidence complète *</label>
              <input type="text" name="adresse" value={formData.adresse} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: Faladiè Sema, Rue 144, Porte 25, Bamako" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Téléphone principal *</label>
              <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: +223 76 00 00 00" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Numéro WhatsApp</label>
              <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: +223 66 00 00 00" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Adresse Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="professeur@gmail.com" />
            </div>

            <div style={{ gridColumn: '1 / -1', background: 'rgba(247,148,29,0.06)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(247,148,29,0.2)', marginTop: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#c05621', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                🚨 Personne à prévenir en cas d'urgence
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Nom &amp; Prénom du contact *</label>
                  <input type="text" name="contact_urgence_nom" value={formData.contact_urgence_nom} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)' }} placeholder="Ex: Mme COULIBALY Mariam" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Lien de parenté</label>
                  <input type="text" name="contact_urgence_parent" value={formData.contact_urgence_parent} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)' }} placeholder="Ex: Époux(se), Frère, Père..." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Téléphone d'urgence *</label>
                  <input type="tel" name="contact_urgence_tel" value={formData.contact_urgence_tel} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)' }} placeholder="+223 70 00 00 00" />
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* SECTION 3 : PROFIL PROFESSIONNEL & DIPLÔMES */}
        <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '1.5rem' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--bg)', paddingBottom: 8 }}>
            <span>🎓</span> 3. Qualification Professionnelle &amp; Contrat
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Dernier diplôme obtenu *</label>
              <select name="diplome_eleve" value={formData.diplome_eleve} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }}>
                <option value="DEF">DEF / Niveau Secondaire</option>
                <option value="Baccalauréat">Baccalauréat</option>
                <option value="CAPES / BT">CAPES / Brevet Technologique</option>
                <option value="DUT / BTS">DUT / BTS / DEUG</option>
                <option value="Licence">Licence LMD</option>
                <option value="Master">Master / DEA</option>
                <option value="Doctorat">Doctorat</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Spécialité / Discipline</label>
              <input type="text" name="specialite" value={formData.specialite} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: Enseignement Bilingue Anglais/FR" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Type de contrat de travail</label>
              <select name="type_contrat" value={formData.type_contrat} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }}>
                <option value="CDI">CDI (Contrat Durée Indéterminée)</option>
                <option value="CDD">CDD (Contrat Durée Déterminée)</option>
                <option value="Vacataire">Vacataire / Prestataire</option>
                <option value="Stagiaire">Stagiaire</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Date de prise de service à l'école</label>
              <input type="date" name="date_embauche" value={formData.date_embauche} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Numéro INPS / Sécurité Sociale</label>
              <input type="text" name="numero_inps" value={formData.numero_inps} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Optionnel" />
            </div>
          </div>
        </div>


        {/* SECTION 4 : PAIEMENT DE SALAIRE & COORDONNÉES BANCAIRES */}
        <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '1.5rem' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--bg)', paddingBottom: 8 }}>
            <span>💳</span> 4. Mode de Règlement &amp; Coordonnées Bancaires
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Mode de paiement souhaité *</label>
              <select name="mode_paiement" value={formData.mode_paiement} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }}>
                <option value="Espèces">Espèces (Paiement en Caisse)</option>
                <option value="Virement">Virement bancaire</option>
                <option value="Orange Money">Orange Money</option>
                <option value="Wave">Wave</option>
              </select>
            </div>

            {formData.mode_paiement === 'Virement' && (
              <>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nom de la Banque</label>
                  <input type="text" name="banque_nom" value={formData.banque_nom} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="Ex: BDM, BNDA, BOA, Ecobank..." />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>N° de Compte / RIB (IBAN)</label>
                  <input type="text" name="rib_compte" value={formData.rib_compte} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="ML01 0000 0000 0000 00" />
                </div>
              </>
            )}

            {(formData.mode_paiement === 'Orange Money' || formData.mode_paiement === 'Wave') && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>N° Mobile Money ({formData.mode_paiement})</label>
                <input type="tel" name="mobile_money_num" value={formData.mobile_money_num} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} placeholder="+223 70 00 00 00" />
              </div>
            )}
          </div>
        </div>


        {/* SECTION 5 : PIÈCES JOINTES & DOCUMENTS NUMÉRIQUES */}
        <div className="card" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: '1.5rem' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid var(--bg)', paddingBottom: 8 }}>
            <span>📁</span> 5. Documents &amp; Pièces Jointes Numériques
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem' }}>
            
            {/* Doc 1 : CNI / NINA */}
            <div style={{ border: '1px dashed var(--border)', padding: '1rem', borderRadius: 12, background: 'var(--bg)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>🪪 Pièce d'Identité (CNI / NINA)</span>
                <span style={{ color: formData.doc_cni ? 'var(--green)' : 'var(--amber)', fontSize: 11, fontWeight: 800 }}>
                  {formData.doc_cni ? '✓ Fournie' : '⚠️ Manquante'}
                </span>
              </div>
              <input type="file" accept="image/*,.pdf" style={{ fontSize: 11, marginTop: 6 }} onChange={(e) => handleFileUpload('doc_cni', e.target.files[0])} />
            </div>

            {/* Doc 2 : Diplôme */}
            <div style={{ border: '1px dashed var(--border)', padding: '1rem', borderRadius: 12, background: 'var(--bg)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>📜 Dernier Diplôme / Attestation</span>
                <span style={{ color: formData.doc_diplome ? 'var(--green)' : 'var(--amber)', fontSize: 11, fontWeight: 800 }}>
                  {formData.doc_diplome ? '✓ Fourni' : '⚠️ Manquant'}
                </span>
              </div>
              <input type="file" accept="image/*,.pdf" style={{ fontSize: 11, marginTop: 6 }} onChange={(e) => handleFileUpload('doc_diplome', e.target.files[0])} />
            </div>

            {/* Doc 3 : CV */}
            <div style={{ border: '1px dashed var(--border)', padding: '1rem', borderRadius: 12, background: 'var(--bg)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>📄 Curriculum Vitae (CV)</span>
                <span style={{ color: formData.doc_cv ? 'var(--green)' : 'var(--amber)', fontSize: 11, fontWeight: 800 }}>
                  {formData.doc_cv ? '✓ Fourni' : '⚠️ Manquant'}
                </span>
              </div>
              <input type="file" accept="image/*,.pdf" style={{ fontSize: 11, marginTop: 6 }} onChange={(e) => handleFileUpload('doc_cv', e.target.files[0])} />
            </div>

            {/* Doc 4 : Contrat */}
            <div style={{ border: '1px dashed var(--border)', padding: '1rem', borderRadius: 12, background: 'var(--bg)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>📝 Contrat de Travail</span>
                <span style={{ color: formData.doc_contrat ? 'var(--green)' : 'var(--muted)', fontSize: 11, fontWeight: 800 }}>
                  {formData.doc_contrat ? '✓ Fourni' : 'Optionnel'}
                </span>
              </div>
              <input type="file" accept="image/*,.pdf" style={{ fontSize: 11, marginTop: 6 }} onChange={(e) => handleFileUpload('doc_contrat', e.target.files[0])} />
            </div>

          </div>
        </div>

      </div>

      {/* Bouton de Sauvegarde Inférieur */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button className="btn-primary" style={{ padding: '0.85rem 2.5rem', borderRadius: 12, fontSize: '1rem', fontWeight: 900, background: 'linear-gradient(135deg, #0d2a3b, #1AAFE0)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,168,224,0.3)' }} onClick={handleSave} disabled={loading}>
          {loading ? '⏳ Enregistrement...' : '💾 Sauvegarder mon Dossier RH'}
        </button>
      </div>

      {/* ── MODAL PRÉVISUALISATION & IMPRESSION OFFICIELLE (PDF) ── */}
      {showPrintModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, overflowY: 'auto' }}>
          <div className="no-print" style={{ position: 'sticky', top: 0, background: '#fff', padding: '15px 30px', borderBottom: '2px solid #00a8e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ fontWeight: 800, color: '#0d2a3b', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, background: '#00a8e0', borderRadius: '50%' }}></div>
              FICHE DOSSIER RH OFFICIELLE DE L'EMPLOYÉ (APERÇU OFFICIEL)
            </div>
            <div style={{ display: 'flex', gap: 15 }}>
              <button onClick={() => window.print()} className="btn" style={{ background: '#00a8e0', color: '#fff', padding: '10px 20px', fontWeight: 'bold', borderRadius: 6, cursor: 'pointer', border: 'none' }}>
                🖨️ Imprimer / Sauvegarder en PDF
              </button>
              <button onClick={() => setShowPrintModal(false)} className="btn" style={{ background: '#64748b', color: '#fff', padding: '10px 20px', fontWeight: 'bold', borderRadius: 6, cursor: 'pointer', border: 'none' }}>
                ✖ Fermer
              </button>
            </div>
          </div>

          <div id="dossier-rh-print-content" style={{ maxWidth: 850, margin: '20px auto', border: '1px solid #cbd5e1', padding: '35px 45px', background: '#fff', position: 'relative', boxShadow: '0 15px 40px rgba(0,0,0,0.15)', borderRadius: 8, color: '#1e293b', fontFamily: 'sans-serif' }}>
            
            {/* Header officiel Ultra-Premium */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 24, borderBottom: '2px solid rgba(217,119,6,0.3)', paddingBottom: 24, marginBottom: 24 }}>
              <img src="/logo-ideal.png" alt="IDEAL" style={{ height: 85, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.08))' }} />

              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#d97706', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {NOM_ECOLE.toUpperCase()}
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '1.5px', marginTop: 2 }}>
                  FICHE INDIVIDUELLE DU DOSSIER RH
                </div>
              </div>
            </div>

            {/* BARRE BLEU FONCÉ : N° RÉFÉRENCE & PÉRIODE */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'inline-block', background: '#0f172a', color: '#ffffff', padding: '12px 36px', borderRadius: 36, border: '2.5px solid #d97706', boxShadow: '0 6px 20px rgba(15,23,42,0.25)' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  📜 FICHE OFFICIELLE • N° RÉE: RH-{user?.id?.slice(0, 6)?.toUpperCase() || '2026'}
                </div>
              </div>
            </div>

            {/* Photo & Identité Principale */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, background: '#f8fafc', padding: 15, borderRadius: 10, border: '1px solid #e2e8f0', alignItems: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#cbd5e1', overflow: 'hidden', flexShrink: 0, border: '3px solid #0d2a3b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {formData.photo_url ? (
                  <img src={formData.photo_url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: 36, color: '#475569' }}>👤</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0d2a3b' }}>
                  {formData.prenom || '—'} {formData.nom || '—'}
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#00a8e0', fontWeight: 800, marginTop: 2 }}>
                  {formData.specialite || roleLabel} · Contrat {formData.type_contrat} (Prise de service: {formData.date_embauche || '2023'})
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 4 }}>
                  📍 Adresse: {formData.adresse || 'Bamako'} · 📞 Tel: {formData.telephone || '—'} · ✉️ {formData.email || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'center', background: '#fff', padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Dossier Validé à</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: percentComplete >= 80 ? '#166534' : '#d97706' }}>{percentComplete}%</div>
              </div>
            </div>

            {/* Section 1: Etat Civil */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0d2a3b', textTransform: 'uppercase', borderBottom: '1.5px solid #00a8e0', paddingBottom: 4, marginBottom: 8 }}>
                1. État Civil &amp; Informations Personnelles
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#475569', width: '25%' }}>Date &amp; Lieu de Naissance:</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{formData.date_naissance || '—'} à {formData.lieu_naissance || '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#475569', width: '25%' }}>Nationalité:</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{formData.nationalite || 'Malienne'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#475569' }}>N° NINA / CNI / Passeport:</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0d2a3b' }}>{formData.numero_nina || '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#475569' }}>Situation Matrimoniale:</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{formData.situation_matrimoniale || 'Célibataire'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Famille & Enfants */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0d2a3b', textTransform: 'uppercase', borderBottom: '1.5px solid #00a8e0', paddingBottom: 4, marginBottom: 8 }}>
                2. Situation Familiale &amp; Enfants à Charge ({formData.enfants_liste?.length || 0} enfant(s) au total, {formData.nombre_enfants_mineurs || 0} mineur(s))
              </div>
              {(formData.enfants_liste || []).length === 0 ? (
                <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#64748b' }}>Aucun enfant à charge enregistré.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid #cbd5e1' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.72rem', color: '#475569' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #cbd5e1' }}>Nom &amp; Prénom Enfant</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>Âge</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #cbd5e1' }}>Classe / Niveau</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', border: '1px solid #cbd5e1' }}>Élève IDEAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.enfants_liste.map((e, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{e.nom_prenom || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>{e.age ? `${e.age} ans` : '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{e.classe || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: e.scolarise_ideal ? '#166534' : '#64748b' }}>
                          {e.scolarise_ideal ? '✓ Oui (IDEAL)' : 'Non'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Section 3: Diplomes & Banque */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0d2a3b', textTransform: 'uppercase', borderBottom: '1.5px solid #00a8e0', paddingBottom: 4, marginBottom: 8 }}>
                  3. Qualification &amp; INPS
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
                  <div>🎓 Diplôme le plus élevé: <b>{formData.diplome_eleve || 'Licence'}</b></div>
                  <div>💼 Spécialité: <b>{formData.specialite || 'Enseignement'}</b></div>
                  <div>📑 N° INPS: <b>{formData.numero_inps || 'Non renseigné'}</b></div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0d2a3b', textTransform: 'uppercase', borderBottom: '1.5px solid #00a8e0', paddingBottom: 4, marginBottom: 8 }}>
                  4. Mode de Paiement &amp; RIB
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
                  <div>💳 Mode de paiement: <b>{formData.mode_paiement || 'Espèces'}</b></div>
                  {formData.mode_paiement === 'Virement Bancaire' && <div>🏦 Banque / Compte RIB: <b>{formData.banque_nom} - {formData.rib_compte}</b></div>}
                  {formData.mobile_money_num && <div>📱 Mobile Money: <b>{formData.mobile_money_num}</b></div>}
                  <div>🚨 Urgence: <b>{formData.contact_urgence_nom} ({formData.contact_urgence_parent}) — {formData.contact_urgence_tel}</b></div>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 35, paddingTop: 15, borderTop: '1px solid #cbd5e1' }}>
              <div style={{ width: '45%', textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Signature de l'Employé(e)</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>« Lu et certifié exact »</div>
                <div style={{ height: 50, margin: '8px 0', border: '1px dashed #cbd5e1', borderRadius: 6 }}></div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{formData.prenom} {formData.nom}</div>
              </div>

              <div style={{ width: '45%', textAlign: 'center' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0d2a3b', textTransform: 'uppercase' }}>Le Directeur Général / DRH</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>Visa &amp; Cachet de l'Établissement</div>
                <div style={{ height: 50, margin: '8px 0', border: '1px dashed #cbd5e1', borderRadius: 6 }}></div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Fait à Bamako, le {new Date().toLocaleDateString('fr-FR')}</div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
