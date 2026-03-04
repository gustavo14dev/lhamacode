// API Web Search genérica - Vercel serverless
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, useTavily = true } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    console.log('🔍 [WEB-SEARCH] Iniciando busca web para:', query);

    try {
        if (useTavily && process.env.TAVILY_API_KEY) {
            // Usar Tavily para busca
            const tavilyResponse = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: process.env.TAVILY_API_KEY,
                    query: query,
                    search_depth: 'basic',
                    include_answer: true,
                    max_results: 5
                })
            });

            if (tavilyResponse.ok) {
                const data = await tavilyResponse.json();
                console.log('✅ [WEB-SEARCH] Busca Tavily concluída:', data.results?.length || 0, 'resultados');
                
                return res.status(200).json({
                    success: true,
                    source: 'tavily',
                    results: data.results || [],
                    answer: data.answer || '',
                    query: query
                });
            }
        }

        // Fallback para busca simulada se Tavily falhar
        console.log('⚠️ [WEB-SEARCH] Usando fallback simulado');
        return res.status(200).json({
            success: true,
            source: 'fallback',
            results: [
                {
                    title: 'Resultado simulado para: ' + query,
                    url: 'https://example.com',
                    content: 'Este é um resultado simulado. Configure TAVILY_API_KEY para obter resultados reais.',
                    score: 0.5
                }
            ],
            answer: `Busca simulada para "${query}". Configure as APIs para obter resultados reais.`,
            query: query
        });

    } catch (error) {
        console.error('❌ [WEB-SEARCH] Erro na busca web:', error);
        return res.status(500).json({ 
            error: 'Failed to perform web search',
            message: error.message 
        });
    }
}
