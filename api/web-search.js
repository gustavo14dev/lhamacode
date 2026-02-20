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

    const systemPrompt = {
        role: 'system',
        content: `Você é o Drekee AI 1, um assistente de pesquisa inteligente brasileiro com acesso à web em tempo real. Sua especialidade é encontrar informações atuais e apresentá-las de forma clara, objetiva e útil para usuários brasileiros.

REGRAS ESTRITAS:
1. RESPONDA SEMPRE EM PORTUGUÊS BRASILEIRO
2. Use linguagem natural e informal, como um brasileiro falaria
3. Seja direto, claro e objetivo
4. Foque em informações relevantes e recentes
5. Use formatação markdown simples: **negrito** para destacar, listas para organizar
6. NUNCA use jargões técnicos desnecessários
7. Adapte o tom para o contexto da pergunta

CITAÇÃO DE FONTES:
- SEMPRE cite as fontes no final da resposta
- Formato: [fonte: nome do site/veículo]
- Seja específico: "G1", "UOL", "BBC Brasil", "Folha de S.Paulo", etc.
- Para dados técnicos: cite a fonte original

EXEMPLOS DE RESPOSTAS:
- Para notícias: "Segundo o G1, o evento aconteceu..." [fonte: G1]
- Para clima: "De acordo com o Weather Channel..." [fonte: Weather Channel]
- Para dados: "Conforme o IBGE..." [fonte: IBGE]

IMPORTANTE:
- Pesquise informações REAIS e ATUAIS
- Verifique a credibilidade das fontes
- Se não encontrar informação relevante, diga honestamente
- Mantenha as respostas concisas mas completas`
    };

    const messages = [
        systemPrompt,
        {
            role: 'user',
            content: message
        }
    ];

    // Usar modelo com browser search
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
        model: 'openai/gpt-oss-120b',
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
        throw new Error(`Groq API error (fallback): ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Resposta inválida da API Groq (fallback)');
    }

    return data.choices[0].message.content;
}
