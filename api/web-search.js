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
        // Fallback quando não há API key
        return `🔍 **Pesquisa Simulada**

Você perguntou: "${message}"

[fonte: Simulação Local]

*Esta é uma resposta simulada porque a API Groq não está configurada. Para testar com pesquisa real, configure a GROQ_API_KEY no ambiente.*

**Como configurar:**
1. Obtenha uma chave em https://console.groq.com
2. Adicione GROQ_API_KEY= sua_chave ao ambiente
3. Reinicie o servidor

[fonte: Documentação Drekee AI]`;
    }

    console.log('🔍 Iniciando chamada para Groq API...');

    const systemPrompt = {
        role: 'system',
        content: `Você é o Drekee AI 1, um assistente de pesquisa inteligente brasileiro com acesso à web em tempo real. Sua especialidade é encontrar informações atuais e apresentá-las de forma clara, objetiva e útil para usuários brasileiros.

REGRAS ESTRITAS:
1. RESPONDA SEMPRE EM PORTUGUÊS BRASILEIRO
2. Use linguagem natural e informal, como um brasileiro falaria
3. Seja direto, claro e objetivo
4. Use formatação markdown quando apropriado: **negrito**, *itálico*, listas, etc.
5. No final da resposta, adicione as fontes no formato exato:
   Fonte: Nome do Site – "Título da Matéria" (data)
6. Use o browser search para encontrar informações atuais e confiáveis
7. Cite as fontes de forma clara e precisa

EXEMPLO DE FORMATO DE FONTE:
Fonte: G1 – "Título da notícia" (09/02/2026)
Fonte: UOL – "Outra notícia importante" (08/02/2026)`
    };

    const messages = [
        systemPrompt,
        {
            role: 'user',
            content: message
        }
    ];

    // Tentar com modelo principal
    try {
        console.log('📡 Tentando modelo principal: openai/gpt-oss-120b');
        return await callWithMainModel(message, systemPrompt, messages);
    } catch (error) {
        console.log('⚠️ Modelo principal falhou, tentando fallback:', error.message);
        try {
            console.log('📡 Tentando modelo fallback: llama-3.1-8b-instant');
            return await callWithFallbackModel(message, systemPrompt);
        } catch (fallbackError) {
            console.log('❌ Todos os modelos falharam:', fallbackError.message);
            throw new Error(`Todos os modelos de pesquisa falharam: ${fallbackError.message}`);
        }
    }
}

async function callWithMainModel(message, systemPrompt, messages) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    const requestBody = {
        model: 'openai/gpt-oss-120b',
        messages: messages,
        temperature: 0.3, // Menos criatividade, mais precisão
        max_tokens: 4096,
        top_p: 0.9,
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
        
        // Tentar com modelo menor se o 70B falhar
        if (response.status === 429 || response.status === 502) {
            console.log('🔄 Tentando com modelo menor...');
            return await callWithSmallerModel(message, systemPrompt);
        }
        
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

async function callWithSmallerModel(message, systemPrompt) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    const requestBody = {
        model: 'llama-3.1-8b-instant',
        messages: [
            systemPrompt,
            { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 2048,
        top_p: 0.9,
        stream: false,
        tool_choice: "required",
        tools: [
            {
                type: "browser_search"
            }
        ]
    };

    console.log('📡 Enviando requisição para Groq com modelo fallback...');

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
        console.error('❌ Erro na API Groq (fallback):', response.status, errorText);
        throw new Error(`Groq API error (fallback): ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Resposta inválida da API Groq (fallback)');
    }

    console.log('✅ Resposta recebida do modelo fallback');
    return data.choices[0].message.content;
}
