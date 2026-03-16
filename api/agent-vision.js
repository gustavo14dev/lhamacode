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

        if (model === 'groq') {
            response = await callGroqVision(prompt, imageData);
        } else if (model === 'gemini') {
            response = await callGeminiVision(prompt, imageData);
        } else {
            return res.status(400).json({ error: 'Invalid model' });
        }

        res.status(200).json({ response });

    } catch (error) {
        console.error('Agent Vision Error:', error);
        res.status(500).json({ error: error.message });
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
                model: 'llava-v1.5-7b-4096-preview',
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
        return data.choices[0].message.content;

    } catch (error) {
        console.error('Groq Vision Error:', error);
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
        return data.candidates[0].content.parts[0].text;

    } catch (error) {
        console.error('Gemini Vision Error:', error);
        throw error;
    }
}
