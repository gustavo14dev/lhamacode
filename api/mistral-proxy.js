// Proxy serverless para Mistral API - Vercel (usado para arquivos anexados)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mistralApiKey = process.env.MISTRAL_API_KEY;
  
  if (!mistralApiKey) {
    return res.status(500).json({ 
      error: 'MISTRAL_API_KEY not configured in server environment' 
    });
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Mistral proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
