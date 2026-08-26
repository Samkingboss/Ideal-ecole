import { useState, useEffect, Fragment } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { WHATSAPP_ECOLE_LISIBLE } from '../lib/ecole'
import { CHAMPS_ELEVE_AVEC_PHOTO } from '../lib/eleves'
import { useEchelleFeuille } from '../lib/echelleApercu'
import {
  CARTE_L, CARTE_H, COLONNES, PAR_PLANCHE, GOUTTIERE,
  A4, MARGE_X, MARGE_Y,
  planches, miroirRangees, nombreDeFeuilles, unites, tailleNom,
} from '../lib/carteScolaire'

// ─────────────────────────────────────────────────────────────────────
// GABARIT
//
// Format fini CR80 (ISO 7810 ID-1) en PORTRAIT : 53,98 × 85,60 mm, la carte
// bancaire tournée d'un quart de tour. Les dimensions et la géométrie de la
// planche vivent dans `lib/carteScolaire` — la feuille de style d'impression
// en gardait sa propre copie en dur, et deux jeux de nombres décrivant la
// même planche finissent toujours par diverger.
//
// Le dessin est exprimé en millimètres. `unites('mm')` les rend tels quels
// pour le papier ; `unites('px', ECHELLE)` les convertit pour l'aperçu à
// l'écran, où l'on veut pouvoir réduire.
// ─────────────────────────────────────────────────────────────────────
const ECHELLE = 3.6     // px par mm à l'écran — 194 × 308 px
// La largeur d'une feuille A4 en pixels CSS : la référence de la réduction.
const A4_LARGEUR_PX = A4.largeur * 96 / 25.4   // ≈ 794 px

const C = {
  marine:  '#1A2B4C',   // NAVY du Design System documentaire
  bleu:    '#174E9E',   // BLEU des titres de section
  bleuClr: '#96BFEB',
  bleuPal: '#F0F6FD',
  ambre:   '#F59E0B',
  texte:   '#0F172A',
  gris:    '#64748B',
}

const ORIGINE = typeof window !== 'undefined' ? window.location.origin : ''

function Placeholder({ eleve, mm }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: mm(1),
      background: `linear-gradient(160deg, ${C.bleuPal} 0%, #dbeafe 100%)`, color: C.bleu,
    }}>
      <div style={{ fontSize: mm(9), lineHeight: 1 }}>👤</div>
      <div style={{ fontSize: mm(4.4), fontWeight: 900, letterSpacing: mm(0.2) }}>
        {`${eleve.prenom?.[0] || ''}${eleve.nom?.[0] || ''}`.toUpperCase()}
      </div>
    </div>
  )
}

