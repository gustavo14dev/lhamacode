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
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const form = new multiparty.Form();
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('❌ [GEMINI-DEBUG] Error parsing form data:', err);
      return res.status(500).json({ error: 'Error parsing form data' });
    }

    console.log('🔍 [GEMINI-DEBUG] Fields:', fields);
    console.log('🔍 [GEMINI-DEBUG] Files:', files);

    const userMessage = fields.message ? fields.message[0] : '';
    const context = fields.context ? JSON.parse(fields.context[0]) : [];
    
    try {
      const parts = [{ text: userMessage }];

      // Adicionar arquivos se hover
      console.log('🔍 [GEMINI-DEBUG] Processando arquivos...');
      for (const key in files) {
        console.log(`🔍 [GEMINI-DEBUG] Processando arquivo key: ${key}`);
        const fileList = files[key];
        for (const file of fileList) {
          console.log(`🔍 [GEMINI-DEBUG] Arquivo:`, {
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
      let systemInstruction = "Você é o Drekee AI 1, uma IA inteligente e prestativa.";
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

      console.log('🔍 [GEMINI-DEBUG] Payload enviado para Gemini:', JSON.stringify(payload, null, 2));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('🔍 [GEMINI-DEBUG] Resposta status:', response.status);
      console.log('🔍 [GEMINI-DEBUG] Resposta headers:', response.headers);

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ [GEMINI-DEBUG] Erro da API Gemini:', error);
        throw new Error(error.error?.message || 'Gemini API error');
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
