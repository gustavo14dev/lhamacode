const DEFAULT_PROVIDER = 'gemini';
const SUPPORTED_PROVIDERS = new Set(['gemini', 'groq']);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
        const imageData = normalizeImageData(req.body);
        const requestedProvider = normalizeProvider(req.body?.model || req.body?.provider);

        if (!prompt || !imageData) {
            return res.status(400).json({
                error: 'Missing prompt or image data',
                details: {
                    hasPrompt: Boolean(prompt),
                    hasImage: Boolean(imageData)
                }
            });
        }

        const providerOrder = buildProviderOrder(requestedProvider);
        const errors = [];

        for (const provider of providerOrder) {
            try {
                const result = provider === 'gemini'
                    ? await callGeminiVision(prompt, imageData)
                    : await callGroqVision(prompt, imageData);

                return res.status(200).json({
                    providerUsed: provider,
                    fallbackUsed: provider !== requestedProvider,
                    rawText: result.rawText,
                    response: result.parsed ?? result.rawText,
                    parsed: result.parsed ?? null
                });
            } catch (error) {
                errors.push({
                    provider,
                    message: error.message
                });
                console.error(`Agent vision provider failed (${provider}):`, error.message);
            }
        }

        const status = errors.some((entry) => entry.message === 'RATE_LIMIT') ? 429 : 502;

        return res.status(status).json({
            error: 'All vision providers failed',
            tried: errors
        });
    } catch (error) {
        console.error('Agent Vision Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}

function normalizeProvider(value) {
    const provider = typeof value === 'string' ? value.toLowerCase().trim() : DEFAULT_PROVIDER;
    return SUPPORTED_PROVIDERS.has(provider) ? provider : DEFAULT_PROVIDER;
}

function buildProviderOrder(requestedProvider) {
    const primary = normalizeProvider(requestedProvider);
    return primary === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
}

function normalizeImageData(body = {}) {
    const candidate = body?.imageData || body?.image || body?.image_url || body?.dataUrl;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function parseDataUrl(imageData) {
    const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

    if (match) {
        return {
            mimeType: match[1],
            base64Data: match[2]
        };
    }

    return {
        mimeType: 'image/png',
        base64Data: imageData
    };
}

function extractJsonObject(rawText) {
    if (typeof rawText !== 'string') {
        return null;
    }

    const trimmed = rawText.trim();
    if (!trimmed) {
        return null;
    }

    const withoutFence = trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const direct = tryParseJson(withoutFence);
    if (direct) {
        return direct;
    }

    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end > start) {
        return tryParseJson(withoutFence.slice(start, end + 1));
    }

    return null;
}

function tryParseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function buildVisionSystemPrompt(prompt) {
    return [
        'Voce e o Drekee Agent 1.0.',
        'Analise a imagem e responda SOMENTE com JSON valido.',
        'Use exatamente estas chaves:',
        '{',
        '  "pagina_atual": "string",',
        '  "elementos_interativos": ["string"],',
        '  "acoes_possiveis": ["string"],',
        '  "proximo_passo": "string"',
        '}',
        '',
        prompt
    ].join('\n');
}

async function callGroqVision(prompt, imageData) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not configured');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.2-90b-vision-preview',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: buildVisionSystemPrompt(prompt)
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
            max_tokens: 900,
            temperature: 0.1
        })
    });

    const data = await response.json();

    if (response.status === 429) {
        throw new Error('RATE_LIMIT');
    }

    if (!response.ok) {
        throw new Error(`Groq API Error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
    }

    const rawText = extractMessageText(data.choices?.[0]?.message?.content);
    if (!rawText) {
        throw new Error('Groq returned empty content');
    }

    return {
        rawText,
        parsed: extractJsonObject(rawText)
    };
}

async function callGeminiVision(prompt, imageData) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const { mimeType, base64Data } = parseDataUrl(imageData);
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: buildVisionSystemPrompt(prompt)
                            },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 900,
                    responseMimeType: 'application/json'
                }
            })
        }
    );

    const data = await response.json();

    if (response.status === 429) {
        throw new Error('RATE_LIMIT');
    }

    if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
    }

    const rawText = extractGeminiText(data);
    if (!rawText) {
        throw new Error('Gemini returned empty content');
    }

    return {
        rawText,
        parsed: extractJsonObject(rawText)
    };
}

function extractMessageText(content) {
    if (Array.isArray(content)) {
        return content
            .map((part) => (typeof part === 'string' ? part : part?.text || ''))
            .join('\n')
            .trim();
    }

    return typeof content === 'string' ? content.trim() : '';
}

function extractGeminiText(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts
        .map((part) => part?.text || '')
        .join('\n')
        .trim();
}