// ── RECTO ────────────────────────────────────────────────────────────
export function CarteRecto({ eleve, echelle = ECHELLE, unite = 'px' }) {
  const mm = unites(unite, echelle)
  const photo = eleve.photo_url || eleve.photo_signee || null

  return (
    <div className="carte" style={{
      width: mm(CARTE_L), height: mm(CARTE_H), borderRadius: mm(3),
      overflow: 'hidden', position: 'relative',
      background: '#FFFFFF',
      boxShadow: '0 12px 30px rgba(15,23,42,0.24)',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      color: C.texte, boxSizing: 'border-box',
    }}>
      {/* Filet extérieur rappelant le porte-carte blanc du modèle. */}
      <div style={{ position: 'absolute', inset: mm(1.5), border: `${mm(.45)} solid #E4E8EC`, borderRadius: mm(2.1), pointerEvents: 'none', zIndex: 5 }} />

      {/* Deux aplats parfaitement nets : bleu institutionnel et gris perle. */}
      <div style={{ position: 'absolute', inset: `${mm(2)} ${mm(2)} auto`, height: mm(42), background: '#174E72' }} />
      <div style={{ position: 'absolute', left: mm(2), right: mm(2), top: mm(42), bottom: mm(2), background: '#F1F2F3' }} />

      {/* Marque et établissement dans la partie supérieure. */}
      <div style={{ position: 'absolute', top: mm(4.8), left: mm(5), right: mm(5), display: 'flex', alignItems: 'center', gap: mm(1.4), color: '#fff' }}>
        <img src="/logo-ideal-symbole.png" alt="IDEAL" style={{ width: mm(12), height: mm(10.5), objectFit: 'contain', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.22))' }} />
        <div>
          <div style={{ fontSize: mm(2.25), fontWeight: 850, letterSpacing: mm(.05) }}>IDEAL ÉCOLE</div>
          <div style={{ marginTop: mm(.5), fontSize: mm(1.25), fontWeight: 650, color: '#C8E3F1', letterSpacing: mm(.04) }}>INTERNATIONALE · BILINGUE</div>
        </div>
      </div>
      <div style={{ position: 'absolute', top: mm(18), left: mm(7), display: 'flex', alignItems: 'center', gap: mm(1.5), color: '#D7E8F2' }}>
        <span style={{ width: mm(7), height: mm(.65), background: '#F28C28' }} />
        <span style={{ fontSize: mm(1.45), fontWeight: 800, letterSpacing: mm(.12) }}>CARTE SCOLAIRE OFFICIELLE</span>
      </div>

      {/* Photo carrée à cheval sur les deux aplats, signature du modèle. */}
      <div style={{
        position: 'absolute', top: mm(23), left: mm(7), width: mm(24), height: mm(33),
        overflow: 'hidden', background: '#DDE8EF', border: `${mm(.6)} solid #fff`,
        boxShadow: '0 5px 14px rgba(23,78,114,.25)', zIndex: 2,
      }}>
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 27%' }} />
          : <Placeholder eleve={eleve} mm={mm} />}
      </div>

      {/* Accent orange à droite : remplacement volontaire du vert du modèle. */}
      <div style={{ position: 'absolute', top: mm(49), right: mm(7), width: mm(13), height: mm(2.3), background: '#F28C28' }} />

      {/* Bloc d'identité compact et éditorial. */}
      <div style={{ position: 'absolute', left: mm(7), right: mm(7), top: mm(60), bottom: mm(5), color: '#16384F' }}>
        {/* Le nom ne se tronque JAMAIS. Il était rendu sur une ligne avec
            `text-overflow: ellipsis` : un élève réel sortait « Akotsi
            Abatsogad… » sur sa carte officielle. Une carte d'identité
            scolaire qui ampute le nom qu'elle porte ne vaut rien.
            `tailleNom` choisit le cran — une ligne s'il tient, deux sinon,
            taille réduite d'un pas au besoin. */}
        {(() => {
          const nom = tailleNom(`${eleve.prenom || ''} ${eleve.nom || ''}`)
          return (
            <div style={{
              fontSize: mm(nom.taille), fontWeight: 900, lineHeight: 1.08,
              // Une césure au milieu d'un nom propre serait pire que deux
              // lignes : on coupe entre les mots, jamais dans un mot, sauf
              // pour un mot seul plus large que la carte.
              overflowWrap: 'break-word', hyphens: 'none',
            }}>{nom.texte}</div>
          )
        })()}
        <div style={{ marginTop: mm(1.5), display: 'grid', gridTemplateColumns: `1fr ${mm(16)}`, gap: mm(2), alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: mm(2.05), fontWeight: 750, color: '#F28C28' }}>{eleve.classe_nom}</div>
            <div style={{ marginTop: mm(1.7), fontSize: mm(2.15), fontWeight: 850, letterSpacing: mm(.08) }}>{eleve.matricule}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#174E72' }}>
            <span aria-hidden="true" style={{ display: 'block', width: mm(13), height: mm(3.1), borderBottom: `${mm(.18)} solid #174E72` }} />
            <span style={{ marginTop: mm(.55), fontSize: mm(1.15), fontWeight: 800, color: '#7C8993', letterSpacing: mm(.05) }}>LE DIRECTEUR</span>
          </div>
        </div>
        <div style={{ marginTop: mm(1.7), paddingTop: mm(1.1), borderTop: `${mm(.25)} solid #CBD2D8`, display: 'flex', justifyContent: 'space-between', fontSize: mm(1.45), fontWeight: 750, color: '#6F7D88', letterSpacing: mm(.05) }}>
          <span>CARTE D'ÉLÈVE</span><span>2026—2027</span>
        </div>
        <div style={{ position: 'absolute', right: 0, bottom: 0, display: 'flex', gap: mm(.7) }}>
          {['#95D600', '#08C9C9', '#F2A400', '#E50093'].map(couleur => <span key={couleur} style={{ width: mm(1.3), height: mm(1.3), borderRadius: '50%', background: couleur }} />)}
        </div>
      </div>
    </div>
  )
}

