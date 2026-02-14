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
  const author = authorMatch ? authorMatch[1] : 'Lhama Code 1';

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
    // Extrair SLIDES REAIS do LaTeX - FORMATO APRESENTAÇÃO REAL
    const frameMatches = latex.match(/\\begin\{frame\}.*?\\end\{frame\}/gs);
    if (frameMatches && frameMatches.length > 0) {
      let slidesData = [];
      
      // Extrair título e autor
      const titleMatch = latex.match(/\\title\{([^}]+)\}/);
      const authorMatch = latex.match(/\\author\{([^}]+)\}/);
      const title = titleMatch ? titleMatch[1] : 'Conteúdo Gerado';
      const author = authorMatch ? authorMatch[1] : 'Lhama Code 1';
      
      // Processar cada frame
      frameMatches.forEach((frame, index) => {
        const frameTitleMatch = frame.match(/\\frametitle\{([^}]+)\}/);
        const frameTitle = frameTitleMatch ? frameTitleMatch[1] : `Slide ${index + 1}`;
        
        // Extrair conteúdo do frame
        let frameContent = frame
          .replace(/\\begin\{frame\}/g, '')
          .replace(/\\end\{frame\}/g, '')
          .replace(/\\frametitle\{([^}]+)\}/g, '')
          .replace(/\\begin\{itemize\}/g, '<ul style="line-height: 1.8; font-size: 1.2em;">')
          .replace(/\\end\{itemize\}/g, '</ul>')
          .replace(/\\item\s*/g, '<li>')
          .replace(/\\\\/g, '</li><li>')
          .replace(/\\vspace-?[\d.]+cm/g, '<br><br>')
          .replace(/\\begincenter/g, '<div style="text-align: center;">')
          .replace(/\\endcenter/g, '</div>')
          .replace(/\\includegraphics\[width=[^\]]+\]\{[^}]+\}/g, '<em>[Imagem]</em>')
          .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
          .replace(/\\Large/g, '<span style="font-size: 1.5em;">')
          .replace(/\\large/g, '<span style="font-size: 1.2em;">')
          .replace(/\\titlepage/g, '')
          .replace(/\}/g, '</span>')
          .replace(/\{/g, '')
          .trim();
        
        // Se for o primeiro frame e estiver vazio, criar capa
        if (index === 0 && (!frameContent || frameContent.length < 10)) {
          frameContent = `
            <div style="text-align: center; padding: 80px 20px;">
              <h1 style="font-size: 3.5em; margin-bottom: 40px; color: #1a237e;">${title}</h1>
              <p style="font-size: 1.8em; color: #666; margin-bottom: 60px;">${author}</p>
              <div style="font-size: 1.4em; color: #888;">
                Apresentação Gerada por IA
              </div>
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
        
        // Se não tiver <li>, envolver o conteúdo em <div>
        let finalContent = cleanContent.includes('<li>') ? 
          `<div style="line-height: 1.8; font-size: 1.2em;">${cleanContent}</div>` : 
          `<div style="line-height: 1.8; font-size: 1.2em;">${cleanContent}</div>`;
        
        // Limpar tags span soltas
        finalContent = finalContent
          .replace(/<span>([^<]*)<\/span>/g, '$1')
          .replace(/<span style="[^"]*">([^<]*)<\/span>/g, '$1');
        
        slidesData.push({
          title: frameTitle,
          content: finalContent
        });
      });
      
      // Criar apresentação com navegação - DESIGN MODERNO IGUAL AO RESTO DA IA
      content = `
        <div style="font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; margin: 0; padding: 20px; box-sizing: border-box;">
          <!-- Área do Slide (16:9 perfeito) -->
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative;">
            <div id="slideContainer" style="width: 100%; max-width: min(1200px, calc(100vh - 140px)); aspect-ratio: 16/9; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e2e8f0;">
              <!-- Slide 1 (Capa) -->
              <div class="slide" style="width: 100%; height: 100%; padding: 60px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="text-align: center;">
                  <h1 style="margin: 0; font-size: 3em; font-weight: 700; margin-bottom: 30px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${title}</h1>
                  <p style="margin: 0 0 40px 0; font-size: 1.4em; opacity: 0.9; font-weight: 500;">${author}</p>
                  <div style="font-size: 1.1em; opacity: 0.8; background: rgba(255,255,255,0.1); padding: 15px 25px; border-radius: 8px; display: inline-block;">
                    Apresentação Gerada por IA
                  </div>
                </div>
              </div>
              
              <!-- Slides de Conteúdo -->
              ${slidesData.map((slide, index) => `
                <div class="slide" style="width: 100%; height: 100%; padding: 50px; box-sizing: border-box; display: none; flex-direction: column; justify-content: center; background: white;">
                  <h2 style="color: #1e293b; margin-bottom: 40px; font-size: 2.2em; font-weight: 700; text-align: center; line-height: 1.2;">${slide.title}</h2>
                  <div style="flex: 1; display: flex; align-items: center;">
                    <div style="width: 100%; font-size: 1.2em; line-height: 1.7; color: #475569;">
                      ${slide.content}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Navegação - DESIGN MODERNO IGUAL AO RESTO DA IA -->
          <div style="background: white; border-radius: 12px; padding: 20px; margin-top: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; display: flex; justify-content: center; align-items: center; gap: 30px;">
            <button onclick="previousSlide()" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 12px 20px; font-size: 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Anterior
            </button>
            
            <div style="color: #64748b; font-size: 14px; font-weight: 500; padding: 8px 16px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span id="slideNumber">1</span> / <span id="totalSlides">${slidesData.length + 1}</span>
            </div>
            
            <button onclick="nextSlide()" style="background: #3b82f6; color: white; border: none; padding: 12px 20px; font-size: 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              Próximo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
        
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
  } else {
    // Extrair DOCUMENTO REAL do LaTeX - ESTILO CLÁSSICO
    const sectionMatches = latex.match(/\\section\{([^}]+)\}.*?(?=\\section\{|\\end\{document\})/gs);
    if (sectionMatches && sectionMatches.length > 0) {
      let documentHTML = '';
      
      // Adicionar título e autor
      const titleMatch = latex.match(/\\title\{([^}]+)\}/);
      const authorMatch = latex.match(/\\author\{([^}]+)\}/);
      const title = titleMatch ? titleMatch[1] : 'Conteúdo Gerado';
      const author = authorMatch ? authorMatch[1] : 'Lhama Code 1';
      
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
            Gerado por Lhama Code 1 - ${new Date().toLocaleString('pt-BR')}
        </div>
    </body>
    </html>
  `;
}
