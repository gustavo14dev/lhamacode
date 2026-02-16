// FUNÇÕES CORRIGIDAS - SEM DUPLICAÇÃO

// Função para gerar LaTeX
async generateLatexContent(message, type) {
    // Prompt interno para gerar LaTeX - ISSO FICA SECRETO
    const systemPrompt = {
        role: 'system',
        content: `Você é um especialista acadêmico e profissional em LaTeX. Gere código LaTeX completo e compilável para ${type === 'slides' ? 'apresentação profissional' : type === 'document' ? 'documento acadêmico' : 'tabela técnica'} sobre: "${message}". 
        
REGRAS CRÍTICAS - OBEDEÇA RIGIDOSAMENTE:
- GERE APENAS O CÓDIGO LATEX PURO, NADA MAIS
- NÃO inclua explicações, introduções ou textos fora do código
- NÃO inclua marcadores como \`\`\`latex ou \`\`\`
- Use pacotes padrão (beamer para slides, article para documentos, tabular para tabelas)
- O código deve ser compilável com pdflatex
- Para slides: use \\documentclass[10pt,aspectratio=169]{beamer}
- Para documentos: use \\documentclass{article}
- Para tabelas: use \\documentclass{article} com tabular environment

CONTEÚDO ESPECÍFICO E DE ALTA QUALIDADE:
- PESQUISE E GERE CONTEÚDO ESPECIALIZADO sobre o tema
- Para slides: MÍNIMO 8 SLIDES, MÁXIMO 50-80 (ideal 15-30) com conteúdo denso e útil, e que faça sentido
- Estrutura FLEXÍVEL para slides: título → introdução → desenvolvimento (3-8 slides) → aplicações → conclusão → agradecimento
- ATENÇÃO: Se o usuário pedir algo específico como "3 slides" ou "apresentação curta", RESPEITE e gere exatamente o solicitado
- Para tabelas: dados reais, específicos e técnicos sobre o tema
- Para documentos: texto acadêmico com introdução, desenvolvimento (3-4 seções) e conclusão
- NUNCA use placeholders genéricos como "Exemplo 1", "Conteúdo da tabela"
- INCLUA dados técnicos, estatísticas, exemplos reais, citações
- SEJA ESPECÍFICO E DENSO - o usuário quer APRENDER de verdade
- ADAPTE-SE AO PEDIDO DO USUÁRIO - se pedir curto, faça curto; se pedir completo, faça completo

IMPORTANTE - TIPO DE CONTEÚDO NOS SLIDES:
- NÃO use apenas tópicos/bullets curtos
- GERE TEXTO CORRIDO EXPLICATIVO em cada slide
- Cada slide deve ter 2-3 parágrafos explicativos completos
- Use bullets APENAS para complementar o texto corrido
- Explique conceitos detalhadamente, como se estivesse ensinando
- Inclua exemplos práticos, dados específicos, números reais
- Cada slide deve ser uma aula completa sobre o tópico

ESTRUTURA OBRIGATÓRIA PARA TODAS APRESENTAÇÕES:
- Slide 1: Título (capa)
- Slide 2: O que é [TEMA] - TEXTO CORRIDO EXPLICATIVO COMPLETO
- Slide 3: Como funciona [TEMA] - TEXTO CORRIDO EXPLICATIVO COMPLETO
- Slide 4+: Desenvolvimento detalhado com mais texto corrido
- Penúltimo: Resumo
- Último: Agradecimento

OBRIGATÓRIO - SLIDE "O QUE É":
- Deve ter 3-4 parágrafos corridos explicando o conceito
- Definição clara e detalhada
- Contexto histórico se aplicável
- Importância e relevância do tema
- NÃO use bullets neste slide - apenas texto corrido
- Seja didático e completo

EXEMPLO DE SLIDE "O QUE É LLM":
3 parágrafos corridos explicando:
- O que são Large Language Models
- Como surgiram e evoluíram
- Por que são importantes hoje

EXEMPLO DE SLIDE DE QUALIDADE:
- Título: "Arquitetura Transformer"
- Conteúdo: 2-3 parágrafos explicando o que é, como funciona, importância
- + bullets com pontos-chave para reforçar
- + dados específicos (ex: "176 bilhões de parâmetros no GPT-3")

EXEMPLOS DE CONTEÚDO DE QUALIDADE:
- Para "LLM": arquitetura, parâmetros, aplicações reais, modelos específicos (GPT-4, Claude, Llama)
- Para "machine learning": algoritmos específicos, métricas, casos de uso reais
- Para "blockchain": protocolos específicos, casos de uso, métricas técnicas

IMPORTANTE: O usuário quer CONTEÚDO REAL para APRENDER, não superficial. 
RETORNE APENAS O CÓDIGO LATEX, SEM NENHUM TEXTO ADICIONAL!`
    };

    const response = await this.agent.callGroqAPI('llama-3.1-8b-instant', [systemPrompt, { role: 'user', content: message }]);
    
    // Limpar resposta para obter apenas o código LaTeX
    let latexCode = response.trim();
    
    // Remover marcadores de código se existirem
    latexCode = latexCode.replace(/```latex/gi, '').replace(/```/g, '');
    
    // Remover textos introdutórios antes do código LaTeX
    const latexStart = latexCode.indexOf('\\documentclass');
    if (latexStart > 0) {
        latexCode = latexCode.substring(latexStart);
    }
    
    // Remover textos explicativos após o código LaTeX
    const latexEnd = latexCode.lastIndexOf('\\end{document}');
    if (latexEnd > -1 && latexEnd < latexCode.length - 20) {
        latexCode = latexCode.substring(0, latexEnd + 15);
    }
    
    // Adicionar estrutura básica se faltar
    if (!latexCode.includes('\\documentclass')) {
        if (type === 'slides') {
            latexCode = `\\documentclass[10pt,aspectratio=169]{beamer}
\\usetheme{default}
\\usecolortheme{default}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\title{${message}}
\\author{Drekee AI 1}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

${latexCode}

\\end{document}`;
        } else if (type === 'document') {
            latexCode = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\title{${message}}
\\author{Drekee AI 1}
\\date{\\today}

\\begin{document}

\\maketitle

${latexCode}

\\end{document}`;
        }
    }
    
    console.log('🔒 LaTeX gerado internamente (segredo):', latexCode.substring(0, 200) + '...');
    console.log('🔍 Código LaTeX completo:', latexCode);
    return latexCode;
}

// Função para compilar LaTeX para PDF
async compileLatexToPDF(latexCode) {
    // Para APRESENTAÇÕES Beamer, tentar compilação REAL primeiro
    console.log('🔧 Iniciando compilação LaTeX Beamer...');
    
    if (this.currentCreateType === 'slides') {
        console.log('🎯 Detectado tipo SLIDES - Tentando compilação Beamer REAL...');
        
        // Verificar se é código Beamer válido
        const isBeamer = latexCode.includes('\\documentclass[...]{beamer}') || 
                       latexCode.includes('\\documentclass{beamer}') ||
                       latexCode.includes('\\begin{frame}');
        
        if (isBeamer) {
            console.log('✅ Código Beamer detectado, tentando compilação PDF REAL...');
            
            try {
                console.log('📡 Enviando requisição para /api/latex-compile...');
                const response = await fetch('/api/latex-compile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        latex: latexCode,
                        format: 'pdf',
                        type: 'slides'
                    })
                });

                console.log('📡 Resposta recebida:', response.status, response.statusText);

                if (response.ok) {
                    const pdfBuffer = await response.arrayBuffer();
                    console.log('✅ Compilação Beamer PDF REAL bem-sucedida!');
                    
                    // Criar blob PDF
                    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    
                    return {
                        success: true,
                        url: url,
                        filename: `apresentacao_${Date.now()}.pdf`,
                        isSimulated: false,
                        isPDF: true,
                        latexCode: latexCode
                    };
                }
            } catch (error) {
                console.warn('❌ Compilação Beamer PDF falhou, usando fallback:', error.message);
            }
        }
    }
    
    // Fallback para compilação normal ou se não for Beamer
    console.log('🔄 Usando compilação fallback...');
    try {
        console.log('📡 Enviando requisição para /api/latex-compile...');
        const response = await fetch('/api/latex-compile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                latex: latexCode,
                format: 'pdf',
                type: this.currentCreateType
            })
        });

        console.log('📡 Resposta recebida:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('❌ Erro na resposta:', errorData);
            throw new Error(errorData.error || `Compilation failed: ${response.status}`);
        }

        const pdfBuffer = await response.arrayBuffer();
        console.log('✅ Compilação fallback bem-sucedida!');
        
        // Criar blob PDF
        const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        return {
            success: true,
            url: url,
            filename: `${this.currentCreateType}_${Date.now()}.pdf`,
            isSimulated: false,
            isPDF: true,
            latexCode: latexCode
        };
        
    } catch (error) {
        console.warn('⚠️ Serviço LaTeX próprio indisponível, usando fallback simulado:', error.message);
        return this.createSimulatedContent(latexCode);
    }
}

// Função para criar conteúdo simulado
createSimulatedContent(latexCode) {
    console.log('🎨 Criando conteúdo simulado para fallback...');
    
    const type = this.currentCreateType || 'document';
    const title = 'Conteúdo Gerado';
    const author = 'Drekee AI 1';
    
    let content = '';
    
    if (type === 'slides') {
        // Extrair frames do LaTeX para slides simulados
        const frameMatches = latexCode.match(/\\begin\{frame\}.*?\\end\{frame\}/gs);
        let slidesContent = '';
        
        if (frameMatches && frameMatches.length > 0) {
            frameMatches.forEach((frame, index) => {
                const titleMatch = frame.match(/\\frametitle\{([^}]+)\}/);
                const frameTitle = titleMatch ? titleMatch[1] : `Slide ${index + 1}`;
                let frameContent = frame.replace(/\\frametitle\{[^}]+\}/, '');
                frameContent = frameContent.replace(/\\begin\{frame\}/, '').replace(/\\end\{frame\}/, '');
                
                // Converter comandos LaTeX básicos para HTML
                frameContent = frameContent.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
                frameContent = frameContent.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
                frameContent = frameContent.replace(/\\begin\{itemize\}/g, '<ul>');
                frameContent = frameContent.replace(/\\end\{itemize\}/g, '</ul>');
                frameContent = frameContent.replace(/\\item\s+/g, '<li>');
                frameContent = frameContent.replace(/\n(?=[^<])/g, '</li><li>');
                frameContent = frameContent.replace(/<\/li>$/, '');
                
                slidesContent += `
                    <div style="margin: 20px 0; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="margin-top: 0; color: #333; font-size: 18px;">${frameTitle}</h2>
                        <div style="line-height: 1.6; color: #666;">
                            ${frameContent || '<p>Conteúdo do slide em desenvolvimento...</p>'}
                        </div>
                    </div>
                `;
            });
        } else {
            // Slides genéricos se não encontrar frames
            slidesContent = `
                <div style="margin: 20px 0; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="margin-top: 0; color: #333;">O que é ${title}</h2>
                    <p style="line-height: 1.6;">Conteúdo explicativo sobre o tema...</p>
                </div>
                <div style="margin: 20px 0; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="margin-top: 0; color: #333;">Como funciona</h2>
                    <p style="line-height: 1.6;">Explicação do funcionamento...</p>
                </div>
            `;
        }
        
        content = `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; min-height: 100vh;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="margin: 0; color: #333;">${title}</h1>
                    <p style="margin: 10px 0 0 0; color: #666;">Apresentação Simulada</p>
                </div>
                ${slidesContent}
                <div style="margin-top: 30px; padding: 15px; background: #e8f4f8; border-left: 4px solid #007acc;">
                    <p style="margin: 0; font-weight: bold;">📊 Apresentação LaTeX simulada</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
                        Esta é uma visualização simulada. Em produção, o PDF real seria gerado.
                    </p>
                </div>
            </div>
        `;
    } else {
        // Documento simulado
        const documentContent = `
            <div style="margin: 20px 0; padding: 20px; background: #f9f9f9; border-left: 4px solid #007acc;">
                <h2 style="margin-top: 0; color: #333;">Introdução</h2>
                <p style="line-height: 1.6; margin-bottom: 15px;">
                    <strong>${title}</strong> representa um dos avanços mais significativos da tecnologia moderna, 
                    transformando fundamentalmente a forma como processamos informações e tomamos decisões.
                </p>
                <p style="line-height: 1.6;">
                    Este documento explora os conceitos fundamentais, aplicações práticas e 
                    implicações futuras desta tecnologia revolucionária.
                </p>
            </div>
            
            <div style="margin: 20px 0; padding: 20px; background: #f9f9f9; border-left: 4px solid #007acc;">
                <h2 style="margin-top: 0; color: #333;">Desenvolvimento</h2>
                <p style="line-height: 1.6; margin-bottom: 15px;">
                    <strong>Conceitos Fundamentais:</strong> A tecnologia baseia-se em algoritmos 
                    capazes de aprender padrões e tomar decisões autônomas.
                </p>
                <p style="line-height: 1.6; margin-bottom: 15px;">
                    <strong>Aplicações:</strong> Setores como saúde, finanças, transporte e educação 
                    já utilizam ativamente soluções baseadas nesta tecnologia.
                </p>
                <p style="line-height: 1.6;">
                    <strong>Impacto Socioeconômico:</strong> Redefinição de modelos de negócio 
                    e criação de novas oportunidades profissionais.
                </p>
            </div>
        `;
        
        content = `
            <div style="font-family: 'Times New Roman', serif; padding: 40px; background: white; max-width: 800px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="margin: 0; font-size: 24px; color: #333;">${title}</h1>
                    <p style="margin: 10px 0 0 0; color: #666; font-style: italic;">por ${author}</p>
                </div>
                
                ${documentContent}
                
                <div style="margin-top: 40px; padding: 20px; background: #f5f5f5; border-left: 4px solid #007acc;">
                    <p style="margin: 0; font-weight: bold;">✅ Documento LaTeX gerado com sucesso!</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                        Esta é uma visualização simulada. Em produção, o PDF real seria gerado.
                    </p>
                </div>
            </div>
        `;
    }

    // SEM SEÇÃO DE CÓDIGO LATEX - O USUÁRIO NÃO DEVE VER O CÓDIGO!
    
    const fullContent = content;
    
    const blob = new Blob([fullContent], { type: 'text/html' });
    return {
        blob: blob,
        url: URL.createObjectURL(blob),
        filename: `generated_${Date.now()}.html`,
        isSimulated: true
    };
}

console.log('✅ Funções LaTeX corrigidas e sem duplicação!');