// ── VERSO ────────────────────────────────────────────────────────────
export function CarteVerso({ eleve, echelle = ECHELLE, unite = 'px' }) {
  const mm = unites(unite, echelle)
  // Même URL de vérification que le QR de la fiche d'inscription.
  // Le QR porte le matricule ET le nom, tous deux imprimés sur la carte.
  //
  // Le matricule seul ne suffit plus à vérifier : les matricules sont
  // séquentiels, et une boucle aurait extrait le nom et la classe de tous les
  // élèves de l'école. Exiger les deux transforme la vérification : on ne
  // DÉCOUVRE plus une identité, on CONFIRME celle qui est sur la carte qu'on
  // tient. Celui qui scanne a la carte ; il a donc les deux.
  const lien = `${ORIGINE}/fiche.html?matricule=${encodeURIComponent(eleve.matricule || '')}`
              + `&nom=${encodeURIComponent(eleve.nom || '')}`

  return (
    <div className="carte" style={{
      width: mm(CARTE_L), height: mm(CARTE_H), borderRadius: mm(3),
      overflow: 'hidden', position: 'relative', background: '#fff',
      boxShadow: '0 10px 26px rgba(15,23,42,0.20)',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      color: C.texte, boxSizing: 'border-box',
    }}>

      <div style={{ position: 'absolute', inset: mm(1.5), border: `${mm(.45)} solid #E4E8EC`, borderRadius: mm(2.1), pointerEvents: 'none', zIndex: 5 }} />
      <div style={{ position: 'absolute', inset: `${mm(2)} ${mm(2)} auto`, height: mm(27), background: '#174E72' }} />
      <div style={{ position: 'absolute', left: mm(2), right: mm(2), top: mm(27), bottom: mm(2), background: '#F1F2F3' }} />

      <div style={{ position: 'absolute', top: mm(4.5), left: mm(5), right: mm(5), display: 'flex', alignItems: 'center', gap: mm(1.4), color: '#fff' }}>
        <img src="/logo-ideal-symbole.png" alt="IDEAL" style={{ width: mm(11), height: mm(9.5), objectFit: 'contain' }} />
        <div>
          <div style={{ fontSize: mm(2.1), fontWeight: 850 }}>VÉRIFICATION ÉLÈVE</div>
          <div style={{ marginTop: mm(.6), fontSize: mm(1.3), color: '#C8E3F1', fontWeight: 650 }}>IDEAL ÉCOLE · BAMAKO</div>
        </div>
      </div>

      {/* QR central à cheval sur les deux zones, comme la photo du recto. */}
      <div style={{
        position: 'absolute', top: mm(17), left: mm(14), width: mm(26), height: mm(26),
        background: '#fff', border: `${mm(.6)} solid #fff`, padding: mm(1.2), boxSizing: 'border-box',
        boxShadow: '0 5px 14px rgba(23,78,114,.24)', zIndex: 2,
      }}>
        <QRCodeSVG value={lien} size={mm(22.4)} level="M" bgColor="#ffffff" fgColor="#174E72" />
      </div>
      <div style={{ position: 'absolute', top: mm(45), left: 0, right: 0, textAlign: 'center', fontSize: mm(1.7), color: '#6F7D88', fontWeight: 750 }}>Scanner pour vérifier la fiche</div>
      <div style={{ position: 'absolute', top: mm(49), right: mm(7), width: mm(13), height: mm(2.3), background: '#F28C28' }} />

      <div style={{ position: 'absolute', left: mm(7), right: mm(7), top: mm(54), bottom: mm(5), color: '#16384F' }}>
        {[
          ['MATRICULE', eleve.matricule],
          ['ANNÉE SCOLAIRE', '2026—2027'],
          ['GROUPE SANGUIN', eleve.groupe_sanguin || '—'],
        ].map(([label, valeur]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${mm(1.4)} 0`, borderBottom: `${mm(.2)} solid #D5DBE0` }}>
            <span style={{ fontSize: mm(1.45), color: '#74828D', fontWeight: 800, letterSpacing: mm(.07) }}>{label}</span>
            <span style={{ fontSize: mm(2.15), color: label === 'GROUPE SANGUIN' ? '#C62828' : '#16384F', fontWeight: 850 }}>{valeur}</span>
          </div>
        ))}
        {/* Contact en cas de perte, en toutes lettres.
            Le QR ne peut pas porter cette fonction : il faut savoir qu'un
            carré noir se scanne, et disposer d'un téléphone qui le fasse.
            Une personne qui ramasse une carte dans la rue à Bamako doit
            pouvoir lire un numéro et appeler. Le numéro vient de la source
            institutionnelle unique — jamais recopié ici. */}
        <div style={{ marginTop: mm(2.2), fontSize: mm(1.6), color: '#6F7D88', lineHeight: 1.3, textAlign: 'center' }}>
          Carte strictement personnelle.
        </div>
        <div style={{
          marginTop: mm(1.2), padding: `${mm(1.5)} ${mm(1.2)}`, borderRadius: mm(1.2),
          background: '#FDF1E4', border: `${mm(.25)} solid #F28C28`, textAlign: 'center',
        }}>
          <div style={{ fontSize: mm(1.4), color: '#8A5A22', fontWeight: 800, letterSpacing: mm(.05) }}>
            EN CAS DE PERTE, APPELER L'ÉCOLE
          </div>
          <div style={{ fontSize: mm(2.3), color: '#16384F', fontWeight: 900, marginTop: mm(.5), letterSpacing: mm(.06) }}>
            {WHATSAPP_ECOLE_LISIBLE}
          </div>
        </div>
        {/* La ligne « Faladié Sema · Bamako | IDEAL » qui occupait le bas a
            été retirée : la zone de contact la recouvrait, et l'en-tête du
            verso dit déjà « IDEAL ÉCOLE · BAMAKO ». Deux fois la même chose
            sur une carte de 54 mm, c'est une fois de trop. */}
      </div>
    </div>
  )
}

