/**
 * Moteur de points & prime d'été — École IDEAL
 *
 * Principe : chaque trimestre rapporte des points bruts, affectés d'un
 * coefficient croissant (1 / 1,5 / 2). L'enjeu se déplace donc vers la fin
 * de l'année, là où la motivation retombe naturellement.
 *
 * Les points se convertissent en une enveloppe versée en juillet, août et
 * septembre. Les avantages en nature (bourses) s'ouvrent par paliers, sous
 * condition d'ancienneté.
 *
 * Toutes les valeurs sont paramétrables depuis l'écran directeur et stockées
 * dans Supabase (app_state, app='rh', key='points_config').
 */

export const CONFIG_DEFAUT = {
  anneeScolaire: '2026-2027',

  trimestres: [
    { id: 't1', label: '1er trimestre', debut: '2026-10-01', fin: '2027-01-04', coef: 1 },
    { id: 't2', label: '2e trimestre', debut: '2027-01-05', fin: '2027-04-05', coef: 1.5 },
    { id: 't3', label: '3e trimestre', debut: '2027-04-06', fin: '2027-06-30', coef: 2 },
  ],

  // Points bruts par trimestre — le total doit faire 100
  indicateurs: [
    { id: 'preparations', label: 'Préparations déposées à temps', points: 30, cible: 12, auto: true },
    { id: 'checkpoints', label: 'Checkpoints réalisés', points: 25, cible: 8, auto: true },
    { id: 'rapports', label: 'Rapports hebdomadaires transmis', points: 20, cible: 10, auto: true },
    { id: 'ponctualite', label: 'Ponctualité et assiduité', points: 15, cible: 55, auto: true },
    { id: 'reunions', label: 'Présence aux réunions', points: 10, cible: 3, auto: false },
  ],

  salaireBase: 125000,
  enveloppeEte: 375000,
  repartition: [
    { mois: 'Juillet', part: 0.5 },
    { mois: 'Août', part: 0.3 },
    { mois: 'Septembre', part: 0.2 },
  ],

  paliers: [
    { id: 'bronze', label: 'Bronze', seuil: 50, bourseEnfant: 10, formation: 0 },
    { id: 'argent', label: 'Argent', seuil: 65, bourseEnfant: 20, formation: 0 },
    { id: 'or', label: 'Or', seuil: 80, bourseEnfant: 30, formation: 50 },
    { id: 'excellence', label: 'Excellence', seuil: 90, bourseEnfant: 50, formation: 75 },
  ],

  anciennete: {
    bourseEnfant: 3,      // années requises pour ouvrir la bourse enfant
    formation: 5,         // années requises pour le choix bourse 100 % / études
    declarationEtudes: 3, // année à laquelle la bourse d'études doit être déclarée
  },

  bourseEtudesPlafond: 500000,
  heureLimiteArrivee: '08:00',
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

/** Points bruts maximum par trimestre (normalement 100) */
export function pointsBrutsMax(config) {
  return (config.indicateurs || []).reduce((s, i) => s + num(i.points), 0)
}

/** Total pondéré maximum sur l'année (ex. 100×1 + 100×1,5 + 100×2 = 450) */
export function pointsMaxAnnee(config) {
  const brut = pointsBrutsMax(config)
  return (config.trimestres || []).reduce((s, t) => s + brut * num(t.coef, 1), 0)
}

/** Trimestre auquel appartient une date, ou null hors année scolaire */
export function trimestreDe(dateISO, config) {
  if (!dateISO) return null
  const d = String(dateISO).slice(0, 10)
  return (config.trimestres || []).find(t => d >= t.debut && d <= t.fin) || null
}

/**
 * Normalise une date de rapport. Les rapports historiques stockent une date
 * française (JJ/MM/AAAA), incomparable aux bornes de trimestre ; les nouveaux
 * portent un champ dateISO.
 */
export function dateRapport(rapport) {
  if (!rapport) return null
  if (rapport.dateISO) return String(rapport.dateISO).slice(0, 10)
  const fr = String(rapport.date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`
  const iso = String(rapport.date || '').match(/^\d{4}-\d{2}-\d{2}/)
  return iso ? iso[0] : null
}

/**
 * Un rapport appartient à un enseignant si son identifiant correspond.
 * Le nom n'est utilisé qu'en repli, pour les rapports antérieurs à
 * l'enregistrement de l'identifiant.
 */
export function rapportDe(rapport, userId, nomComplet) {
  if (!rapport) return false
  if (rapport.teacherId) return rapport.teacherId === userId
  const t = (rapport.teacher || '').trim().toLowerCase()
  return !!t && !!nomComplet && t === nomComplet.trim().toLowerCase()
}

/** Une préparation est « à temps » si elle est déposée avant le début du cours */
export function preparationATemps(prep) {
  if (!prep || !prep.heure_depot || !prep.date_cours) return false
  const cours = new Date(`${prep.date_cours}T${prep.heure_cours || '08:00:00'}`)
  return new Date(prep.heure_depot) <= cours
}

/**
 * Calcule les points d'un enseignant.
 * donnees = { preparations, checkpoints, performances, rapports, saisieManuelle }
 * saisieManuelle = { [userId]: { [trimestreId]: { [indicateurId]: nombre } } }
 */
export function calculerPoints(config, donnees, userId, nomComplet) {
  const cible = id => num((config.indicateurs.find(i => i.id === id) || {}).cible, 1) || 1
  const pts = id => num((config.indicateurs.find(i => i.id === id) || {}).points)
  const manuel = ((donnees.saisieManuelle || {})[userId]) || {}

  const parTrimestre = config.trimestres.map(tri => {
    const dansTri = dateISO => {
      const t = trimestreDe(dateISO, config)
      return t && t.id === tri.id
    }

    const preps = (donnees.preparations || []).filter(p => p.user_id === userId && dansTri(p.date_cours))
    const prepsOk = preps.filter(preparationATemps).length

    const cps = (donnees.checkpoints || []).filter(c => c.prof_id === userId && dansTri(c.date_checkpoint)).length

    const raps = (donnees.rapports || []).filter(r =>
      rapportDe(r, userId, nomComplet) && dansTri(dateRapport(r))
    ).length

    const jours = (donnees.performances || []).filter(p => p.prof_id === userId && dansTri(p.date_jour))
    const limite = config.heureLimiteArrivee || '08:00'
    const joursOk = jours.filter(p => !p.heure_arrivee || String(p.heure_arrivee).slice(0, 5) <= limite).length

    const reunions = num((manuel[tri.id] || {}).reunions)

    const compte = { preparations: prepsOk, checkpoints: cps, rapports: raps, ponctualite: joursOk, reunions }

    const detail = config.indicateurs.map(ind => {
      const realise = num(compte[ind.id])
      const ratio = Math.min(1, realise / cible(ind.id))
      return {
        id: ind.id,
        label: ind.label,
        realise,
        cible: cible(ind.id),
        pointsMax: pts(ind.id),
        points: Math.round(ratio * pts(ind.id) * 10) / 10,
      }
    })

    const brut = detail.reduce((s, d) => s + d.points, 0)
    return {
      ...tri,
      detail,
      brut: Math.round(brut * 10) / 10,
      brutMax: pointsBrutsMax(config),
      pondere: Math.round(brut * num(tri.coef, 1) * 10) / 10,
      pondereMax: Math.round(pointsBrutsMax(config) * num(tri.coef, 1) * 10) / 10,
    }
  })

  const total = parTrimestre.reduce((s, t) => s + t.pondere, 0)
  const max = pointsMaxAnnee(config)

  return {
    parTrimestre,
    total: Math.round(total * 10) / 10,
    max,
    pourcentage: max > 0 ? Math.round((total / max) * 1000) / 10 : 0,
  }
}

/**
 * Détail vérifiable d'un indicateur sur un trimestre : la liste exacte des
 * éléments pris en compte, ceux qui ne le sont pas, et pourquoi.
 *
 * C'est la pièce maîtresse de la transparence : un enseignant qui peut
 * vérifier ligne à ligne conteste rarement, et quand il conteste, la
 * discussion porte sur un fait daté plutôt que sur une impression.
 */
export function detailIndicateur(config, donnees, userId, nomComplet, trimestreId, indicateurId) {
  const tri = (config.trimestres || []).find(t => t.id === trimestreId)
  if (!tri) return []
  const dans = d => {
    const t = trimestreDe(d, config)
    return t && t.id === tri.id
  }
  const heure = ts => {
    try { return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
    catch (e) { return String(ts || '') }
  }

  if (indicateurId === 'preparations') {
    return (donnees.preparations || [])
      .filter(p => p.user_id === userId && dans(p.date_cours))
      .sort((a, b) => String(a.date_cours).localeCompare(String(b.date_cours)))
      .map(p => {
        const ok = preparationATemps(p)
        return {
          date: p.date_cours,
          info: `déposée le ${heure(p.heure_depot)} · cours à ${String(p.heure_cours || '').slice(0, 5)}`,
          compte: ok,
          raison: ok ? 'déposée avant le cours' : 'déposée après le début du cours',
        }
      })
  }

  if (indicateurId === 'checkpoints') {
    return (donnees.checkpoints || [])
      .filter(c => c.prof_id === userId && dans(c.date_checkpoint))
      .sort((a, b) => String(a.date_checkpoint).localeCompare(String(b.date_checkpoint)))
      .map(c => ({ date: c.date_checkpoint, info: 'check-point enregistré', compte: true, raison: 'compté' }))
  }

  if (indicateurId === 'rapports') {
    return (donnees.rapports || [])
      .filter(r => rapportDe(r, userId, nomComplet) && dans(dateRapport(r)))
      .map(r => ({
        date: dateRapport(r),
        info: `rapport de ${r.studentName || 'élève'}`,
        compte: true,
        raison: 'compté',
      }))
  }

  if (indicateurId === 'ponctualite') {
    const limite = config.heureLimiteArrivee || '08:00'
    return (donnees.performances || [])
      .filter(p => p.prof_id === userId && dans(p.date_jour))
      .sort((a, b) => String(a.date_jour).localeCompare(String(b.date_jour)))
      .map(p => {
        const h = String(p.heure_arrivee || '').slice(0, 5)
        const ok = !h || h <= limite
        return {
          date: p.date_jour,
          info: h ? `arrivée ${h}` : 'heure non renseignée',
          compte: ok,
          raison: ok ? `dans les délais (limite ${limite})` : `après ${limite}`,
        }
      })
  }

  return []
}

/** Enveloppe d'été acquise, et sa répartition mensuelle */
export function montantEte(pourcentage, config) {
  const total = Math.round((pourcentage / 100) * num(config.enveloppeEte))
  const mois = (config.repartition || []).map(r => ({
    mois: r.mois,
    montant: Math.round(total * num(r.part)),
  }))
  return { total, mois }
}

/** Ce que rapporte une action supplémentaire, en FCFA — le moteur de motivation */
export function valeurAction(indicateurId, trimestreId, config) {
  const ind = (config.indicateurs || []).find(i => i.id === indicateurId)
  const tri = (config.trimestres || []).find(t => t.id === trimestreId)
  if (!ind || !tri) return 0
  const c = num(ind.cible, 1) || 1
  const pondere = (num(ind.points) / c) * num(tri.coef, 1)
  const max = pointsMaxAnnee(config)
  return max > 0 ? Math.round((pondere / max) * num(config.enveloppeEte)) : 0
}

/** Palier atteint (le plus élevé dont le seuil est franchi) */
export function palierDe(pourcentage, config) {
  const atteints = (config.paliers || []).filter(p => pourcentage >= num(p.seuil))
  return atteints.length ? atteints[atteints.length - 1] : null
}

/** Ancienneté en années révolues au 1er octobre de l'année scolaire en cours */
export function ancienneteAnnees(dateEmbauche, config) {
  if (!dateEmbauche) return null
  const debut = (config.trimestres && config.trimestres[0] && config.trimestres[0].debut) || `${new Date().getFullYear()}-10-01`
  const ref = new Date(debut)
  const emb = new Date(dateEmbauche)
  if (isNaN(emb.getTime())) return null
  let ans = ref.getFullYear() - emb.getFullYear()
  const m = ref.getMonth() - emb.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < emb.getDate())) ans--
  return Math.max(0, ans)
}

/**
 * Avantages ouverts : l'ancienneté donne le droit, la performance fixe le niveau.
 * À partir de l'ancienneté « formation », l'enseignant choisit entre la bourse
 * enfant à 100 % et une bourse d'études déclarée en amont.
 */
export function avantagesDe(pourcentage, dateEmbauche, personnel, config) {
  const palier = palierDe(pourcentage, config)
  const ans = ancienneteAnnees(dateEmbauche, config)
  const seuilEnfant = num(config.anciennete?.bourseEnfant, 3)
  const seuilFormation = num(config.anciennete?.formation, 5)
  const p = personnel || {}

  const res = {
    palier,
    anciennete: ans,
    bourseEnfant: 0,
    bourseEtudes: 0,
    choixOuvert: false,
    option: p.optionChoisie || null,
    messages: [],
  }

  if (ans === null) {
    res.messages.push("Date d'embauche non renseignée — ancienneté incalculable.")
    return res
  }
  if (!palier) {
    res.messages.push(`En dessous de ${num(config.paliers?.[0]?.seuil, 50)} % : prime d'été seule.`)
    return res
  }

  if (ans < seuilEnfant) {
    res.messages.push(`Bourse enfant accessible à ${seuilEnfant} ans d'ancienneté (actuellement ${ans}).`)
    return res
  }

  res.bourseEnfant = num(palier.bourseEnfant)

  if (ans >= seuilFormation) {
    res.choixOuvert = true
    const declare = !!p.declarationEtudes
    const sansIncident = !p.incident
    if (p.optionChoisie === 'etudes') {
      if (declare && sansIncident && num(palier.formation) > 0) {
        res.bourseEtudes = num(palier.formation)
        res.bourseEnfant = 0
      } else if (!declare) {
        res.messages.push(`Bourse d'études non déclarée à la ${num(config.anciennete?.declarationEtudes, 3)}e année — option indisponible.`)
      } else if (!sansIncident) {
        res.messages.push("Incident enregistré : la déclaration de bourse d'études est annulée.")
      } else {
        res.messages.push(`Bourse d'études ouverte au palier Or (${num(config.paliers?.[2]?.seuil, 80)} %) et au-delà.`)
      }
    } else {
      res.bourseEnfant = 100
    }
  }

  return res
}

/** Simulation budgétaire pour l'ensemble de l'équipe */
export function simulationBudget(config, effectif, pourcentageMoyen) {
  const parEnseignant = Math.round((pourcentageMoyen / 100) * num(config.enveloppeEte))
  return {
    parEnseignant,
    total: parEnseignant * num(effectif),
    plafond: num(config.enveloppeEte) * num(effectif),
  }
}
