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

        // Aumentando o timeout para o máximo razoável em Edge Functions (Vercel Pro permite até 300s, mas o padrão é 30s)
        // Vamos tentar 55 segundos, esperando que a infraestrutura suporte.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000); 

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://lhamacode.com',
                    'X-Title': 'LhamaCode',
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
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const contentType = response.headers.get('content-type');
            if (!response.ok) {
                let errorMessage = `OpenRouter API error: ${response.statusText}`;
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.error?.message || errorMessage;
                } else {
                    const textError = await response.text();
                    errorMessage = textError.substring(0, 200) || errorMessage;
                }
                throw new Error(errorMessage);
            }

            if (contentType && contentType.includes('application/json')) {
                const completion = await response.json();
                if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                    return new Response(JSON.stringify({ content: completion.choices[0].message.content }), { 
                        status: 200, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                } else {
                    throw new Error('Invalid response structure from OpenRouter');
                }
            } else {
                throw new Error('OpenRouter returned non-JSON response');
            }

        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                throw new Error('OpenRouter API request timed out (55s). O modelo gratuito pode estar lento.');
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('❌ Error calling OpenRouter API:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}