// Seules les images en base64 posées par handlePhotoUpload sont directement
// affichables. Les valeurs héritées de photo_url sont des adresses
// /object/public/ que le passage du bucket en privé a rendues mortes ;
// quelques-unes répondent encore par cache CDN, ce qui donnerait un affichage
// dépendant du nœud et de l'heure. Les photos venues d'une inscription
// passent désormais par photo_chemin et une URL signée.
const estBase64 = v => typeof v === 'string' && v.startsWith('data:')

export default function CartesScolaires() {
  const [eleves, setEleves] = useState([])
  const [, setClasses] = useState([])
  const [, setLoading] = useState(true)
  const [selectedClasse, setSelectedClasse] = useState('TOUTES')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEleve, setSelectedEleve] = useState(null)
  const [showModalPrint, setShowModalPrint] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [resEleves, resClasses, resInsc] = await Promise.all([
        // Le seul écran qui a besoin de la photo : il l'imprime sur la carte.
        // Elle reste stockée en base64 dans la table — 1,7 Mo pour un seul
        // élève — au lieu d'une référence au Storage. La migration reste à
        // faire ; en attendant, cet écran la charge en connaissance de cause,
        // et il est le seul.
        supabase.from('eleves').select(CHAMPS_ELEVE_AVEC_PHOTO).order('nom', { ascending: true }),
        supabase.from('classes').select('*').order('nom', { ascending: true }),
        supabase.from('inscriptions').select('*')
      ])

      const rawEleves = Array.isArray(resEleves.data) ? resEleves.data : []
      const rawInsc = Array.isArray(resInsc.data) ? resInsc.data : []

      // Fusionner les données de la table eleves et inscriptions pour avoir photos, groupe sanguin, contacts
      const merged = rawEleves.map(e => {
        const matchingInsc = rawInsc.find(i => i.matricule === e.matricule || i.id === e.inscription_id)
        return {
          ...e,
          photo_url:    estBase64(e.photo_url) ? e.photo_url : null,
          photo_chemin: matchingInsc?.photo_chemin || null,
          date_naissance: e.date_naissance || matchingInsc?.date_naissance || '2016-05-12',
          lieu_naissance: matchingInsc?.lieu_naissance || 'Bamako',
          groupe_sanguin: matchingInsc?.groupe_sanguin || e.groupe_sanguin || 'O+',
          telephone_parent: matchingInsc?.telephone_parent || e.telephone_parent || '+223 70 00 00 00',
          adresse: matchingInsc?.adresse || 'Bamako, Mali',
          cantine: matchingInsc?.cantine ?? true,
          transport: matchingInsc?.transport ?? false,
          sexe: e.sexe || matchingInsc?.sexe || 'M'
        }
      })

      // Si la table eleves est vide, utiliser les inscriptions directes
      const finalList = merged.length > 0 ? merged : rawInsc.map(i => ({
        id: i.id,
        matricule: i.matricule || '24-25 A001',
        nom: i.nom || 'SAMAKÉ',
        prenom: i.prenoms || i.prenom || 'Mamadou',
        classe_nom: i.classe_demandee || 'CP1 Bilingue',
        photo_url:    null,                     // aucune inscription ne porte de base64
        photo_chemin: i.photo_chemin || null,
        date_naissance: i.date_naissance || '2017-08-20',
        lieu_naissance: i.lieu_naissance || 'Bamako',
        groupe_sanguin: i.groupe_sanguin || 'A+',
        telephone_parent: i.telephone_parent || '+223 76 12 34 56',
        adresse: i.adresse || 'Badalabougou, Bamako',
        cantine: i.cantine ?? true,
        transport: i.transport ?? false,
        sexe: i.sexe || 'M'
      }))

      // Exemples de secours de démonstration si aucune donnée en base
      const demoList = finalList.length > 0 ? finalList : [
        {
          id: 'demo-1',
          matricule: '24-25 A014',
          nom: 'SAMAKÉ',
          prenom: 'Mamadou',
          classe_nom: 'CP1 Bilingue',
          photo_url: null,
          photo_chemin: null,
          date_naissance: '2018-04-15',
          lieu_naissance: 'Bamako',
          groupe_sanguin: 'O+',
          telephone_parent: '+223 76 45 89 12',
          adresse: 'Hippodrome, Bamako',
          cantine: true,
          transport: true,
          sexe: 'M'
        },
        {
          id: 'demo-2',
          matricule: '24-25 A088',
          nom: 'DIARRA',
          prenom: 'Aïssata',
          classe_nom: 'CE2 Bilingue',
          photo_url: null,
          photo_chemin: null,
          date_naissance: '2016-11-03',
          lieu_naissance: 'Bamako',
          groupe_sanguin: 'B+',
          telephone_parent: '+223 66 88 99 00',
          adresse: 'ACI 2000, Bamako',
          cantine: true,
          transport: false,
          sexe: 'F'
        },
        {
          id: 'demo-3',
          matricule: '24-25 B102',
          nom: 'COULIBALY',
          prenom: 'Ibrahim Sory',
          classe_nom: 'CM2 Bilingue',
          photo_url: null,
          photo_chemin: null,
          date_naissance: '2014-02-28',
          lieu_naissance: 'Ségou',
          groupe_sanguin: 'AB+',
          telephone_parent: '+223 70 11 22 33',
          adresse: 'Korofina, Bamako',
          cantine: false,
          transport: true,
          sexe: 'M'
        }
      ]

      // Une seule requête réseau, quel que soit le nombre de cartes.
      // createSignedUrls — au pluriel — prend un tableau et renvoie un
      // résultat par chemin, chacun avec son erreur éventuelle. Signer carte
      // par carte ajouterait autant d'allers-retours.
      //
      // `photo_signee` ne vit que dans l'état React : une URL signée expire au
      // bout d'une heure, la persister recréerait les liens morts qu'on corrige.
      let liste = demoList
      const chemins = [...new Set(demoList.map(e => e.photo_chemin).filter(Boolean))]

      if (chemins.length > 0) {
        const { data: signees } = await supabase.storage
          .from('inscriptions')
          .createSignedUrls(chemins, 3600)

        const parChemin = new Map(
          (signees || [])
            .filter(s => s.signedUrl && !s.error)
            .map(s => [s.path, s.signedUrl])
        )

        liste = demoList.map(e => ({
          ...e,
          photo_signee: e.photo_chemin ? parChemin.get(e.photo_chemin) || null : null,
        }))
      }

      setEleves(liste)
      setClasses(Array.isArray(resClasses.data) ? resClasses.data : [])
      if (liste.length > 0) setSelectedEleve(liste[0])
    } catch (err) {
      console.error('Erreur chargement cartes scolaires:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (eleveId, e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const photoDataUrl = evt.target.result
      const updated = eleves.map(el => el.id === eleveId ? { ...el, photo_url: photoDataUrl } : el)
      setEleves(updated)
      if (selectedEleve?.id === eleveId) {
        setSelectedEleve(prev => ({ ...prev, photo_url: photoDataUrl }))
      }

      // Sauvegarde Supabase
      try {
        await supabase.from('eleves').update({ photo_url: photoDataUrl }).eq('id', eleveId)
      } catch (err) {
        console.log('Save photo error:', err)
      }
    }
    reader.readAsDataURL(file)
  }

  const filteredEleves = eleves.filter(e => {
    const matchSearch = `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchClasse = selectedClasse === 'TOUTES' || e.classe_nom === selectedClasse
    return matchSearch && matchClasse
  })

  const triggerPrint = mode => {
    document.documentElement.dataset.printMode = mode
    const nettoyer = () => {
      delete document.documentElement.dataset.printMode
      window.removeEventListener('afterprint', nettoyer)
    }
    window.addEventListener('afterprint', nettoyer)
    window.print()
  }

  // La découpe en planches et l'ordre miroir des versos vivent dans
  // `lib/carteScolaire` : ce sont des règles, pas du rendu, et elles se
  // testent sans navigateur.
  // L'aperçu de planche suit la largeur disponible. Une échelle figée à 0,58
  // donnait 460 px de feuille sur un téléphone de 360 : l'utilisateur voyait
  // une grande zone blanche et une colonne de cartes sur la droite, sans
  // pouvoir contrôler sa planche avant de l'imprimer.
  //
  // Seul l'APERÇU est mis à l'échelle. La feuille reste du 210 × 297 mm et
  // les cartes du 53,98 × 85,60 mm : `transform` est annulé en impression.
  const { cadre, docRef, echelle } = useEchelleFeuille(A4_LARGEUR_PX)

  const pages = planches(filteredEleves)

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Impression.
          `print-color-adjust: exact` est indispensable : sans lui les
          navigateurs suppriment les aplats et la bande colorée disparaîtrait.
          La planche passe en millimètres réels — l'aperçu écran est réduit,
          le papier ne l'est pas. */}
      {/* Impression.
          `print-color-adjust: exact` est indispensable : sans lui les
          navigateurs suppriment les aplats et la bande colorée disparaîtrait.

          Toutes les longueurs viennent de `lib/carteScolaire`. La version
          précédente les réécrivait ici en dur — `repeat(3, 54mm)`,
          `190mm`, `277mm` — pendant que les cartes, elles, étaient rendues en
          PIXELS. Les navigateurs ne garantissent pas 96 px par pouce en mode
          impression : chaque carte sortait un peu plus haute que sa case, et
          l'écart, multiplié par trois rangées, faisait déborder la dernière
          hors de la feuille. C'était le débordement du verso.

          Les cartes sont désormais rendues en millimètres, comme la grille. */}
      <style>{`
        @media print {
          /* Marge nulle sur la page : les marges sont DANS la feuille, en
             padding. Une @page de 10 mm laissait 277 mm utiles à une feuille
             qui en fait 297 : chaque planche débordait sur une page de plus. */
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important;
                       height: auto !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          html[data-print-mode="planche"] #planche-impression,
          html[data-print-mode="planche"] #planche-impression *,
          html[data-print-mode="carte"] #carte-impression,
          html[data-print-mode="carte"] #carte-impression * { visibility: visible !important; }

          #planche-impression {
            position: absolute; inset: 0 auto auto 0;
            width: ${A4.largeur}mm;
          }
          #planche-impression .feuille {
            width: ${A4.largeur}mm; height: ${A4.hauteur}mm;
            padding: ${MARGE_Y}mm ${MARGE_X}mm;
            box-sizing: border-box; overflow: hidden;
            display: block; margin: 0;
            break-after: page; page-break-after: always;
            break-inside: avoid; page-break-inside: avoid;
          }
          /* Sans cela, la dernière feuille éjecte une page blanche. */
          #planche-impression .feuille:last-child {
            break-after: auto; page-break-after: auto;
          }
          #planche-impression .grille {
            display: grid;
            grid-template-columns: repeat(${COLONNES}, ${CARTE_L}mm);
            grid-template-rows: repeat(${Math.round(PAR_PLANCHE / COLONNES)}, ${CARTE_H}mm);
            gap: ${GOUTTIERE}mm;
            justify-content: center; align-content: start;
          }
          #planche-impression .feuille-cadre { height: auto; overflow: visible; margin: 0; }
          #planche-impression .feuille-numero { display: none !important; }
          #planche-impression .carte {
            box-shadow: none !important;
            border: 0.2mm solid #cbd5e1 !important;
            break-inside: avoid; page-break-inside: avoid;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #planche-impression .carte * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #carte-impression {
            position: absolute; inset: 0 auto auto 0;
            width: ${A4.largeur}mm; height: ${A4.hauteur}mm;
            padding: ${MARGE_Y}mm ${MARGE_X}mm; box-sizing: border-box;
            display: flex; gap: 10mm; align-items: flex-start;
          }
        }
        @media screen {
          #carte-impression { display: none; }
          /* L'aperçu montre la VRAIE feuille, réduite. Une planche dessinée
             autrement que ce qui sort de l'imprimante ne prouve rien. */
          #planche-impression .feuille {
            width: ${A4.largeur}mm; height: ${A4.hauteur}mm;
            padding: ${MARGE_Y}mm ${MARGE_X}mm;
            box-sizing: border-box; background: #fff;
            box-shadow: 0 6px 22px rgba(15,23,42,.16);
            margin: 0 auto 14px; overflow: hidden;
          }
          #planche-impression .grille {
            display: grid;
            grid-template-columns: repeat(${COLONNES}, ${CARTE_L}mm);
            grid-template-rows: repeat(${Math.round(PAR_PLANCHE / COLONNES)}, ${CARTE_H}mm);
            gap: ${GOUTTIERE}mm;
            justify-content: center; align-content: start;
          }
          /* La réduction porte sur la feuille, et son cadre reprend la
             hauteur réduite. Mettre l'échelle sur le conteneur laisserait un
             vide de la hauteur pleine sous l'apercu : transform ne change
             pas la place occupée dans le flux.

             Le facteur vient de la largeur réellement disponible, mesurée —
             une valeur figée ne peut pas convenir à la fois à un téléphone
             de 360 px et à un écran de bureau. */
          #planche-impression .feuille {
            transform: scale(var(--apercu, 1)); transform-origin: top left;
          }
          #planche-impression .feuille-cadre {
            height: calc(${A4.hauteur}mm * var(--apercu, 1));
            overflow: hidden; margin-bottom: 10px;
          }
          /* La modale ne doit jamais offrir de défilement horizontal : c'est
             exactement ce qui rendait l'aperçu incontrôlable. */
          #planche-impression { max-width: 100%; overflow-x: hidden; }
          #planche-impression .feuille-numero {
            font-size: 11px; font-weight: 800; color: #64748b;
            text-align: center; margin: 0 0 4px;
          }
        }
      `}</style>

      
      {/* En-tête du volet Cartes Scolaires */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#0d2a3b', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>💳 Cartes Scolaires Officielles &amp; Badges Élèves</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Génération et impression des cartes d'identité scolaires de l'École Internationale Bilingue IDEAL.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowModalPrint(true)}
            style={{
              background: 'linear-gradient(135deg, #00a8e0, #0078b4)',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,168,224,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>🖨️ Imprimer la Planche de la Classe (A4)</span>
          </button>
        </div>
      </div>

      {/* Barre de filtres et d'options */}
      <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Rechercher un élève</label>
          <input
            type="text"
            placeholder="Nom, Prénom, Matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none' }}
          />
        </div>

        <div style={{ width: 180 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Classe</label>
          <select
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#fff' }}
          >
            <option value="TOUTES">Toutes les classes</option>
            <option value="Maternelle Bilingue">Maternelle Bilingue</option>
            <option value="CP1 Bilingue">CP1 Bilingue</option>
            <option value="CP2 Bilingue">CP2 Bilingue</option>
            <option value="CE1 Bilingue">CE1 Bilingue</option>
            <option value="CE2 Bilingue">CE2 Bilingue</option>
            <option value="CM1 Bilingue">CM1 Bilingue</option>
            <option value="CM2 Bilingue">CM2 Bilingue</option>
          </select>
        </div>

      </div>

      {/* Grille principale : Liste des élèves à gauche, Aperçu de la carte à droite */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        
        {/* Liste des Élèves */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ background: '#0d2a3b', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📋 Sélectionner un Élève ({filteredEleves.length})</span>
            <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 10 }}>2026 - 2027</span>
          </div>

          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            {filteredEleves.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Aucun élève trouvé.
              </div>
            ) : (
              filteredEleves.map(e => {
                const isSelected = selectedEleve?.id === e.id
                return (
                  <div
                    key={e.id}
                    onClick={() => setSelectedEleve(e)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? 'rgba(0,168,224,0.08)' : '#fff',
                      borderLeft: isSelected ? '4px solid #00a8e0' : '4px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#0d2a3b',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 14,
                        overflow: 'hidden',
                        border: '2px solid #cbd5e1'
                      }}>
                        {(e.photo_url || e.photo_signee) ? (
                          <img src={e.photo_url || e.photo_signee} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          `${e.prenom?.[0] || ''}${e.nom?.[0] || ''}`
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0d2a3b' }}>
                          {e.nom} {e.prenom}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, marginTop: 2 }}>
                          <span style={{ fontWeight: 700, color: '#00a8e0' }}>{e.matricule}</span>
                          <span>•</span>
                          <span>{e.classe_nom}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      style={{ background: 'none', border: 'none', color: isSelected ? '#00a8e0' : '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                    >
                      ➔
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Studio Aperçu & Édition de la Carte Scolaire */}
        {selectedEleve && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Header d'actions rapides sur l'élève sélectionné */}
            <div style={{ background: '#fff', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0d2a3b' }}>Aperçu de la Carte : {selectedEleve.prenom} {selectedEleve.nom}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Matricule : {selectedEleve.matricule}</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1'
                }}>
                  📷 Modifier Photo
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(selectedEleve.id, e)} style={{ display: 'none' }} />
                </label>

                <button
                  onClick={() => triggerPrint('carte')}
                  style={{
                    background: '#0d2a3b',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  🖨️ Imprimer la Carte
                </button>
              </div>
            </div>

            {/* Rendu des Cartes — format vertical ID-1, 54 × 85,6 mm */}
            <div id="print-single-card-area" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 28 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <CarteRecto eleve={selectedEleve} />
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: 0.5 }}>RECTO</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <CarteVerso eleve={selectedEleve} />
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: 0.5 }}>VERSO</div>
              </div>
            </div>

          </div>
        )}

      </div>

      {selectedEleve && (
        <div id="carte-impression">
          <CarteRecto eleve={selectedEleve} unite="mm" />
          <CarteVerso eleve={selectedEleve} unite="mm" />
        </div>
      )}

      {/* Modal d'impression de la Planche A4 pour toute la classe */}
      {showModalPrint && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 850, maxHeight: '90vh', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#0d2a3b', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>🖨️ Planche d'Impression des Cartes — Classe : {selectedClasse}</div>
              <button onClick={() => setShowModalPrint(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✖</button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                💡 {filteredEleves.length} carte(s) · {pages.length} planche(s) de 9 cartes,
                soit {nombreDeFeuilles(filteredEleves)} feuille(s) A4. Chaque recto est immédiatement suivi de
                son verso, disposé en miroir pour un retournement sur le grand côté.
                Réglez l'imprimante sur <b>recto-verso, bord long</b>, à 100 % sans mise à l'échelle.
              </div>

              {/* Les feuilles vont par paires consecutives : recto d'une page,
                  puis son verso, puis la page suivante. Deux boucles separees
                  auraient sorti tous les rectos avant tous les versos, et des
                  la dixieme carte l'imprimante aurait accole le recto de la
                  feuille 2 au verso de la feuille 1. */}
              <div ref={cadre} style={{ width: '100%', overflowX: 'hidden' }}>
              <div id="planche-impression" ref={docRef}
                   style={{ '--apercu': echelle }}>
                {pages.map((page, n) => (
                  <Fragment key={`paire-${n}`}>
                    <div className="feuille-cadre">
                      <div className="feuille-numero no-print">Planche {n + 1} · recto</div>
                      <div className="feuille">
                        <div className="grille">
                          {page.map(el => (
                            <CarteRecto key={el.id} eleve={el} unite="mm" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="feuille-cadre">
                      <div className="feuille-numero no-print">Planche {n + 1} · verso</div>
                      <div className="feuille">
                        <div className="grille">
                          {miroirRangees(page).map((el, i) => (
                            el
                              ? <CarteVerso key={el.id} eleve={el} unite="mm" />
                              : <div key={`vide-${i}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
              </div>
            </div>

            <div style={{ padding: 14, background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowModalPrint(false)} style={{ background: '#e2e8f0', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
              <button onClick={() => triggerPrint('planche')} style={{ background: '#00a8e0', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>🖨️ Lancer l'Impression PDF</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
