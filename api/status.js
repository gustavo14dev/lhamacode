// Endpoint para verificar status das APIs configuradas
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const status = {
    groq: !!process.env.GROQ_API_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
    timestamp: new Date().toISOString()
  };

  return res.status(200).json(status);
}
