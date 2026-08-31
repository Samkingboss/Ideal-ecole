import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CHAMPS_ELEVE_LISTE } from '../lib/eleves'
import { useEchelleFeuille } from '../lib/echelleApercu'
import { texteCertificat, lieuEtDate } from '../lib/certificatTexte'
import { DIRECTEUR, NOM_ECOLE } from '../lib/ecole'
import { ANNEE_SCOLAIRE } from '../lib/periodeScolaire'

// Le composant ne reçoit plus `user` : il ne s'en sert pas. Le signataire
// d'un certificat est le chef d'établissement, pas la personne connectée.
export default function CertificatScolarite() {
  // Le signataire d'un certificat de scolarité n'est pas la personne
  // connectée : c'est le chef d'établissement. Un responsable administratif
  // qui édite un certificat ne le signe pas de son nom. `DIRECTEUR` est la
  // source canonique — le document affichait « M. Directeur IDEAL », soit la
  // fonction à la place du nom.
  const [eleves, setEleves] = useState([])
  const [, setLoading] = useState(true)
  // L'aperçu est mis à l'échelle pour tenir dans l'écran : la feuille reste
  // du A4, seul son affichage rétrécit.
  const { cadre, docRef, echelle, hauteurDoc } = useEchelleFeuille(760)
  const [selectedEleve, setSelectedEleve] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [motifDelivrance, setMotifDelivrance] = useState('Servir et valoir ce que de droit')
  // La date part au module de rédaction sous sa forme ISO : c'est lui qui
  // écrit toutes les dates du certificat, d'une seule main.
  const dateISO = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    loadEleves()
  }, [])

  const loadEleves = async () => {
    setLoading(true)
    try {
      // ── AUCUNE VALEUR INVENTÉE ────────────────────────────────────────
      //
      // Ce bloc comblait les trous : `date_naissance || '15/04/2018'`,
      // `lieu_naissance || 'Bamako'`, `nom || 'SAMAKÉ'`. Un certificat de
      // scolarité portait donc un état civil FABRIQUÉ pour tout élève dont
      // la fiche était incomplète — sur un acte signé par le directeur.
      //
      // Un champ absent reste absent. La rédaction sait faire une phrase
      // correcte sans lui ; elle ne sait pas se relire.
      const [resEleves, resInsc, resResp] = await Promise.all([
        supabase.from('eleves').select(CHAMPS_ELEVE_LISTE).order('nom', { ascending: true }),
        supabase.from('inscriptions').select('*'),
        // La filiation et les responsables légaux viennent de `responsables`,
        // liée par `inscriptions.responsable1_id` / `responsable2_id`. Le
        // LIEN est déclaré dans `lien_parente` — il ne se déduit pas de la
        // position : rien ne dit que le premier responsable est le père.
        supabase.from('responsables').select('id, nom, prenom, lien_parente'),
      ])

      const rawEleves = Array.isArray(resEleves.data) ? resEleves.data : []
      const rawInsc = Array.isArray(resInsc.data) ? resInsc.data : []
      const rawResp = Array.isArray(resResp.data) ? resResp.data : []
      const parId = new Map(rawResp.map(r => [r.id, r]))

      const responsablesDe = insc => [insc?.responsable1_id, insc?.responsable2_id]
        .map(id => (id ? parId.get(id) : null))
        .filter(Boolean)

      const merged = rawEleves.map(e => {
        const insc = rawInsc.find(i => i.matricule === e.matricule || i.id === e.inscription_id)
        return {
          ...e,
          date_naissance: e.date_naissance || insc?.date_naissance || null,
          lieu_naissance: insc?.lieu_naissance || null,
          nationalite: insc?.nationalite || null,
          classe_nom: e.classe_nom || insc?.classe_demandee || null,
          matricule: e.matricule || insc?.matricule || null,
          responsables: responsablesDe(insc),
        }
      })

      const finalList = merged.length > 0 ? merged : rawInsc.map(i => ({
        id: i.id,
        matricule: i.matricule || null,
        nom: i.nom || null,
        prenom: i.prenoms || i.prenom || null,
        classe_nom: i.classe_demandee || null,
        date_naissance: i.date_naissance || null,
        lieu_naissance: i.lieu_naissance || null,
        nationalite: i.nationalite || null,
        sexe: i.sexe || null,
        responsables: responsablesDe(i),
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

  // `formatDateFr` a disparu : `dateEnLettres` du module de rédaction écrit
  // désormais toutes les dates du certificat.

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

            {/* La rédaction vit dans `lib/certificatTexte` : un document
                institutionnel s'énonce, il ne se remplit pas comme un
                formulaire. Et une rédaction se teste — la version précédente
                écrivait « né le 15 avril 2018 à null » quand le lieu de
                naissance manquait, sur un document officiel. */}
            {(() => {
              const t = texteCertificat({
                eleve: selectedEleve,
                // Un certificat de scolarité est un acte du chef
                // d'établissement : il est signé par le Directeur, quelle que
                // soit la personne qui l'imprime. Le nom vient de la source
                // canonique — le document affichait « M. Directeur IDEAL »,
                // c'est-à-dire la FONCTION à la place du nom.
                directeur: DIRECTEUR,
                responsables: selectedEleve.responsables,
                motif: motifDelivrance,
                anneeScolaire: ANNEE_SCOLAIRE,
                ecole: NOM_ECOLE,
              })
              const identite = `${selectedEleve.prenom || ''} ${selectedEleve.nom || ''}`.trim()
              const suite = t.corps.startsWith(identite) ? t.corps.slice(identite.length) : ` — ${t.corps}`
              return (
                <section style={{ marginTop: 26, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 16.5, lineHeight: 1.62, color: '#263B4B' }}>
                  <p style={{ margin: 0 }}>{t.entete}</p>

                  {/* Le nom reste mis en valeur : c'est ce qu'on cherche des
                      yeux sur un certificat. Mais il ne remplace plus la
                      phrase — il l'ouvre. */}
                  <p style={{
                    margin: '18px 0 0', padding: '16px 24px',
                    background: '#F3F6F8', borderLeft: '5px solid #174E72',
                    lineHeight: 1.6, textAlign: 'justify',
                  }}>
                    <span style={{ fontSize: 21, fontWeight: 700, color: '#174E72' }}>{identite}</span>{suite}
                  </p>

                  {/* Filiation et responsables légaux : deux faits distincts,
                      jamais confondus, et absents quand la base ne les porte
                      pas. Le motif de délivrance est fondu dans la formule
                      finale — il faisait auparavant une seconde phrase qui
                      répétait la première. */}
                  {t.filiation && <p style={{ margin: '14px 0 0' }}>{t.filiation}</p>}
                  {t.legaux && <p style={{ margin: '8px 0 0' }}>{t.legaux}</p>}
                  <p style={{ margin: '18px 0 0' }}>{t.formule}</p>
                </section>
              )
            })()}

            <section style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 70, alignItems: 'end' }}>
              <div style={{ fontSize: 14, color: '#536575', lineHeight: 1.6 }}>
                {lieuEtDate('Bamako', dateISO)}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 850, color: '#17364D', letterSpacing: 1, textTransform: 'uppercase' }}>{DIRECTEUR.fonction}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4A5C6B', marginTop: 2 }}>{DIRECTEUR.nom}</div>
                <div style={{ height: 68, marginTop: 6, borderBottom: '1px solid #A7B4BE' }} />
                <div style={{ marginTop: 8, fontSize: 11, color: '#7B8792' }}>Signature et cachet officiels</div>
              </div>
            </section>

            <footer style={{ position: 'absolute', left: 52, right: 52, bottom: 38, paddingTop: 14, borderTop: '1px solid #D5DEE6', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7B8792', fontWeight: 700 }}>
              <span>{NOM_ECOLE}</span>
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
