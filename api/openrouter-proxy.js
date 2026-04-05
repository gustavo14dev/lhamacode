export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
            status: 405, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
        return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not configured.' }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }

    try {
        const requestBody = await req.json();
        const { model, messages, max_tokens, temperature, top_p, stream, ...extra } = requestBody;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openRouterApiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://lhamacode.com', // Opcional para OpenRouter
                'X-Title': 'LhamaCode', // Opcional para OpenRouter
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: max_tokens || 65000,
                temperature: temperature || 0.7,
                top_p: top_p || 1,
                stream: stream || false,
                ...extra,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `OpenRouter API error: ${response.statusText}`);
        }

        const completion = await response.json();

        if (completion.choices && completion.choices.length > 0 && completion.choices[0].message && completion.choices[0].message.content) {
            return new Response(JSON.stringify({ content: completion.choices[0].message.content }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        } else {
            return new Response(JSON.stringify({ error: 'Invalid response from OpenRouter API' }), { 
                status: 500, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
    } catch (error) {
        console.error('❌ Error calling OpenRouter API:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}
