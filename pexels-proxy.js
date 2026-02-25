// api/pexels-proxy.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { query } = req.body;
    const pexelsApiKey = process.env.PEXELS_API_KEY;

    if (!pexelsApiKey) {
        console.error('PEXELS_API_KEY não está configurada nas variáveis de ambiente.');
        return res.status(500).json({ error: 'Pexels API Key não configurada.' });
    }

    if (!query) {
        return res.status(400).json({ error: 'O parâmetro de consulta (query) é obrigatório.' });
    }

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`;

    try {
        const pexelsResponse = await fetch(url, {
            headers: {
                'Authorization': pexelsApiKey
            }
        });

        if (!pexelsResponse.ok) {
            const errorText = await pexelsResponse.text();
            console.error(`Erro na API do Pexels: ${pexelsResponse.status} - ${errorText}`);
            return res.status(pexelsResponse.status).json({ error: `Falha ao buscar imagens do Pexels: ${errorText}` });
        }

        const data = await pexelsResponse.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('Erro no proxy do Pexels:', error);
        return res.status(500).json({ error: 'Erro interno do servidor ao buscar imagens do Pexels.' });
    }
}