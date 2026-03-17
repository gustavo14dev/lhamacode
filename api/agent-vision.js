// Endpoint para visão computacional do agente
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt, imageData, model = 'groq' } = req.body;

        if (!prompt || !imageData) {
            return res.status(400).json({ error: 'Missing prompt or image data' });
        }

        let response;
        let lastError;

        // Tentar modelo solicitado primeiro
        try {
            if (model === 'groq') {
                response = await callGroqVision(prompt, imageData);
            } else if (model === 'gemini') {
                response = await callGeminiVision(prompt, imageData);
            } else {
                return res.status(400).json({ error: 'Invalid model' });
            }
        } catch (error) {
            lastError = error;
            console.error(`Primary model (${model}) failed:`, error.message);
            
            // Se for erro 429, tentar o outro modelo automaticamente
            if (error.message === 'RATE_LIMIT_GROQ' || error.message === 'RATE_LIMIT_GEMINI') {
                console.log('Rate limit hit, trying fallback model...');
                
                try {
                    if (model === 'groq') {
                        console.log('Falling back to Gemini...');
                        response = await callGeminiVision(prompt, imageData);
                    } else {
                        console.log('Falling back to Groq...');
                        response = await callGroqVision(prompt, imageData);
                    }
                } catch (fallbackError) {
                    console.error('Fallback model also failed:', fallbackError.message);
                    return res.status(429).json({ 
                        error: 'Both models rate limited',
                        message: 'Both Groq and Gemini APIs are rate limited. Please try again later.',
                        retry_after: 60
                    });
                }
            } else {
                throw error;
            }
        }

        res.status(200).json({ response });

    } catch (error) {
        console.error('Agent Vision Error:', error);
        
        if (error.message === 'RATE_LIMIT_GROQ' || error.message === 'RATE_LIMIT_GEMINI') {
            res.status(429).json({ 
                error: 'Rate limit exceeded',
                message: 'API rate limit exceeded. Please try again later.',
                retry_after: 60
            });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
}

async function callGroqVision(prompt, imageData) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.2-11b-vision-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageData
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                temperature: 0.1
            })
        });

        const data = await response.json();
        
        // Tratar erro 429 (rate limit)
        if (response.status === 429) {
            console.error('Groq Rate Limit (429):', data);
            throw new Error('RATE_LIMIT_GROQ');
        }
        
        if (!response.ok) {
            throw new Error(`Groq API Error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
        }
        
        return data.choices[0].message.content;

    } catch (error) {
        console.error('Groq Vision Error:', error);
        
        // Se for rate limit, retornar erro específico
        if (error.message === 'RATE_LIMIT_GROQ') {
            throw new Error('RATE_LIMIT_GROQ');
        }
        
        throw error;
    }
}

async function callGeminiVision(prompt, imageData) {
    try {
        // Converter base64 para formato Gemini
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            },
                            {
                                inline_data: {
                                    mime_type: 'image/png',
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1000
                }
            })
        });

        const data = await response.json();
        
        // Tratar erro 429 (rate limit)
        if (response.status === 429) {
            console.error('Gemini Rate Limit (429):', data);
            throw new Error('RATE_LIMIT_GEMINI');
        }
        
        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
        }
        
        return data.candidates[0].content.parts[0].text;

    } catch (error) {
        console.error('Gemini Vision Error:', error);
        
        // Se for rate limit, retornar erro específico
        if (error.message === 'RATE_LIMIT_GEMINI') {
            throw new Error('RATE_LIMIT_GEMINI');
        }
        
        throw error;
    }
}
