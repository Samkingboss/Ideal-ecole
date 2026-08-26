import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { signature } from '../lib/identiteProfessionnelle'
import { CHAMPS_ELEVE_LISTE } from '../lib/eleves'
import { useEchelleFeuille } from '../lib/echelleApercu'

export default function CertificatScolarite({ user = null }) {
  // Le signataire n'est pas « le Directeur » écrit en dur : c'est la personne
  // qui délivre le certificat, avec la fonction que lui donne son rôle. Un
  // responsable administratif habilité signera de son propre titre.
  const signataire = signature(user, { role: user?.role || 'directeur' })
  const [eleves, setEleves] = useState([])
  const [, setLoading] = useState(true)
  // L'aperçu est mis à l'échelle pour tenir dans l'écran : la feuille reste
  // du A4, seul son affichage rétrécit.
  const { cadre, docRef, echelle, hauteurDoc } = useEchelleFeuille(760)
  const [selectedEleve, setSelectedEleve] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [motifDelivrance, setMotifDelivrance] = useState('Servir et valoir ce que de droit')
  const dateFormatee = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    loadEleves()
  }, [])

  const loadEleves = async () => {
    setLoading(true)
    try {
      const [resEleves, resInsc] = await Promise.all([
        supabase.from('eleves').select(CHAMPS_ELEVE_LISTE).order('nom', { ascending: true }),
        supabase.from('inscriptions').select('*')
      ])

      const rawEleves = Array.isArray(resEleves.data) ? resEleves.data : []
      const rawInsc = Array.isArray(resInsc.data) ? resInsc.data : []

      const merged = rawEleves.map(e => {
        const matchingInsc = rawInsc.find(i => i.matricule === e.matricule || i.id === e.inscription_id)
        return {
          ...e,
          date_naissance: e.date_naissance || matchingInsc?.date_naissance || '15/04/2018',
          lieu_naissance: matchingInsc?.lieu_naissance || 'Bamako',
          nationalite: matchingInsc?.nationalite || 'Malienne',
          classe_nom: e.classe_nom || matchingInsc?.classe_demandee || 'CP1 Bilingue',
          matricule: e.matricule || matchingInsc?.matricule || '24-25 A014'
        }
      })

      const finalList = merged.length > 0 ? merged : rawInsc.map(i => ({
        id: i.id,
        matricule: i.matricule || '24-25 A014',
        nom: i.nom || 'SAMAKÉ',
        prenom: i.prenoms || i.prenom || 'Mamadou',
        classe_nom: i.classe_demandee || 'CP1 Bilingue',
        date_naissance: i.date_naissance || '2018-04-15',
        lieu_naissance: i.lieu_naissance || 'Bamako',
        nationalite: i.nationalite || 'Malienne',
        sexe: i.sexe || 'M'
      }))

      const demoList = finalList.length > 0 ? finalList : [
        {
          id: 'demo-1',
          matricule: '24-25 A014',
          nom: 'SAMAKÉ',
          prenom: 'Mamadou',
          classe_nom: 'CP1 Bilingue',
          date_naissance: '2018-04-15',
          lieu_naissance: 'Bamako',
          nationalite: 'Malienne',
          sexe: 'M'
        },
        {
          id: 'demo-2',
          matricule: '24-25 A088',
          nom: 'DIARRA',
          prenom: 'Aïssata',
          classe_nom: 'CE2 Bilingue',
          date_naissance: '2016-11-03',
          lieu_naissance: 'Bamako',
          nationalite: 'Malienne',
          sexe: 'F'
        }
      ]

      setEleves(demoList)
      if (demoList.length > 0) setSelectedEleve(demoList[0])
    } catch (err) {
      console.error('Erreur chargement élèves pour certificat:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredEleves = eleves.filter(e =>
    `${e.nom} ${e.prenom} ${e.matricule} ${e.classe_nom}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handlePrint = () => {
    window.print()
  }

  const formatDateFr = (dateStr) => {
    if (!dateStr) return ''
    try {
      const texte = String(dateStr).trim()
      const fr = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      const d = fr
        ? new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]))
        : new Date(texte)
      if (Number.isNaN(d.getTime())) return texte.toLowerCase().includes('invalid') ? 'Non renseignée' : texte
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* En-tête du volet Certificat de Scolarité */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#0d2a3b', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📜 Certificats de Scolarité Officiels</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Document d'attestation officiel rédigé selon la charte graphique Haute Qualité d'IDEAL.
          </p>
        </div>

        <button
          onClick={handlePrint}
          style={{
            background: 'linear-gradient(135deg, #d97706, #b45309)',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 12,
            fontWeight: 900,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(217,119,6,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>🖨️ Imprimer Certificat Officiel (PDF / A4)</span>
        </button>
      </div>

      {/* Barre de sélection & Recherche */}
      <div className="no-print" style={{ background: '#fff', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Rechercher un élève
          </label>
          <input
            type="text"
            placeholder="Saisir nom, prénom ou matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none' }}
          />
        </div>

        <div style={{ width: 260 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Élèves inscrits ({filteredEleves.length})
          </label>
          <select
            value={selectedEleve?.id || ''}
            onChange={(e) => {
              const found = eleves.find(x => String(x.id) === String(e.target.value))
              if (found) setSelectedEleve(found)
            }}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#fff' }}
          >
            {filteredEleves.map(el => (
              <option key={el.id} value={el.id}>
                {el.nom.toUpperCase()} {el.prenom} ({el.matricule}) — {el.classe_nom}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 220px' }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Motif de délivrance
          </label>
          <input
            type="text"
            value={motifDelivrance}
            onChange={(e) => setMotifDelivrance(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13 }}
          />
        </div>
      </div>

      {/* Certificat A4 officiel - une seule composition pour l'écran et le papier. */}
      {selectedEleve && (
        <div ref={cadre} className="certificat-cadre" style={{
          width: '100%', padding: '0 8px 24px', boxSizing: 'border-box',
          // La hauteur suit la réduction : `transform` ne change pas la place
          // occupée dans le flux, et sans cela l'aperçu laisserait sous lui un
          // vide de la hauteur pleine. Le défilement horizontal disparaît —
          // c'était lui, le débordement à l'écran.
          height: echelle < 1 && hauteurDoc ? hauteurDoc * echelle + 24 : undefined,
          overflow: 'hidden',
        }}>
          <div
            id="certificat-print-area"
            ref={docRef}
            style={{
              width: 760,
              height: 1075,
              transform: echelle < 1 ? `scale(${echelle})` : undefined,
              transformOrigin: 'top left',
              background: '#fff',
              padding: '46px 52px 38px',
              boxSizing: 'border-box',
              boxShadow: '0 22px 55px rgba(15,35,60,.16)',
              position: 'relative',
              color: '#0f172a',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid #dbe3ea'
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, width: 16, bottom: 0, background: '#174E72' }} />
            <div style={{ position: 'absolute', top: 0, left: 16, width: 5, height: 170, background: '#F28C28' }} />
            <div style={{ position: 'absolute', inset: 24, border: '1px solid #D5DEE6', pointerEvents: 'none' }} />
            <img src="/logo-ideal-symbole.png" alt="" style={{ position: 'absolute', width: 260, height: 220, objectFit: 'contain', opacity: .025, right: 85, top: 390, pointerEvents: 'none' }} />

            <header style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: 24, paddingBottom: 24, borderBottom: '3px solid #174E72' }}>
              <img src="/logo-ideal-symbole.png" alt="IDEAL" style={{ width: 112, height: 92, objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#174E72', letterSpacing: .6 }}>IDEAL ÉCOLE</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#64748B', fontWeight: 750, letterSpacing: 1 }}>ÉCOLE INTERNATIONALE BILINGUE</div>
                <div style={{ marginTop: 7, fontSize: 12, color: '#85929F', fontWeight: 650 }}>Faladié Sema - Bamako, Mali</div>
              </div>
            </header>

            <section style={{ textAlign: 'center', marginTop: 26 }}>
              <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 850, color: '#F28C28', letterSpacing: 2.2 }}>DOCUMENT OFFICIEL</div>
              <h1 style={{ margin: '8px 0 0', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 37, fontWeight: 700, color: '#17364D', letterSpacing: 1.2 }}>CERTIFICAT DE SCOLARITÉ</h1>
              <div style={{ width: 90, height: 4, margin: '14px auto 0', background: '#F28C28' }} />
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: '#64748B', letterSpacing: 1 }}>ANNÉE SCOLAIRE 2026 - 2027</div>
            </section>

            <section style={{ marginTop: 26, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 16.5, lineHeight: 1.55, color: '#263B4B' }}>
              <p style={{ margin: 0 }}>Je soussigné, {signataire.fonction} de l'École Internationale Bilingue IDEAL, certifie que :</p>

              <div style={{ margin: '16px 0', padding: '15px 24px', background: '#F3F6F8', borderLeft: '5px solid #174E72' }}>
                <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: 850, color: '#7B8792', letterSpacing: 1.4 }}>ÉLÈVE</div>
                <div style={{ marginTop: 5, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 24, lineHeight: 1.15, fontWeight: 700, color: '#174E72', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
                  {selectedEleve.prenom} {selectedEleve.nom}
                </div>
                <div style={{ marginTop: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 30px', fontFamily: 'system-ui, sans-serif' }}>
                  {[
                    ['Matricule', selectedEleve.matricule],
                    ['Classe fréquentée', selectedEleve.classe_nom],
                    ['Né(e) le', `${formatDateFr(selectedEleve.date_naissance)} à ${selectedEleve.lieu_naissance}`],
                    ['Nationalité', selectedEleve.nationalite || 'Malienne'],
                  ].map(([label, valeur]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: '#7B8792', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .8 }}>{label}</div>
                      <div style={{ marginTop: 3, fontSize: 14, lineHeight: 1.25, color: '#20394B', fontWeight: 800 }}>{valeur}</div>
                    </div>
                  ))}
                </div>
              </div>

              <p style={{ margin: 0 }}>
                est régulièrement inscrit(e) dans notre établissement et fréquente les cours de la classe indiquée ci-dessus durant l'année scolaire 2026 - 2027.
              </p>
              <p style={{ margin: '12px 0 0' }}>
                En foi de quoi, le présent certificat lui est délivré pour <strong style={{ color: '#174E72' }}>{motifDelivrance.toLowerCase()}</strong>.
              </p>
            </section>

            <section style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 70, alignItems: 'end' }}>
              <div style={{ fontSize: 14, color: '#536575', lineHeight: 1.6 }}>
                Fait à Bamako,<br />le <strong style={{ color: '#17364D' }}>{dateFormatee}</strong>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 850, color: '#17364D', letterSpacing: 1, textTransform: 'uppercase' }}>{signataire.fonction}</div>
                {signataire.nom && <div style={{ fontSize: 11, fontWeight: 700, color: '#4A5C6B', marginTop: 2 }}>{signataire.nom}</div>}
                <div style={{ height: 68, marginTop: 6, borderBottom: '1px solid #A7B4BE' }} />
                <div style={{ marginTop: 8, fontSize: 11, color: '#7B8792' }}>Signature et cachet officiels</div>
              </div>
            </section>

            <footer style={{ position: 'absolute', left: 52, right: 52, bottom: 38, paddingTop: 14, borderTop: '1px solid #D5DEE6', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7B8792', fontWeight: 700 }}>
              <span>École Internationale Bilingue IDEAL</span>
              <span>Réf. {selectedEleve.matricule} / 2026-2027</span>
            </footer>
          </div>
        </div>
      )}

      {/* Style d'impression A4 */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          /* Une hauteur de 297mm sur html/body produisait la deuxieme page : un
             document haut d'exactement une page, plus le moindre arrondi de
             rendu, en reclame une seconde. On laisse la hauteur libre et on
             borne la seule boite qui compte. */
          html, body { width: 210mm; height: auto !important; margin: 0 !important;
                       padding: 0 !important; background: #fff !important;
                       overflow: hidden !important; }
          body * { visibility: hidden !important; }
          #certificat-print-area, #certificat-print-area * { visibility: visible !important; }
          .certificat-cadre { height: auto !important; overflow: visible !important; }
          #certificat-print-area {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            box-shadow: none !important;
            /* L'apercu ecran met la feuille a l'echelle. Sans cette remise a
               zero, le tirage sortirait le certificat reduit, cale en haut a
               gauche. */
            transform: none !important;
            width: 210mm !important;
            /* 296,8 et non 297 : deux dixiemes de millimetre de marge contre
               les arrondis de rendu, qui suffisent a declencher une page
               blanche. Invisible a l'oeil, decisif a l'impression. */
            height: 296.8mm !important;
            max-height: 296.8mm !important;
            overflow: hidden !important;
            padding: 12.7mm 13.8mm 10mm !important;
            border-radius: 0 !important;
            border: 0 !important;
            break-inside: avoid !important; page-break-inside: avoid !important;
            break-after: avoid !important; page-break-after: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
}
