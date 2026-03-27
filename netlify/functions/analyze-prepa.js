exports.handler = async (event, context) => {
  console.log("--- Nouvelle requête d'analyse reçue ---");
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Méthode non autorisée' };
  }
  
  try {
    const { base64Data, mimeType, prompt } = JSON.parse(event.body);
    const API_KEY = "AIzaSyDFY2r9DX0OmzIAgvWBAYl-BU1RWNo96n0";

    // Utilisation du fetch natif disponible dans Node.js 18+ sur Netlify
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Google API Error:", data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || "Erreur Google API" })
      };
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Sécurité supplémentaire
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Netlify Function Crash:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Le serveur relais a rencontré un problème technique." })
    };
  }
};
