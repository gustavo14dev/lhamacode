export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
  }

  if (!process.env.TAVILY_API_KEY) {
    return res.status(500).json({
      error: 'Tavily API not configured',
      message: 'Configure TAVILY_API_KEY nas variaveis de ambiente'
    });
  }

  try {
    const tavilyData = await callTavilySearch(message);
    const sources = Array.isArray(tavilyData.results) ? tavilyData.results.slice(0, 6) : [];
    const answer = typeof tavilyData.answer === 'string' ? tavilyData.answer.trim() : '';

    return res.status(200).json({
      query: message,
      answer,
      response: buildResearchSummary(answer, sources),
      sources,
      mode: 'web-research'
    });
  } catch (error) {
    console.error('[tavily-search] request failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

async function callTavilySearch(query) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      include_answer: true,
      include_domains: [],
      exclude_domains: [],
      max_results: 8,
      include_raw_content: false,
      include_images: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Tavily API error: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  return response.json();
}

function buildResearchSummary(answer, sources) {
  const lines = [];

  if (answer) {
    lines.push(`Resumo Tavily: ${answer}`);
  }

  if (Array.isArray(sources) && sources.length > 0) {
    const sourceLines = sources.slice(0, 3).map((source, index) => {
      const title = cleanInline(source.title || `Fonte ${index + 1}`);
      const snippet = cleanInline(source.content || source.snippet || '').slice(0, 220);
      return snippet ? `[${index + 1}] ${title}: ${snippet}` : `[${index + 1}] ${title}`;
    });

    lines.push('Fontes principais:');
    lines.push(...sourceLines);
  }

  return lines.join('\n');
}

function cleanInline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
