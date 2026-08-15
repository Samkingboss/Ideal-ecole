import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function DossierPersonnel({ user, profInfo }) {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

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

      // Sauvegarde Cloud Supabase
      await supabase
        .from('app_state')
        .upsert({
          key: `dossier_rh_${user.id}`,
          value: formData,
          updated_at: new Date().toISOString()
        })

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
          <div style={{ position: 'relative', width: 90, height: 90, borderRadius: '50%', background: '#fff', border: '4px solid rgba(255,255,255,0.3)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
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
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>DOSSIER RH & ADMINISTRATIF DE L'ENSEIGNANT</div>
            <h2 style={{ margin: '4px 0 6px', fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>
              {formData.prenom || 'Prénom'} {formData.nom || 'Nom'}
            </h2>
            <div style={{ fontSize: 12, opacity: 0.85, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>💼 {formData.specialite || 'Enseignant'}</span>
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
            <div style="background:rgba(255,255,255,0.2); border-radius:10px; height:6px; margin-top:6px; overflow:hidden;">
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
          <button className="btn-ghost" style={{ padding: '0.6rem 1.2rem', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }} onclick={handlePrint}>
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

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Enfants à charge</label>
              <input type="number" min="0" name="nombre_enfants" value={formData.nombre_enfants} onChange={handleChange} className="inp" style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} />
            </div>
          </div>
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

    </div>
  )
}
