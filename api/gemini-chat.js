// API Gemini para processar texto e arquivos - Vercel serverless
import multiparty from 'multiparty';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  console.log('🔍 [GEMINI-DEBUG] GEMINI_API_KEY existe:', !!geminiApiKey);
  console.log('🔍 [GEMINI-DEBUG] GEMINI_API_KEY length:', geminiApiKey?.length || 0);
  
  if (!geminiApiKey) {
    console.error(' [GEMINI-DEBUG] GEMINI_API_KEY não configurada!');
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const form = new multiparty.Form();
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(' [GEMINI-DEBUG] Error parsing form data:', err);
      return res.status(500).json({ error: 'Error parsing form data' });
    }

    console.log(' [GEMINI-DEBUG] Fields:', fields);
    console.log(' [GEMINI-DEBUG] Files:', files);

    const userMessage = fields.message ? fields.message[0] : '';
    const context = fields.context ? JSON.parse(fields.context[0]) : [];
    const model = fields.model ? fields.model[0] : 'gemini-2.5-flash';
    
    try {
      const parts = [{ text: userMessage }];

      // Adicionar arquivos se houver
      console.log(' [GEMINI-DEBUG] Processando arquivos...');
      for (const key in files) {
        console.log(` [GEMINI-DEBUG] Processando arquivo key: ${key}`);
        const fileList = files[key];
        for (const file of fileList) {
          console.log(` [GEMINI-DEBUG] Arquivo:`, {
            originalFilename: file.originalFilename,
            path: file.path,
            headers: file.headers,
            size: file.size
          });
          const fileData = fs.readFileSync(file.path);
          const base64Data = fileData.toString('base64');
          
          parts.push({
            inline_data: {
              mime_type: file.headers['content-type'] || 'image/jpeg',
              data: base64Data
            }
          });
        }
      }

      // Adicionar contexto se houver
      let systemInstruction = "Você é o Drekee AI, um assistente de IA focado em codificação e produtividade.";
      if (context && context.length > 0) {
          systemInstruction += "\n\nContexto da conversa:\n" + context.map(m => `${m.role}: ${m.content}`).join('\n');
      }

      const payload = {
        contents: [{
          parts: parts
        }],
        system_instruction: {
            parts: [{ text: systemInstruction }]
        }
      };

      console.log(' [GEMINI-DEBUG] Payload enviado para Gemini:', JSON.stringify(payload, null, 2));

      console.log('🔍 [GEMINI-DEBUG] Modelo solicitado:', model);
      console.log('🔍 [GEMINI-DEBUG] URL completa:', `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log(' [GEMINI-DEBUG] Resposta status:', response.status);
      console.log(' [GEMINI-DEBUG] Resposta headers:', response.headers);
      console.log('🔍 [GEMINI-DEBUG] Resposta headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [GEMINI-DEBUG] Erro na API Gemini:', response.status);
        console.error('❌ [GEMINI-DEBUG] Error response:', errorText);
        return res.status(500).json({ error: 'Erro na API Gemini', details: errorText });
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, não consegui processar.';

      return res.status(200).json({ text: aiResponse });

    } catch (error) {
      console.error('❌ [GEMINI-DEBUG] Erro geral:', error);
      console.error('❌ [GEMINI-DEBUG] Stack:', error.stack);
      return res.status(500).json({ error: error.message });
    }
  });
}
