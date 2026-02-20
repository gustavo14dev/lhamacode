// API endpoint para pesquisa na web
export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('🔍 Recebida requisição de pesquisa:', message);

        // Chamar a API do Groq com browser search
        const response = await callGroqWithBrowserSearch(message);

        console.log('✅ Resposta da pesquisa gerada');

        return res.status(200).json({
            response: response,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro na API de pesquisa:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

async function callGroqWithBrowserSearch(message) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY não está configurada');
    }

    const systemPrompt = {
        role: 'system',
        content: `Você é o Drekee AI 1, um assistente de pesquisa inteligente com acesso à web em tempo real. Você é capaz de pesquisar informações atuais e fornecer respostas baseadas em fontes confiáveis. 

REGRAS IMPORTANTES:
- Use formatação markdown quando apropriado: **negrito**, *itálico*, listas, etc.
- Seja claro, direto e cite as fontes quando possível.
- SEMPRE inclua as fontes pesquisadas no final da resposta no formato: [fonte: nome da fonte]
- Para notícias, cite o veículo de notícias e data.
- Para dados técnicos, mencione a fonte original.
- Use linguagem natural e informativa.
- Seja objetivo e baseado em fatos.`
    };

    const messages = [
        systemPrompt,
        {
            role: 'user',
            content: message
        }
    ];

    const requestBody = {
        model: 'openai/gpt-oss-20b',
        messages: messages,
        temperature: 0.7,
        max_tokens: 8192,
        top_p: 1,
        stream: false,
        tool_choice: "required",
        tools: [
            {
                type: "browser_search"
            }
        ]
    };

    console.log('📡 Enviando requisição para Groq com browser search...');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na API Groq:', response.status, errorText);
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Resposta inválida da API Groq');
    }

    const content = data.choices[0].message.content;
    console.log('✅ Resposta recebida do Groq');
    
    return content;
}
