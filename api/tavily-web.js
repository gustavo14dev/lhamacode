// API Tavily Web para busca automática em todas as respostas - Vercel serverless
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

    const { message, conversationHistory = [] } = req.body;
    console.log('🔍 [TAVILY-WEB] Mensagem:', message);
    console.log('🔍 [TAVILY-WEB] Histórico:', conversationHistory.length, 'mensagens');

    // Validações seguras
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        console.error('❌ [TAVILY-WEB] Mensagem inválida ou vazia');
        return res.status(400).json({ 
            error: 'Message parameter is required and must be a non-empty string' 
        });
    }

    if (!Array.isArray(conversationHistory)) {
        console.error('❌ [TAVILY-WEB] conversationHistory não é um array');
        return res.status(400).json({ 
            error: 'conversationHistory must be an array' 
        });
    }

    // 🔍 VERIFICAÇÃO DE APIs CONFIGURADAS
    console.log('🔍 === VERIFICAÇÃO DE CONFIGURAÇÃO ===');
    console.log('🔑 TAVILY_API_KEY:', process.env.TAVILY_API_KEY ? '✅ Configurada' : '❌ Não configurada');
    console.log('🔑 GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Configurada' : '❌ Não configurada');
    console.log('🤖 Modelo Principal: openai/gpt-oss-120b');
    console.log('🔄 Modelo Fallback: llama-3.1-8b-instant');
    console.log('🔍 Engine de Pesquisa: Tavily AI');
    console.log('=====================================');

    // Verificar se a API key do Tavily está configurada
    if (!process.env.TAVILY_API_KEY) {
        console.error('❌ TAVILY_API_KEY não configurada');
        return res.status(500).json({ 
            error: 'Tavily API not configured',
            message: 'Configure TAVILY_API_KEY nas variáveis de ambiente'
        });
    }

    console.log('🔍 Recebida requisição de pesquisa Tavily-WEB:', { 
        message: message?.substring(0, 100) + '...', 
        historyLength: conversationHistory?.length || 0 
    });

    try {
        // Fazer pesquisa com Tavily
        console.log('🔍 Iniciando pesquisa com Tavily AI...');
        const tavilyData = await callTavilySearch(message);
        
        // Construir mensagens com histórico e resultados da pesquisa
        const messages = [
            {
                role: 'system',
                content: `Você é um assistente de IA especializado em pesquisas web. Use as informações fornecidas pela Tavily AI para responder à pergunta do usuário de forma precisa e bem fundamentada.

IMPORTANTE:
- Baseie sua resposta PRINCIPALMENTE nos resultados da pesquisa fornecidos
- Se os resultados não forem suficientes, complemente com seu conhecimento
- Sempre cite as fontes quando usar informações dos resultados
- Responda em português

Resultados da pesquisa:
${JSON.stringify(tavilyData.results, null, 2)}`
            },
            ...conversationHistory.slice(-4), // Últimas 4 mensagens para contexto
            {
                role: 'user',
                content: message
            }
        ];
        
        const response = await callWithEconomicModel(messages);
        
        console.log('✅ Resposta da pesquisa Tavily-WEB gerada com sucesso');

        return res.status(200).json({
            response: response,
            sources: tavilyData.results || [],
            model: 'llama-3.1-8b-instant (econômico)',
            mode: 'web-search'
        });
        
    } catch (error) {
        console.error('❌ Erro na API Tavily-WEB:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

async function callTavilySearch(query) {
    console.log('🔍 === CHAMADA TAVILY AI ===');
    console.log('🔍 Query:', query);
    console.log('🔑 API Key Status:', process.env.TAVILY_API_KEY ? 'Presente' : 'Ausente');
    
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: query,
            search_depth: 'basic',
            include_answer: true,
            include_domains: [],
            exclude_domains: [],
            max_results: 5,
            include_raw_content: false,
            days: 7
        })
    });

    if (!response.ok) {
        console.error('❌ Erro Tavily API:', response.status, response.statusText);
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Pesquisa Tavily concluída:', data.results?.length || 0, 'resultados');
    console.log('=============================');
    
    return data;
}

async function callWithEconomicModel(messages) {
    console.log('🤖 === CHAMADA MODELO ECONÔMICO ===');
    console.log('🤖 Modelo: llama-3.1-8b-instant');
    console.log('🤖 Mensagens:', messages.length);
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7,
            stream: false
        })
    });

    if (!response.ok) {
        console.error('❌ Erro modelo econômico:', response.status, response.statusText);
        throw new Error(`Model API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('✅ Resposta do modelo econômico gerada');
    console.log('===============================');
    
    return content;
}
