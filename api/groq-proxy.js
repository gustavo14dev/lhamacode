// Proxy serverless para Groq API - Vercel
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  
  if (!groqApiKey) {
    return res.status(500).json({ 
      error: 'GROQ_API_KEY not configured in server environment' 
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
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
    console.error('Groq proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
