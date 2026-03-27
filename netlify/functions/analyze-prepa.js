// ================================================================
// Netlify Function : analyze-prepa.js
// Rôle : Serveur relais entre l'app React et l'API Google Gemini
// Emplacement : netlify/functions/analyze-prepa.js
// ================================================================

const PROMPT_CORRECTION = (matiere, classe, langue) => `
Tu es un inspecteur pédagogique expérimenté spécialisé dans l'enseignement
primaire bilingue (français/anglais) à Bamako, Mali.

Analyse cette préparation de cours selon 5 critères et note-la sur 20.

CONTEXTE :
- Matière : ${matiere}
- Classe : ${classe}
- Langue d'enseignement : ${langue === 'en' ? 'Anglais' : 'Français'}

CRITÈRES DE NOTATION :
1. Structure & organisation (0-4 pts) : introduction, développement, conclusion
2. Clarté des objectifs (0-4 pts) : objectifs mesurables et adaptés au niveau
3. Qualité du contenu (0-4 pts) : exactitude et richesse des notions
4. Méthodes & activités (0-4 pts) : variété et adaptation aux élèves
5. Évaluation prévue (0-4 pts) : cohérence avec les objectifs

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après :
{
  "notes": {
    "structure": <0-4>,
    "objectifs": <0-4>,
    "contenu": <0-4>,
    "methodes": <0-4>,
    "evaluation": <0-4>
  },
  "total": <somme 0-20>,
  "points_forts": ["point 1", "point 2", "point 3"],
  "points_amelioration": ["point 1", "point 2"],
  "commentaire_general": "Commentaire bienveillant en 2-3 phrases.",
  "conseil_prioritaire": "Un conseil concret et actionnable."
}

Barème : 18-20 = excellent, 15-17 = très bien, 12-14 = bien,
10-11 = assez bien, moins de 10 = à améliorer.
`

exports.handler = async (event) => {

  // ── Gestion CORS ────────────────────────────────────────────
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Méthode non autorisée.' }),
    }
  }

  // ── Lecture des données envoyées par l'app ──────────────────
  let payload
  try {
    payload = JSON.parse(event.body)
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Données invalides.' }),
    }
  }

  const { fileBase64, fileType, base64Data, mimeType, prompt, matiere, classe, langue } = payload;
  const finalBase64 = fileBase64 || base64Data;
  const finalType = fileType || mimeType;

  if (!finalBase64 || !finalType) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Fichier manquant.' }),
    }
  }

  // ── Clé API récupérée depuis les variables Netlify ──────────
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Clé API manquante sur le serveur.' }),
    }
  }

  // ── Construction de la requête pour Gemini ──────────────────
  // Gemini accepte les PDF et images en base64 via inline_data
  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: finalType,
              data: finalBase64,
            },
          },
          {
            text: PROMPT_CORRECTION(matiere || '—', classe || '—', langue || 'fr'),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1500,
    },
  }

  // ── Appel à l'API Gemini ────────────────────────────────────
  let geminiResponse
  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    )
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Impossible de joindre Google : ' + err.message }),
    }
  }

  if (!geminiResponse.ok) {
    const errData = await geminiResponse.json().catch(() => ({}))
    return {
      statusCode: geminiResponse.status,
      headers,
      body: JSON.stringify({
        error: 'Erreur Gemini : ' + (errData.error?.message || geminiResponse.statusText),
      }),
    }
  }

  const geminiData = await geminiResponse.json()
  const texteReponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // ── Extraction et validation du JSON ───────────────────────
  let analyse
  try {
    const jsonMatch = texteReponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Aucun JSON dans la réponse')
    analyse = JSON.parse(jsonMatch[0])
    if (typeof analyse.total !== 'number' || !analyse.notes) {
      throw new Error('Structure JSON invalide')
    }
    // Recalcul du total pour éviter les incohérences
    analyse.total = Object.values(analyse.notes).reduce((a, b) => a + b, 0)
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Réponse IA illisible : ' + err.message,
        raw: texteReponse.slice(0, 200),
      }),
    }
  }

  // ── Réponse finale vers l'app ───────────────────────────────
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, analyse }),
  }
}
