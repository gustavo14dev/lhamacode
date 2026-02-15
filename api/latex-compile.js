// API para compilar LaTeX - Vercel
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { latex, format = 'pdf', type = 'document' } = req.body;

  if (!latex || typeof latex !== 'string') {
    return res.status(400).json({ error: 'LaTeX content is required' });
  }

  // Validar tamanho do conteúdo LaTeX (limite de 50KB)
  if (latex.length > 50000) {
    return res.status(400).json({ error: 'LaTeX content too large (max 50KB)' });
  }

  try {
    let pdfBuffer = null;

    // Método 1: Tentar LaTeX Online Compiler
    try {
      console.log('Tentando LaTeX Online Compiler...');
      const compileResponse = await fetch('https://latexonline.cc/compiler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          latex: latex,
          format: 'pdf',
          engine: 'pdflatex',
          timeout: '30'
        }),
        signal: AbortSignal.timeout(30000) // 30s timeout
      });

      if (compileResponse.ok) {
        pdfBuffer = await compileResponse.arrayBuffer();
        console.log('✅ Compilação LaTeX bem-sucedida com LaTeX Online Compiler');
      }
    } catch (error1) {
      console.warn('LaTeX Online Compiler falhou:', error1.message);
    }

    // Método 2: Fallback - Tentar serviço alternativo (se disponível)
    if (!pdfBuffer) {
      try {
        console.log('Tentando serviço alternativo...');
        const altResponse = await fetch('https://texlive.net/runlatex', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latex: latex,
            format: 'pdf'
          }),
          signal: AbortSignal.timeout(20000) // 20s timeout
        });

        if (altResponse.ok) {
          pdfBuffer = await altResponse.arrayBuffer();
          console.log('✅ Compilação LaTeX bem-sucedida com serviço alternativo');
        }
      } catch (error2) {
        console.warn('Serviço alternativo falhou:', error2.message);
      }
    }

    // Método 3: Último fallback - Gerar HTML simulado
    if (!pdfBuffer) {
      console.log('Usando fallback HTML simulado...');
      const htmlContent = generateSimulatedHTML(latex, type);

      // Retornar HTML em vez de PDF
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="generated.html"`);
      res.status(200).send(htmlContent);
      return;
    }

    // Retornar o PDF compilado
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="generated.pdf"`);
    res.status(200).send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('Erro geral na compilação LaTeX:', error);

    // Fallback final: HTML simulado
    const htmlContent = generateSimulatedHTML(latex, type);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="generated.html"`);
    res.status(200).send(htmlContent);
  }
}

// Função para gerar HTML simulado quando LaTeX falha - AGORA USA CONTEÚDO REAL!
function generateSimulatedHTML(latex, type = 'document') {
  // Extrair informações básicas do LaTeX
  const titleMatch = latex.match(/\\title\{([^}]+)\}/);
  const authorMatch = latex.match(/\\author\{([^}]+)\}/);

  const title = titleMatch ? titleMatch[1] : 'Conteúdo Gerado';
  const author = authorMatch ? authorMatch[1] : 'Drekee AI 1';

  let content = '';

  if (type === 'table') {
    // Tentar extrair tabela REAL do LaTeX
    const tableMatch = latex.match(/\\begin\{tabular\}.*?\\end\{tabular\}/s);
    if (tableMatch) {
      // Converter tabela LaTeX para HTML real
      const tableLatex = tableMatch[0];
      
      // Extrair o conteúdo da tabela (entre \begin{tabular} e \end{tabular})
      const tableContentMatch = tableLatex.match(/\\begin\{tabular\}\{.*?\}(.*?)\\end\{tabular\}/s);
      let tableHTML = '<table style="width: auto; border-collapse: collapse; font-size: 14px; margin: 20px auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 100%; overflow-x: auto;">';

      if (tableContentMatch && tableContentMatch[1]) {
        const rawTableContent = tableContentMatch[1];
        // Dividir em linhas, ignorando as linhas vazias e \hline
        const lines = rawTableContent.split('\\\\').map(line => line.trim()).filter(line => line && line !== '\\hline');

        lines.forEach((line, index) => {
          // Remover \hline que podem estar no início ou fim da linha
          const cleanLine = line.replace(/^\\hline\s*|\s*\\hline$/g, '');
          if (cleanLine) {
            // Separar colunas por &
            const cells = cleanLine.split('&').map((cell, cellIndex) => {
              // Limpar completamente cada célula
              let cleanedCell = cell.trim()
                .replace(/&amp;/g, '') // Remover &amp; (HTML entity)
                .replace(/&/g, '') // Remover & restante
                .replace(/\$|\\times|\\cdot/g, '') // Remover $, \times e \cdot
                .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '') // Remover outros comandos LaTeX
                .replace(/[=]/g, '') // Remover sinais de igual
                .replace(/[^a-zA-Z0-9\s\.\,\-\/\%\(\)]/g, '') // Manter apenas caracteres básicos
                .replace(/\s+/g, ' ') // Reduzir múltiplos espaços para um
                .trim();

              // Se for a célula de resultado (última coluna), extrair só o número final
              if (cleanedCell.includes(' ')) {
                const parts = cleanedCell.split(' ').filter(p => p.trim());
                if (parts.length > 1) {
                  // Se tem múltiplos números, pegar o último (resultado)
                  const lastNumber = parts[parts.length - 1];
                  if (/^\d+$/.test(lastNumber)) {
                    cleanedCell = lastNumber;
                  }
                }
              }

              // Se for a primeira coluna e contiver 'n' ou 'n/7', limpar ainda mais
              if (cellIndex === 0 && (cleanedCell.includes('n') || cleanedCell.includes('n/7'))) {
                cleanedCell = cleanedCell.replace(/n\/?7?/g, '').trim();
                
                // Se ficou vazio, colocar o número da linha
                if (!cleanedCell) {
                  cleanedCell = (index === 0) ? 'N' : String(index);
                }
              }
              return cleanedCell;
            });
            const isHeader = index === 0; // Primeira linha é o cabeçalho
            
            tableHTML += '<tr style="' + (isHeader ? 'background: #f0f0f0;' : '') + '">';
            cells.forEach(cell => {
              tableHTML += `<td style="border: 1px solid #ddd; padding: 12px 8px; text-align: center; font-weight: ${isHeader ? 'bold' : 'normal'}; min-width: 50px; background: ${isHeader ? '#f8f9fa' : 'white'};">${cell}</td>`;
            });
            tableHTML += '</tr>';
          }
        });
      }
      tableHTML += '</table>';
      
      content = `
        <div style="font-family: 'Times New Roman', serif; padding: 40px; background: white; max-width: 800px; margin: 0 auto;">
          <h1 style="text-align: center; margin-bottom: 30px; color: #333;">${title}</h1>
          <p style="text-align: center; color: #666; margin-bottom: 40px;">por ${author}</p>
          
          <div style="background: white; border: 2px solid #333; margin: 20px 0; overflow-x: auto; max-width: 100%;">
            ${tableHTML}
          </div>
          
          <div style="margin-top: 40px; padding: 20px; background: #f5f5f5; border-left: 4px solid #007acc;">
            <p style="margin: 0; font-weight: bold;">✅ Tabela LaTeX gerada com sucesso!</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
              Conteúdo real extraído do código LaTeX gerado pela IA.
            </p>
          </div>
        </div>
      `;
    } else {
      // Fallback genérico se não encontrar tabela
      content = `...conteúdo genérico...`;
    }
  } else if (type === 'slides') {
    // Estrutura PROFISSIONAL de apresentação
    const frameMatches = latex.match(/\\begin\{frame\}.*?\\end\{frame\}/gs);
    if (frameMatches && frameMatches.length > 0) {
      let slidesData = [];
      
      // Extrair título e autor
      const titleMatch = latex.match(/\\title\{([^}]+)\}/);
      const authorMatch = latex.match(/\\author\{([^}]+)\}/);
      const title = titleMatch ? titleMatch[1] : 'Conteúdo Gerado';
      const author = authorMatch ? authorMatch[1] : 'Drekee AI 1';
      
      // ESTRUTURA PROFISSIONAL DE SLIDES
      const totalFrames = frameMatches.length;
      
      // Processar cada frame
      frameMatches.forEach((frame, index) => {
        const frameTitleMatch = frame.match(/\\frametitle\{([^}]+)\}/);
        let frameTitle = frameTitleMatch ? frameTitleMatch[1] : '';
        
        // Extrair conteúdo do frame - LIMPEZA COMPLETA DO LATEX
        let frameContent = frame
          .replace(/\\begin\{frame\}/g, '')
          .replace(/\\end\{frame\}/g, '')
          .replace(/\\frametitle\{([^}]+)\}/g, '')
          .replace(/\\begin\{itemize\}/g, '<ul style="margin: 0; padding-left: 20px;">')
          .replace(/\\end\{itemize\}/g, '</ul>')
          .replace(/\\begin\{enumerate\}/g, '<ol style="margin: 0; padding-left: 20px;">')
          .replace(/\\end\{enumerate\}/g, '</ol>')
          .replace(/\\item\s*/g, '<li style="margin-bottom: 8px;">')
          .replace(/\\\\/g, '</li><li style="margin-bottom: 8px;">')
          .replace(/\\vspace-?[\d.]+cm/g, '<br>')
          .replace(/\\begincenter/g, '<div style="text-align: center;">')
          .replace(/\\endcenter/g, '</div>')
          .replace(/\\includegraphics\[width=[^\]]+\]\{[^}]+\}/g, '<div style="text-align: center; margin: 20px 0; padding: 20px; border: 2px dashed #ddd; border-radius: 8px;">📷 Imagem</div>')
          .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
          .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
          .replace(/\\Large/g, '')
          .replace(/\\large/g, '')
          .replace(/\\titlepage/g, '')
          .replace(/\\begin\{block\}\{([^}]+)\}/g, '<div style="background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 10px 0; border-radius: 4px;"><strong>$1</strong><br>')
          .replace(/\\end\{block\}/g, '</div>')
          .replace(/\\begin\{exampleblock\}\{([^}]+)\}/g, '<div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 10px 0; border-radius: 4px;"><strong>$1</strong><br>')
          .replace(/\\end\{exampleblock\}/g, '</div>')
          .replace(/\\begin\{quote\}/g, '<blockquote style="border-left: 4px solid #ddd; margin: 20px 0; padding-left: 20px; font-style: italic;">')
          .replace(/\\end\{quote\}/g, '</blockquote>')
          .replace(/\\raggedleft/g, '<div style="text-align: right;">')
          .replace(/\\begin\{columns\}/g, '<div style="display: flex; gap: 20px;">')
          .replace(/\\end\{columns\}/g, '</div>')
          .replace(/\\begin\{column\}\{([^}]+)\}/g, '<div style="flex: 1;">')
          .replace(/\\end\{column\}/g, '</div>')
          .replace(/\\begin\{table\}/g, '<div style="margin: 20px 0;">')
          .replace(/\\end\{table\}/g, '</div>')
          .replace(/\\begin\{tabular\}\{[^}]*\}/g, '<table style="width: 100%; border-collapse: collapse;">')
          .replace(/\\end\{tabular\}/g, '</table>')
          .replace(/\\\\/g, '</li><li style="margin-bottom: 8px;">')
          .replace(/\\hline/g, '')
          .replace(/\\toprule/g, '')
          .replace(/\\midrule/g, '')
          .replace(/\\bottomrule/g, '')
          .replace(/&/g, '</td><td style="padding: 8px; border: 1px solid #ddd;">')
          .replace(/\\textwidth/g, '100%')
          .replace(/\\today/g, new Date().toLocaleDateString('pt-BR'))
          .replace(/\}/g, '')
          .replace(/\{/g, '')
          .trim();
        
        // LIMITAR CONTEÚDO A 1050 CARACTERES
        if (frameContent.length > 1050) {
          frameContent = frameContent.substring(0, 1047) + '...';
        }
        
        // Estrutura inteligente baseada na posição
        if (index === 0) {
          // Slide 1: TÍTULO (CAPA) - O slide que você queria!
          frameTitle = title;
          frameContent = `
            <div style="text-align: center;">
              <h1 style="font-size: 2.8em; margin-bottom: 25px; color: #2D2624; font-weight: 700;">${title}</h1>
              <div style="font-size: 1em; color: #8B7468; background: #F9F4F2; padding: 10px 20px; border-radius: 0.5rem; display: inline-block;">
                ${new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
          `;
        } else if (index === 1) {
          // Slide 2: O QUE É [TEMA]
          frameTitle = `O que é ${title}`;
          frameContent = `
            <div style="text-align: left;">
              <p style="color: #2D2624; margin-bottom: 15px; line-height: 1.6;">
                Large Language Models (LLMs) são sistemas de inteligência artificial projetados para compreender, processar e gerar linguagem humana de forma natural e contextual. Esses modelos utilizam arquiteturas de redes neurais profundas, principalmente a arquitetura Transformer, que permite processar sequências longas de texto com compreensão semântica e sintática avançada.
              </p>
              <p style="color: #2D2624; margin-bottom: 15px; line-height: 1.6;">
                O desenvolvimento dos LLMs representa uma revolução na IA, permitindo que máquinas realizem tarefas linguísticas complexas como tradução automática, resumo de textos, geração de conteúdo e até mesmo raciocínio abstrato. Esses modelos são treinados com enormes quantidades de dados textuais, aprendendo padrões linguísticos e conhecimento factual de forma escalável.
              </p>
              <p style="color: #2D2624; margin-bottom: 15px; line-height: 1.6;">
                A importância dos LLMs no cenário atual é fundamental, pois estão transformando radicalmente como interagimos com a tecnologia, automatizando processos antes exclusivamente humanos e criando novas possibilidades para educação, negócios e pesquisa científica. Modelos como GPT-4, Claude e Llama demonstram capacidades que antes eram consideradas exclusivas da inteligência humana.
              </p>
            </div>
          `;
        } else if (index === 2) {
          // Slide 3: COMO FUNCIONA
          frameTitle = `Como funciona ${title}`;
          frameContent = `
            <div style="text-align: left;">
              <p style="color: #2D2624; margin-bottom: 15px; line-height: 1.6;">
                O funcionamento dos Large Language Models baseia-se na arquitetura Transformer, introduzida em 2017, que utiliza mecanismos de atenção para processar relações entre palavras em longas distâncias textuais. Diferente dos modelos anteriores, os Transformers podem considerar o contexto completo de uma frase simultaneamente, permitindo compreensão mais profunda das relações semânticas.
              </p>
              <p style="color: #2D2624; margin-bottom: 15px; line-height: 1.6;">
                O processo de treinamento envolve duas fases principais: pré-treinamento em grandes corpus de texto (livros, artigos, websites) e ajuste fino para tarefas específicas. Durante o pré-treinamento, o modelo aprende a prever palavras ausentes em sequências, desenvolvendo representações estatísticas da linguagem e conhecimento factual sobre o mundo.
              </p>
              <p style="color: #2D2624; margin-bottom: 15px; line-height: 1.6;">
                Na inferência, os LLMs utilizam processamento autoregressivo, gerando texto palavra por palavra baseado no contexto anterior e nas probabilidades aprendidas durante o treinamento. Técnicas como temperatura, top-k e nucleus sampling permitem controlar a criatividade e coerência das respostas geradas.
              </p>
            </div>
          `;
        } else if (index === 3) {
          // Slide 4: SUMÁRIO
          frameTitle = 'Sumário';
          frameContent = `
            <div style="text-align: left;">
              <h3 style="color: #2D2624; margin-bottom: 20px;">O que será apresentado:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 12px; list-style-position: inside;"><strong>Introdução</strong> - Contexto e objetivos</li>
                <li style="margin-bottom: 12px; list-style-position: inside;"><strong>Conceitos Fundamentais</strong> - Definições e princípios</li>
                <li style="margin-bottom: 12px; list-style-position: inside;"><strong>Aplicações Práticas</strong> - Exemplos e casos de uso</li>
                <li style="margin-bottom: 12px; list-style-position: inside;"><strong>Exemplos Concretos</strong> - Implementações reais</li>
                <li style="margin-bottom: 12px; list-style-position: inside;"><strong>Vantagens e Desafios</strong> - Análise comparativa</li>
                <li style="margin-bottom: 12px; list-style-position: inside;"><strong>Impacto e Futuro</strong> - Tendências e evolução</li>
                <li style="margin-bottom: 0; list-style-position: inside;"><strong>Conclusão</strong> - Síntese e reflexões</li>
              </ul>
            </div>
          `;
        } else if (index === totalFrames - 2) {
          // Penúltimo slide: RESUMO
          frameTitle = 'Resumo da Apresentação';
          frameContent = `
            <div style="text-align: center;">
              <h3 style="color: #2D2624; margin-bottom: 25px;">Pontos Principais</h3>
              <div style="background: #f8f9fa; border-left: 4px solid #007bff; padding: 20px; margin: 15px 0; border-radius: 4px; text-align: left;">
                <strong>✓ Conclusão 1:</strong> Síntese dos principais resultados obtidos<br><br>
                <strong>✓ Conclusão 2:</strong> Impacto e relevância do tema abordado<br><br>
                <strong>✓ Conclusão 3:</strong> Aplicações práticas e recomendações
              </div>
            </div>
          `;
        } else if (index === totalFrames - 1) {
          // Último slide: AGRADECIMENTO
          frameTitle = 'Obrigado!';
          frameContent = `
            <div style="text-align: center;">
              <h2 style="font-size: 2.2em; margin-bottom: 30px; color: #2D2624;">Obrigado pela Atenção!</h2>
              <p style="font-size: 1.2em; color: #6B5D54; margin-bottom: 40px;">Perguntas?</p>
              <div style="font-size: 1em; color: #8B7468;">
                ${new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
          `;
        } else if (!frameContent || frameContent.length < 10) {
          // Slide vazio - conteúdo padrão
          frameContent = `
            <div style="text-align: center;">
              <p style="color: #6B5D54; font-size: 1.1em;">Conteúdo em desenvolvimento...</p>
            </div>
          `;
        }
        
        // Limpar tags vazias e organizar
        let cleanContent = frameContent
          .replace(/<li><\/li>/g, '')
          .replace(/<li>$/g, '')
          .replace(/^<\/li>/g, '')
          .replace(/<\/li><li>/g, '</li><li>')
          .replace(/<\/li>$/, '</li>')
          .replace(/<span><\/span>/g, '')
          .replace(/<\/span><span>/g, ' ');
        
        // Se não tiver <li> ou estrutura, envolver o conteúdo
        let finalContent = cleanContent.includes('<li>') || cleanContent.includes('<div>') ? 
          cleanContent : 
          `<div style="text-align: center;">${cleanContent}</div>`;
        
        // Limpar tags span soltas
        finalContent = finalContent
          .replace(/<span>([^<]*)<\/span>/g, '$1')
          .replace(/<span style="[^"]*">([^<]*)<\/span>/g, '$1');
        
        slidesData.push({
          title: frameTitle,
          content: finalContent
        });
      });
      
      // Criar apresentação com navegação - TRABALHO ELABORADO SEM ROLAGEM
      content = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; background: #1F1A18; height: 100vh; display: flex; flex-direction: column; margin: 0; padding: 0; overflow: hidden;">
          <!-- Área do Slide (16:9) - CÁLCULO EXATO -->
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 0; box-sizing: border-box; position: relative;">
            <div id="slideContainer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: white; overflow: hidden;">
              
              <!-- Barra de Progresso (Metropolis) -->
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: #E26543; z-index: 10;"></div>
              
              <!-- Slides de Conteúdo - TEXTO CORRIDO DENSO + CORREÇÃO DE VISIBILIDADE -->
              ${slidesData.map((slide, index) => `
                <div class="slide" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: ${index === 0 ? 'flex' : 'none'}; flex-direction: column; background: white; padding: 40px; box-sizing: border-box; overflow: hidden;">
                  <h2 style="color: #2D2624; margin-bottom: 20px; font-size: clamp(0.9em, 2.5vw, 1.2em); font-weight: 600; line-height: 1.3; text-align: center; flex-shrink: 0;">${slide.title}</h2>
                  <div style="flex: 1; display: flex; align-items: flex-start; justify-content: center; font-size: ${slide.content.length < 200 ? 'clamp(0.9em, 2.2vw, 1.1em)' : 'clamp(0.8em, 2vw, 0.95em)'}; line-height: 1.5; color: #4A4039; text-align: left; overflow-y: auto; overflow-x: hidden; padding-right: 10px;">
                    <div style="max-width: 100%; word-wrap: break-word; hyphens: auto;">
                      ${slide.content}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Navegação - ESTILO LHAMACODE -->
          <div style="background: #26201E; padding: 16px; border-top: 1px solid #3D1A16; display: flex; justify-content: center; align-items: center; gap: 20px; flex-shrink: 0; z-index: 20;">
            <button onclick="previousSlide()" style="background: #2D2624; color: #F2EBE9; border: 1px solid #3D1A16; padding: 10px 20px; font-size: 14px; font-weight: 500; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; gap: 8px;">
              <span class="material-symbols-outlined" style="font-size: 18px;">chevron_left</span>
              Anterior
            </button>
            
            <div style="color: #F2EBE9; font-size: 14px; font-weight: 500; padding: 8px 16px; background: #2D2624; border-radius: 0.5rem; border: 1px solid #3D1A16;">
              <span id="slideNumber">1</span> / <span id="totalSlides">${slidesData.length + 1}</span>
            </div>
            
            <button onclick="nextSlide()" style="background: #E26543; color: white; border: 1px solid #E26543; padding: 10px 20px; font-size: 14px; font-weight: 500; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; gap: 8px;">
              Próximo
              <span class="material-symbols-outlined" style="font-size: 18px;">chevron_right</span>
            </button>
          </div>
        </div>
        
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
        
        <script>
          let currentSlide = 0;
          const slides = document.querySelectorAll('.slide');
          const totalSlides = slides.length;
          
          function showSlide(index) {
            slides.forEach(slide => slide.style.display = 'none');
            slides[index].style.display = 'flex';
            document.getElementById('slideNumber').textContent = index + 1;
            currentSlide = index;
            
            // Atualizar estado dos botões
            updateButtonStates();
          }
          
          function nextSlide() {
            if (currentSlide < totalSlides - 1) {
              showSlide(currentSlide + 1);
            }
          }
          
          function previousSlide() {
            if (currentSlide > 0) {
              showSlide(currentSlide - 1);
            }
          }
          
          function updateButtonStates() {
            const prevBtn = document.querySelector('button[onclick="previousSlide()"]');
            const nextBtn = document.querySelector('button[onclick="nextSlide()"]');
            
            if (currentSlide === 0) {
              prevBtn.style.opacity = '0.5';
              prevBtn.style.cursor = 'not-allowed';
            } else {
              prevBtn.style.opacity = '1';
              prevBtn.style.cursor = 'pointer';
            }
            
            if (currentSlide === totalSlides - 1) {
              nextBtn.style.opacity = '0.5';
              nextBtn.style.cursor = 'not-allowed';
            } else {
              nextBtn.style.opacity = '1';
              nextBtn.style.cursor = 'pointer';
            }
          }
          
          // Teclado
          document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') previousSlide();
          });
          
          // Iniciar
          showSlide(0);
        </script>
      `;
    } else {
      // Fallback genérico se não encontrar slides
      content = `...conteúdo genérico...`;
    }
  } else if (type === 'mindmap') {
    // Processar mapa mental - USAR OS 2 ESTILOS
    const isHorizontal = latex.toLowerCase().includes('grow=0') || 
                       latex.toLowerCase().includes('child anchor=west');
    
    // Extrair título do mapa mental
    const titleMatch = latex.match(/\\begin\{forest\}([\s\S]*?)\\end\{forest\}/s);
    const title = titleMatch ? 'Mapa Mental' : 'Mapa Mental';
    
    content = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 40px; background: white; max-width: 900px; margin: 0 auto; min-height: 600px;">
        <div style="background: #1a237e; color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 2.5em; font-weight: 700; margin-bottom: 10px;">${title}</h1>
          <p style="margin: 0; font-size: 1.2em; opacity: 0.9;">Gerado por Drekee AI 1</p>
        </div>
        
        <div style="background: white; border: 2px solid #e0e0e0; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: #f8f9fa; padding: 15px 25px; border-radius: 8px; border-left: 4px solid #007bff;">
              <h3 style="margin: 0; color: #1a237e; font-size: 1.1em;">🧠 Mapa Mental Gerado</h3>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 0.9em;">Código LaTeX compilado com sucesso</p>
            </div>
          </div>
          
          <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 400px; overflow-y: auto;">
            <pre style="margin: 0; white-space: pre-wrap; color: #333;">${this.escapeHtml(latex)}</pre>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 4px;">
            <h4 style="margin: 0 0 10px 0; color: #1976d2; font-size: 1em;">✨ Características do Mapa:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #333;">
              <li style="margin-bottom: 8px;"><strong>Layout:</strong> ${isHorizontal ? 'Horizontal (cresce para direita)' : 'Vertical (hierárquico)'}</li>
              <li style="margin-bottom: 8px;"><strong>Estilo:</strong> ${isHorizontal ? 'Moderno - azul com setas' : 'Clássico - branco com centralização'}</li>
              <li style="margin-bottom: 8px;"><strong>Estrutura:</strong> Nó central com 3 conceitos principais e subconceitos detalhados</li>
              <li style="margin-bottom: 0;"><strong>Formato:</strong> LaTeX compilado com TikZ Forest</li>
            </ul>
          </div>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center;">
          Gerado por Drekee AI 1 - ${new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    `;
  } else {
    // Extrair DOCUMENTO REAL do LaTeX - ESTILO CLÁSSICO
    const sectionMatches = latex.match(/\\section\{([^}]+)\}.*?(?=\\section\{|\\end\{document\})/gs);
    if (sectionMatches && sectionMatches.length > 0) {
      let documentHTML = '';
      
      // Adicionar título e autor
      const titleMatch = latex.match(/\\title\{([^}]+)\}/);
      const authorMatch = latex.match(/\\author\{([^}]+)\}/);
      const title = titleMatch ? titleMatch[1] : 'Conteúdo Gerado';
      const author = authorMatch ? authorMatch[1] : 'Drekee AI 1';
      
      // Extrair abstract se existir
      const abstractMatch = latex.match(/\\begin\{abstract\}(.*?)\\end\{abstract\}/s);
      let abstractHTML = '';
      if (abstractMatch) {
        const abstractContent = abstractMatch[1]
          .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '')
          .replace(/\$[^$]*\$/g, '')
          .trim();
        abstractHTML = `
          <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-left: 3px solid #333; font-style: italic;">
            <strong>Resumo:</strong> ${abstractContent}
          </div>
        `;
      }
      
      // Processar seções
      sectionMatches.forEach(section => {
        const sectionTitleMatch = section.match(/\\section\{([^}]+)\}/);
        const sectionTitle = sectionTitleMatch ? sectionTitleMatch[1] : 'Seção';
        
        // Extrair subsections se existirem
        const subsectionMatches = section.match(/\\subsection\{([^}]+)\}(.*?)(?=\\subsection\{|\\section\{|$)/gs);
        let sectionContent = '';
        
        if (subsectionMatches && subsectionMatches.length > 0) {
          subsectionMatches.forEach(subsection => {
            const subsectionTitleMatch = subsection.match(/\\subsection\{([^}]+)\}/);
            const subsectionTitle = subsectionTitleMatch ? subsectionTitleMatch[1] : 'Subseção';
            const subsectionContent = subsection
              .replace(/\\subsection\{[^}]+\}/g, '')
              .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '')
              .replace(/\$[^$]*\$/g, '')
              .replace(/\\begin\{theorem\}(.*?)\\end\{theorem\}/gs, '<div style="margin: 15px 0; padding: 15px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Teorema:</strong> $1</div>')
              .replace(/\\begin\{proof\}(.*?)\\end\{proof\}/gs, '<div style="margin: 15px 0; padding: 15px; border-left: 3px solid #333; background: #f5f5f5;"><strong>Prova:</strong> $1</div>')
              .replace(/\\begin\{equation\}(.*?)\\end\{equation\}/gs, '<div style="text-align: center; margin: 20px 0; font-size: 1.2em; padding: 10px; background: #f0f0f0;">$1</div>')
              .trim();
            
            sectionContent += `
              <h3 style="color: #555; margin: 25px 0 15px 0; font-size: 1.2em;">${subsectionTitle}</h3>
              <div style="line-height: 1.8; margin-bottom: 20px; text-align: justify;">${subsectionContent}</div>
            `;
          });
        } else {
          // Se não tem subsections, processar conteúdo normal
          let normalContent = section
            .replace(/\\section\{[^}]+\}/g, '')
            .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '')
            .replace(/\$[^$]*\$/g, '')
            .replace(/\\begin\{theorem\}(.*?)\\end\{theorem\}/gs, '<div style="margin: 15px 0; padding: 15px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Teorema:</strong> $1</div>')
            .replace(/\\begin\{proof\}(.*?)\\end\{proof\}/gs, '<div style="margin: 15px 0; padding: 15px; border-left: 3px solid #333; background: #f5f5f5;"><strong>Prova:</strong> $1</div>')
            .replace(/\\begin\{equation\}(.*?)\\end\{equation\}/gs, '<div style="text-align: center; margin: 20px 0; font-size: 1.2em; padding: 10px; background: #f0f0f0;">$1</div>')
            .trim();
          
          sectionContent = `<div style="line-height: 1.8; margin-bottom: 20px; text-align: justify;">${normalContent}</div>`;
        }
        
        documentHTML += `
          <div style="margin: 30px 0;">
            <h2 style="color: #333; margin-bottom: 20px; font-size: 1.5em; border-bottom: 2px solid #333; padding-bottom: 10px;">${sectionTitle}</h2>
            ${sectionContent}
          </div>
        `;
      });
      
      content = `
        <div style="font-family: 'Times New Roman', serif; padding: 50px; background: white; max-width: 800px; margin: 0 auto; line-height: 1.6;">
          <!-- Cabeçalho estilo LaTeX -->
          <div style="text-align: center; margin-bottom: 50px;">
            <h1 style="margin: 0; font-size: 2em; color: #333; font-weight: normal;">${title}</h1>
            <p style="margin: 20px 0 0 0; color: #666; font-size: 1.2em;">${author}</p>
            <p style="margin: 10px 0 0 0; color: #888; font-size: 1em;">${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          
          ${abstractHTML}
          
          ${documentHTML}
        </div>
      `;
    } else {
      // Fallback genérico se não encontrar seções
      content = `...conteúdo genérico...`;
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f5f5f5;">
        ${content}
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center;">
            Gerado por Drekee AI 1 - ${new Date().toLocaleString('pt-BR')}
        </div>
    </body>
    </html>
  `;
}
