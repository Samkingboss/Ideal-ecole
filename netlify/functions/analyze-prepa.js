const PROMPT_CORRECTION = (matiere, classe, langue, texte) => `
Tu es un inspecteur pédagogique spécialisé dans l'enseignement primaire bilingue à Bamako, Mali.

Analyse cette préparation de cours selon 5 critères et note-la sur 20.

CONTEXTE :
- Matière : ${matiere}
- Classe : ${classe}
- Langue : ${langue === 'en' ? 'Anglais' : 'Français'}

PRÉPARATION :
${texte}

Réponds UNIQUEMENT avec un JSON valide :
{
  "notes": {
    "structure": <0-4>,
    "objectifs": <0-4>,
    "contenu": <0-4>,
    "methodes": <0-4>,
    "evaluation": <0-4>
  },
  "total": <0-20>,
  "points_forts": ["point 1", "point 2"],
  "points_amelioration": ["point 1", "point 2"],
  "commentaire_general": "2-3 phrases.",
  "conseil_prioritaire": "Un conseil concret."
}
`

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée.' }) }

  let payload
  try { payload = JSON.parse(event.body) }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Données invalides.' }) } }

  const { fileBase64, fileType, base64Data, mimeType, matiere, classe, langue } = payload
  const finalBase64 = fileBase64 || base64Data
  const finalType = fileType || mimeType

  if (!finalBase64 || !finalType) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Fichier manquant.' }) }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Clé API manquante.' }) }

  // Décoder le base64 en texte lisible
  const buffer = Buffer.from(finalBase64, 'base64')
  const texte = buffer.toString('utf-8').replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)

  let response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://bespoke-capybara-3d4c70.netlify.app',
        'X-Title': 'IDEAL EcoleApp',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b:free',
        messages: [{ role: 'user', content: PROMPT_CORRECTION(matiere || '—', classe || '—', langue || 'fr', texte) }],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    })
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Impossible de joindre OpenRouter : ' + err.message }) }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Erreur OpenRouter : ' + (errData.error?.message || response.statusText) }) }
  }

  const data = await response.json()
  const texteReponse = data.choices?.[0]?.message?.content || ''

  let analyse
  try {
    const jsonMatch = texteReponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Aucun JSON trouvé')
    analyse = JSON.parse(jsonMatch[0])
    if (typeof analyse.total !== 'number' || !analyse.notes) throw new Error('Structure invalide')
    analyse.total = Object.values(analyse.notes).reduce((a, b) => a + b, 0)
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Réponse IA illisible : ' + err.message }) }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true, analyse }) }
}
