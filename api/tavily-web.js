export default async function handler(req, res) {
    console.log('🔍 [TAVILY-WEB] Requisição recebida:', req.method);
    console.log('🔍 [TAVILY-WEB] Body:', req.body);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        console.log('🔍 [TAVILY-WEB] Resposta OPTIONS enviada');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.error('❌ [TAVILY-WEB] Método não permitido:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body;
    console.log('🔍 [TAVILY-WEB] Mensagem:', message);

    // Validações seguras
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
    }

    // 🔍 VERIFICAÇÃO DE APIs CONFIGURADAS
    console.log('🔍 === VERIFICAÇÃO TAVILY-WEB ===');
    const apiKeys = [
        process.env.TAVILY_API_KEY_2,
        process.env.TAVILY_API_KEY_3,
        process.env.TAVILY_API_KEY // fallback para a chave original
    ].filter(key => key); // Remove chaves vazias/nulas

    console.log('🔑 TAVILY_API_KEY_2:', process.env.TAVILY_API_KEY_2 ? '✅ Configurada' : '❌ Não configurada');
    console.log('🔑 TAVILY_API_KEY_3:', process.env.TAVILY_API_KEY_3 ? '✅ Configurada' : '❌ Não configurada');
    console.log('🔑 TAVILY_API_KEY (fallback):', process.env.TAVILY_API_KEY ? '✅ Configurada' : '❌ Não configurada');
    console.log('📊 Total de chaves disponíveis:', apiKeys.length);
    console.log('=====================================');

    if (apiKeys.length === 0) {
        console.error('❌ Nenhuma chave Tavily configurada');
        return res.status(500).json({ 
            error: 'Tavily API not configured',
            message: 'Configure TAVILY_API_KEY_2, TAVILY_API_KEY_3 nas variáveis de ambiente'
        });
    }

    console.log('🔍 Recebida requisição de pesquisa Tavily-WEB:', { 
        message: message?.substring(0, 100) + '...'
    });

    // Tentar cada chave em sequência (fallback)
    for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        const keyName = i === 0 ? 'TAVILY_API_KEY_2' : i === 1 ? 'TAVILY_API_KEY_3' : 'TAVILY_API_KEY (fallback)';
        
        console.log(`🔄 [TAVILY-WEB] Tentando chave ${i + 1}/${apiKeys.length}: ${keyName}`);
        
        try {
            const tavilyData = await callTavilySearchWithKey(message, currentKey);
            
            console.log(`✅ [TAVILY-WEB] Sucesso com ${keyName}!`);
            console.log('📊 Resultados:', tavilyData.results?.length || 0);

            return res.status(200).json({
                response: tavilyData.answer || 'Pesquisa realizada com sucesso.',
                sources: tavilyData.results || [],
                query: message,
                apiKeyUsed: keyName,
                mode: 'web-search-normal'
            });
            
        } catch (error) {
            console.error(`❌ [TAVILY-WEB] Erro com ${keyName}:`, error.message);
            
            // Se for a última chave, retornar erro
            if (i === apiKeys.length - 1) {
                console.error('❌ [TAVILY-WEB] Todas as chaves falharam');
                return res.status(500).json({ 
                    error: 'All Tavily API keys failed',
                    message: 'Não foi possível realizar a pesquisa. Tente novamente mais tarde.',
                    details: error.message
                });
            }
            
            // Tentar próxima chave
            console.log(`🔄 [TAVILY-WEB] Tentando próxima chave...`);
            continue;
        }
    }
}

async function callTavilySearchWithKey(query, apiKey) {
    console.log('🔍 === CHAMADA TAVILY-WEB ===');
    console.log('🔍 Query:', query);
    console.log('🔑 API Key Status:', apiKey ? 'Presente' : 'Ausente');
    
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: apiKey,
            query: query,
            search_depth: 'basic',
            include_answer: true,
            include_domains: [],
            exclude_domains: [],
            max_results: 5, // Menos resultados para respostas normais
            include_raw_content: false,
            include_images: false
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erro Tavily API:', response.status, response.statusText);
        console.error('❌ Detalhes:', errorData);
        
        // Se for erro de limite ou API key, tentar próxima chave
        if (response.status === 429 || response.status === 401 || response.status === 403) {
            throw new Error(`API key limit/invalid: ${response.status}`);
        }
        
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Pesquisa Tavily-WEB concluída:', data.results?.length || 0, 'resultados');
    console.log('=============================');
    
    return data;
}
