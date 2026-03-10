/**
 * Módulo de Renderização de Documentos LaTeX
 * Responsável por converter LaTeX para HTML e renderizar documentos
 */

class DocumentRenderer {
    constructor() {
        this.initialized = false;
    }

    renderDocumentImage(imageUrl, title, messageId, latexCode) {
        console.log('🖼️ [DOCUMENTO] Renderizando imagem compilada do QuickLaTeX...');

        try {
            const documentHTML = this.createDocumentImageHTML([imageUrl], title, messageId);
            this.updateProcessingMessage(messageId, documentHTML);
            this.addGlobalFunctions(title, latexCode, imageUrl);
            this.scrollToBottom();
        } catch (renderError) {
            console.error('🖼️ [DOCUMENTO] Erro ao renderizar imagem:', renderError);
            this.renderDocument(latexCode, messageId);
        }
    }

    renderDocumentImages(imageUrls, title, messageId, latexCode) {
        console.log('🖼️ [DOCUMENTO] Renderizando múltiplas páginas do QuickLaTeX...');

        try {
            const documentHTML = this.createDocumentImageHTML(imageUrls, title, messageId);
            this.updateProcessingMessage(messageId, documentHTML);
            this.addGlobalFunctions(title, latexCode, Array.isArray(imageUrls) ? imageUrls[0] : imageUrls);
            this.scrollToBottom();
        } catch (renderError) {
            console.error('🖼️ [DOCUMENTO] Erro ao renderizar páginas:', renderError);
            this.renderDocument(latexCode, messageId);
        }
    }

    renderTypstPdf(pdfUrl, title, messageId) {
        console.log('[TYPST] Renderizando PDF no chat...');

        try {
            const html = this.createTypstPdfHTML(pdfUrl, title, messageId);
            this.updateProcessingMessage(messageId, html);
            this.scrollToBottom();
        } catch (renderError) {
            console.error('[TYPST] Erro ao renderizar PDF:', renderError);
        }
    }

    renderMarkdownDocument(htmlContent, title, messageId) {
        console.log('[MARKDOWN] Renderizando documento Markdown...');

        try {
            const documentHTML = this.createMarkdownDocumentHTML(htmlContent, title, messageId);
            this.updateProcessingMessage(messageId, documentHTML);
            this.addMarkdownGlobalFunctions(title, htmlContent);
            this.scrollToBottom();
        } catch (renderError) {
            console.error('[MARKDOWN] Erro ao renderizar documento:', renderError);
        }
    }

    async renderPdfJsViewer(pdfData, title, messageId) {
        console.log('[PDF.js] Renderizando viewer...');

        try {
            const html = this.createPdfJsViewerHTML(pdfData, title, messageId);
            this.updateProcessingMessage(messageId, html);
            await this.attachPdfJsViewer(pdfData, messageId);
            this.scrollToBottom();
        } catch (renderError) {
            console.error('[PDF.js] Erro ao renderizar viewer:', renderError);
        }
    }

    /**
     * Renderiza um documento LaTeX como HTML
     */
    renderDocument(latexCode, messageId) {
        console.log('📄 [DOCUMENTO] Renderizando documento...');
        
        try {
            // Extração rápida do título
            const titleMatch = latexCode.match(/\\title\{([^}]+)\}/);
            const title = titleMatch ? titleMatch[1] : 'Documento Gerado';
            
            // Processamento completo do LaTeX
            let htmlContent = this.processLatex(latexCode);
            
            // Criar HTML do documento
            const documentHTML = this.createDocumentHTML(htmlContent, title, messageId);
            
            // Atualizar mensagem imediatamente
            this.updateProcessingMessage(messageId, documentHTML);
            
            // Adicionar funções globais
            this.addGlobalFunctions(title, latexCode);
            
            console.log('📄 [DOCUMENTO] Documento renderizado com sucesso!');
            this.scrollToBottom();
            
        } catch (renderError) {
            console.error('📄 [DOCUMENTO] Erro na renderização:', renderError);
            this.showLatexFallback(latexCode, messageId, renderError.message);
        }
    }

    /**
     * Processa o código LaTeX removendo comandos e convertendo para HTML
     */
    processLatex(latexCode) {
        let bibliographyHTML = '';

        latexCode = latexCode.replace(/\\begin\{thebibliography\}\{[^}]*\}([\s\S]*?)\\end\{thebibliography\}/g, (match, content) => {
            const items = content.match(/\\bibitem\{[^}]+\}([\s\S]*?)(?=\\bibitem\{|$)/g) || [];
            const bibliographyItems = items.map(item => {
                const cleanItem = item
                    .replace(/\\bibitem\{[^}]+\}/, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                return `<li class="mb-2 text-sm leading-relaxed" style="color: black;">${cleanItem}</li>`;
            }).join('');

            bibliographyHTML = bibliographyItems
                ? `
                    <div class="mt-6 rounded-lg border border-gray-200 p-4" style="background: #f8fafc;">
                        <h3 class="text-lg font-semibold mb-3" style="color: black;">Referências</h3>
                        <ol class="list-decimal list-inside space-y-2">
                            ${bibliographyItems}
                        </ol>
                    </div>
                `
                : '';

            return bibliographyHTML ? '\n\n__DOCUMENT_BIBLIOGRAPHY__\n\n' : '';
        });
        // Remover preâmbulo e comandos LaTeX
        let htmlContent = latexCode
            .replace(/\\documentclass[^{]*\{[^}]*\}/g, '')
            .replace(/\\usepackage[^{]*\{[^}]*\}/g, '')
            .replace(/\\author\{[^}]*\}/g, '')
            .replace(/\\date\{[^}]*\}/g, '')
            .replace(/\\title\{[^}]*\}/g, '')
            .replace(/\\maketitle/g, '')
            .replace(/\\begin\{document\}/g, '')
            .replace(/\\end\{document\}/g, '')
            .replace(/\\begin\{abstract\}/g, '')
            .replace(/\\end\{abstract\}/g, '')
            .replace(/\\begin\{titlepage\}/g, '')
            .replace(/\\end\{titlepage\}/g, '')
            .replace(/\\begin\{frame\}(?:\[[^\]]*\])?/g, '')
            .replace(/\\end\{frame\}/g, '')
            .replace(/\\begin\{columns\}/g, '')
            .replace(/\\end\{columns\}/g, '')
            .replace(/\\begin\{column\}\{[^}]+\}/g, '')
            .replace(/\\end\{column\}/g, '')
            .replace(/\\begin\{center\}/g, '')
            .replace(/\\end\{center\}/g, '')
            .replace(/\\begin\{tabular\}[^{]*\{[^}]*\}/g, '')
            .replace(/\\end\{tabular\}/g, '')
            .replace(/\\begin\{table\}\[h\]/g, '')
            .replace(/\\end\{table\}/g, '')
            .replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, '')
            .replace(/\\(?:bigskip|medskip|smallskip|noindent|newpage|clearpage|pagebreak|tableofcontents|fill)\b/g, '')
            .replace(/\\begin\{enumerate\}/g, '<ol class="list-decimal list-inside my-3 space-y-2">')
            .replace(/\\end\{enumerate\}/g, '</ol>')
            .replace(/\\rowcolor[^{]*\{[^}]*\}/g, '')
            .replace(/\\multicolumn[^{]*\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, '')
            .replace(/\\cellcolor[^{]*\{[^}]*\}/g, '')
            .replace(/\\bibitem\{[^}]+\}/g, '')
            .replace(/\\hline/g, '')
            .replace(/\\Huge\{([^}]+)\}/g, '<h1 class="text-3xl font-bold text-center mb-6">$1</h1>')
            .replace(/\\centering/g, '')
            .replace(/\\\\/g, '<br>');
        
        // Conversões para HTML
        htmlContent = htmlContent
            .replace(/\\textbf\{([^}]+)\}/g, '<strong style="color: black;">$1</strong>')
            .replace(/\\textit\{([^}]+)\}/g, '<em style="color: black;">$1</em>')
            .replace(/\\frametitle\{([^}]+)\}/g, '<h2 class="text-xl font-bold mt-6 mb-3" style="color: black;">$1</h2>')
            .replace(/\\section\*?\{([^}]+)\}/g, '<h2 class="text-xl font-bold mt-6 mb-3" style="color: black;">$1</h2>')
            .replace(/\\subsection\*?\{([^}]+)\}/g, '<h3 class="text-lg font-semibold mt-4 mb-2" style="color: black;">$1</h3>')
            .replace(/\\begin\{itemize\}/g, '<ul class="list-disc list-inside my-3 space-y-1">')
            .replace(/\\end\{itemize\}/g, '</ul>')
            .replace(/\\item\s+([^\n]+)/g, '<li class="mb-1" style="color: black;">$1</li>')
            // Processar tabelas
            .replace(/([^&\n]+)&\s*([^&\n]+)&\s*([^&\n]+)\s*\n/g, '<div class="grid grid-cols-3 gap-4 my-2"><div class="font-semibold" style="color: black;">$1</div><div style="color: black;">$2</div><div style="color: black;">$3</div></div>')
            // Processar itens de enumerate
            .replace(/\\item\s+([^\n]+)/g, '<li class="mb-2" style="color: black;">$1</li>')
            .replace(/\\&/g, '&')
            .replace(/\\%/g, '%')
            .replace(/\\$/g, '$')
            .replace(/\\_/g, '_')
            .replace(/\\^/g, '^')
            .replace(/\\#/g, '#')
            .replace(/\\{/g, '{')
            .replace(/\\}/g, '}');
        
        // Processar bibliografia
        htmlContent = htmlContent.replace(/\\begin\{thebibliography\}\{[^}]*\}([\s\S]*?)\\end\{thebibliography\}/g, (match, content) => {
            const items = content.match(/\\bibitem\{[^}]+\}([^\n]+)/g) || [];
            const bibliographyItems = items.map(item => {
                const cleanItem = item.replace(/\\bibitem\{[^}]+\}/, '').trim();
                return `<li class="mb-2 text-sm text-gray-600 dark:text-gray-400">${cleanItem}</li>`;
            }).join('');
            return `
                <div class="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h3 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Referências</h3>
                    <ol class="list-decimal list-inside space-y-2">
                        ${bibliographyItems}
                    </ol>
                </div>
            `;
        });
        
        // Limpar quebras de linha e formatar parágrafos
        htmlContent = htmlContent
            .replace(/\n\s*\n/g, '</p><p class="mb-4" style="color: black;">')
            .replace(/^\s*/, '<p class="mb-4" style="color: black;">')
            .replace(/\s*$/, '</p>');
        
        // Remover parágrafos vazios
        htmlContent = htmlContent.replace(/<p class="mb-4[^>]*">\s*<\/p>/g, '');
        htmlContent = htmlContent
            .replace(/^(?:\s|<br\s*\/?>|<\/?p[^>]*>)+/i, '')
            .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')
            .trim();
        htmlContent = htmlContent
            .replace(/<h2 class="text-xl font-bold mt-6 mb-3" style="color: black;">/i, '<h2 class="text-xl font-bold mt-0 mb-3" style="color: black; margin-top: 0;">')
            .replace(/<h3 class="text-lg font-semibold mt-4 mb-2" style="color: black;">/i, '<h3 class="text-lg font-semibold mt-0 mb-2" style="color: black; margin-top: 0;">')
            .replace(/<p class="mb-4" style="color: black;">/i, '<p class="mb-4 mt-0" style="color: black; margin-top: 0;">');
        htmlContent = htmlContent.replace(/<p class="mb-4" style="color: black;">\s*__DOCUMENT_BIBLIOGRAPHY__\s*<\/p>/g, bibliographyHTML);
        htmlContent = htmlContent.replace(/<p class="mb-4 mt-1" style="color: black;">\s*__DOCUMENT_BIBLIOGRAPHY__\s*<\/p>/g, bibliographyHTML);
        htmlContent = htmlContent.replace(/__DOCUMENT_BIBLIOGRAPHY__/g, bibliographyHTML);
        
        return htmlContent;
    }

    /**
     * Cria o HTML completo do documento
     */
    createDocumentHTML(htmlContent, title, messageId) {
        // Extrair e formatar título do documento
        const formattedTitle = title.replace(/\\textbf\{([^}]+)\}/g, '$1')
                                     .replace(/\\textit\{([^}]+)\}/g, '$1');
        
        return `
            <div id="document-${messageId}" class="document-viewer rounded-xl shadow-lg border overflow-hidden" style="background: linear-gradient(180deg, #08152f 0%, #0b1d3b 100%); border-color: rgba(96, 165, 250, 0.18);">
                <div class="document-pages p-3" style="background: linear-gradient(180deg, rgba(8, 21, 47, 0.96) 0%, rgba(11, 29, 59, 0.92) 100%);">
                    <!-- Página 1 -->
                    <div class="bg-white min-h-[842px] px-6 pt-2 pb-6 rounded-t-lg" style="background-color: white; color: black;">
                        <!-- Título do Documento -->
                        <div class="text-center mb-0">
                            <h1 class="text-3xl font-bold leading-tight m-0" style="color: black; margin: 0;">${formattedTitle}</h1>
                        </div>
                        
                        <!-- Conteúdo -->
                        <div class="space-y-1" style="margin-top: -6px;">
                            ${htmlContent}
                        </div>
                    </div>
                </div>
                
                <!-- Botões -->
                <div class="px-3 py-1.5 border-t" style="background: rgba(15, 23, 42, 0.92); border-color: rgba(96, 165, 250, 0.14);">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1 text-[11px]" style="color: rgba(191, 219, 254, 0.72);">
                            <span class="material-icons-outlined text-xs">description</span>
                            <span>Documento</span>
                        </div>
                        <div class="flex gap-1.5">
                            <button onclick="window.printDocument('${messageId}')" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #2563eb;">
                                <span class="material-icons-outlined text-xs">print</span>
                                Imprimir
                            </button>
                            <button onclick="navigator.clipboard.writeText(\`${title.replace(/`/g, '\\`')}\`); alert('Título copiado!');" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #16a34a;">
                                <span class="material-icons-outlined text-xs">content_copy</span>
                                Copiar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createDocumentImageHTML(imageUrls, title, messageId) {
        const safeTitle = title.replace(/\\textbf\{([^}]+)\}/g, '$1')
                               .replace(/\\textit\{([^}]+)\}/g, '$1');
        const pages = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
        const primaryImageUrl = pages[0] || '';
        const pageHtml = pages.map((imageUrl, index) => `
            <div style="max-width: 760px; margin: 0 auto ${index < pages.length - 1 ? '16px' : '0'};">
                <div class="rounded-lg overflow-hidden shadow-sm" style="background: #ffffff; aspect-ratio: 1 / 1.414; display: flex; align-items: flex-start; justify-content: center; padding: 8px;">
                    <img src="${imageUrl}" alt="${safeTitle} - página ${index + 1}" style="display: block; width: 100%; height: auto; max-width: 100%; background: white; object-fit: contain;">
                </div>
                <div style="text-align: center; color: rgba(191, 219, 254, 0.72); font-size: 11px; margin-top: 6px;">Página ${index + 1} de ${pages.length}</div>
            </div>
        `).join('');

        return `
            <div id="document-image-${messageId}" class="document-viewer rounded-xl shadow-lg border overflow-hidden" style="background: linear-gradient(180deg, #08152f 0%, #0b1d3b 100%); border-color: rgba(96, 165, 250, 0.18);">
                <div class="document-pages p-3" style="background: linear-gradient(180deg, rgba(8, 21, 47, 0.96) 0%, rgba(11, 29, 59, 0.92) 100%);">
                    ${pageHtml}
                </div>

                <div class="px-3 py-1.5 border-t" style="background: rgba(15, 23, 42, 0.92); border-color: rgba(96, 165, 250, 0.14);">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1 text-[11px]" style="color: rgba(191, 219, 254, 0.72);">
                            <span class="material-icons-outlined text-xs">image</span>
                            <span>QuickLaTeX</span>
                        </div>
                        <div class="flex gap-1.5">
                            <button onclick="window.open('${primaryImageUrl}', '_blank')" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #2563eb;">
                                <span class="material-icons-outlined text-xs">open_in_new</span>
                                Abrir
                            </button>
                            <button onclick="window.printDocument('${messageId}')" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #0f766e;">
                                <span class="material-icons-outlined text-xs">print</span>
                                Imprimir
                            </button>
                            <button onclick="navigator.clipboard.writeText(\`${title.replace(/`/g, '\\`')}\`); alert('Título copiado!');" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #16a34a;">
                                <span class="material-icons-outlined text-xs">content_copy</span>
                                Copiar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createTypstPdfHTML(pdfUrl, title, messageId) {
        const safeTitle = title.replace(/\\textbf\{([^}]+)\}/g, '$1')
                               .replace(/\\textit\{([^}]+)\}/g, '$1');

        return `
            <div id="typst-pdf-${messageId}" class="document-viewer rounded-xl shadow-lg border overflow-hidden" style="background: linear-gradient(180deg, #08152f 0%, #0b1d3b 100%); border-color: rgba(96, 165, 250, 0.18);">
                <div class="document-pages p-3" style="background: linear-gradient(180deg, rgba(8, 21, 47, 0.96) 0%, rgba(11, 29, 59, 0.92) 100%);">
                    <div class="rounded-lg overflow-hidden" style="background: #ffffff;">
                        <object data="${pdfUrl}" type="application/pdf" style="width: 100%; height: 80vh; display: block;">
                            <p style="padding: 16px;">PDF não pôde ser exibido. <a href="${pdfUrl}" target="_blank">Abrir PDF</a></p>
                        </object>
                    </div>
                </div>

                <div class="px-3 py-1.5 border-t" style="background: rgba(15, 23, 42, 0.92); border-color: rgba(96, 165, 250, 0.14);">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1 text-[11px]" style="color: rgba(191, 219, 254, 0.72);">
                            <span class="material-icons-outlined text-xs">picture_as_pdf</span>
                            <span>Typst</span>
                        </div>
                        <div class="flex gap-1.5">
                            <button onclick="window.open('${pdfUrl}', '_blank')" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #2563eb;">
                                <span class="material-icons-outlined text-xs">open_in_new</span>
                                Abrir
                            </button>
                            <button onclick="window.open('${pdfUrl}', '_blank')" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #16a34a;">
                                <span class="material-icons-outlined text-xs">download</span>
                                Baixar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createMarkdownDocumentHTML(htmlContent, title, messageId) {
        const safeTitle = title.replace(/\\textbf\{([^}]+)\}/g, '$1')
                               .replace(/\\textit\{([^}]+)\}/g, '$1');

        return `
            <div id="markdown-doc-${messageId}" class="document-viewer rounded-xl shadow-lg border overflow-hidden" style="background: linear-gradient(180deg, #08152f 0%, #0b1d3b 100%); border-color: rgba(96, 165, 250, 0.18);">
                <div class="document-pages p-3" style="background: linear-gradient(180deg, rgba(8, 21, 47, 0.96) 0%, rgba(11, 29, 59, 0.92) 100%);">
                    <div class="rounded-lg overflow-hidden shadow-sm" style="background: #ffffff; max-width: 760px; margin: 0 auto;">
                        <div class="px-8 pt-6 pb-8" style="background: #ffffff; color: #0f172a; min-height: 842px;">
                            <style>
                                #markdown-doc-${messageId} .markdown-body h2 { font-size: 1.4rem; margin-top: 1.4rem; margin-bottom: 0.6rem; }
                                #markdown-doc-${messageId} .markdown-body h3 { font-size: 1.1rem; margin-top: 1.1rem; margin-bottom: 0.4rem; }
                                #markdown-doc-${messageId} .markdown-body p { margin: 0.6rem 0; line-height: 1.6; }
                                #markdown-doc-${messageId} .markdown-body ul { list-style: disc; padding-left: 1.2rem; margin: 0.6rem 0; }
                                #markdown-doc-${messageId} .markdown-body ol { list-style: decimal; padding-left: 1.2rem; margin: 0.6rem 0; }
                                #markdown-doc-${messageId} .markdown-body blockquote { border-left: 4px solid #93c5fd; padding-left: 0.8rem; color: #334155; background: #f8fafc; margin: 0.8rem 0; }
                                #markdown-doc-${messageId} .markdown-body table { width: 100%; border-collapse: collapse; margin: 0.8rem 0; }
                                #markdown-doc-${messageId} .markdown-body th, #markdown-doc-${messageId} .markdown-body td { border: 1px solid #e2e8f0; padding: 6px 8px; }
                                #markdown-doc-${messageId} .markdown-body th { background: #f1f5f9; text-align: left; }
                                #markdown-doc-${messageId} .markdown-body strong { color: #0f172a; }
                                #markdown-doc-${messageId} .markdown-body u { text-decoration: underline; }
                            </style>
                            <div class="text-center mb-4">
                                <h1 class="text-3xl font-bold leading-tight m-0" style="color: #0f172a; margin: 0;">${safeTitle}</h1>
                            </div>
                            <div class="markdown-body prose max-w-none" style="color: #0f172a;">
                                ${htmlContent}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="px-3 py-1.5 border-t" style="background: rgba(15, 23, 42, 0.92); border-color: rgba(96, 165, 250, 0.14);">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1 text-[11px]" style="color: rgba(191, 219, 254, 0.72);">
                            <span class="material-icons-outlined text-xs">description</span>
                            <span>Markdown</span>
                        </div>
                        <div class="flex gap-1.5">
                            <button onclick="window.printMarkdownDocument('${messageId}', '${safeTitle.replace(/`/g, '\\`')}')" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #2563eb;">
                                <span class="material-icons-outlined text-xs">print</span>
                                Imprimir
                            </button>
                            <button onclick="navigator.clipboard.writeText(\`${safeTitle.replace(/`/g, '\\`')}\`); alert('Título copiado!');" 
                                    class="flex items-center gap-1 px-2 py-0.5 text-white rounded-md transition-colors text-xs"
                                    style="background: #16a34a;">
                                <span class="material-icons-outlined text-xs">content_copy</span>
                                Copiar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createPdfJsViewerHTML(pdfData, title, messageId) {
        const safeTitle = title.replace(/\\textbf\{([^}]+)\}/g, '$1')
                               .replace(/\\textit\{([^}]+)\}/g, '$1');
        const downloadUrl = typeof pdfData === 'string' ? pdfData : (pdfData.blobUrl || pdfData.dataUrl || '');

        return `
            <div id="pdfjs-doc-${messageId}" class="document-viewer rounded-xl shadow-lg border overflow-hidden" style="background: linear-gradient(180deg, #08152f 0%, #0b1d3b 100%); border-color: rgba(96, 165, 250, 0.18);">
                <div class="document-pages p-3" style="background: linear-gradient(180deg, rgba(8, 21, 47, 0.96) 0%, rgba(11, 29, 59, 0.92) 100%);">
                    <div class="rounded-lg overflow-hidden shadow-sm" style="background: #ffffff;">
                        <iframe id="pdfjs-frame-${messageId}" style="width: 100%; height: 80vh; border: none; display: block;"></iframe>
                    </div>
                </div>
            </div>
        `;
    }

    async attachPdfJsViewer(pdfData, messageId) {
        const iframe = document.getElementById(`pdfjs-frame-${messageId}`);
        if (!iframe) return;

        const fileUrl = typeof pdfData === 'string' ? pdfData : (pdfData.blobUrl || pdfData.dataUrl || '');
        if (!fileUrl) return;

        const template = await this.getPdfJsViewerTemplate();
        if (!template) {
            iframe.srcdoc = `
                <html>
                    <body style="font-family: sans-serif; padding: 16px;">
                        <p>Não foi possível carregar o visualizador PDF.js.</p>
                        <p><a href="${fileUrl}" target="_blank">Abrir PDF em nova aba</a></p>
                    </body>
                </html>
            `;
            return;
        }

        const baseTag = '<base href="https://mozilla.github.io/pdf.js/web/">';
        let html = template;

        if (!/<base\s+/i.test(html)) {
            html = html.replace(/<head>/i, `<head>${baseTag}`);
        }

        const injection = `
<script>
  window.addEventListener('load', function () {
    try {
      if (window.PDFViewerApplication) {
        window.PDFViewerApplication.open({ url: ${JSON.stringify(fileUrl)} });
      }
    } catch (err) {}
  });
</script>`;
        html = html.replace(/<\/body>/i, `${injection}</body>`);

        iframe.setAttribute('srcdoc', html);
    }

    async getPdfJsViewerTemplate() {
        if (this._pdfJsTemplate) {
            return this._pdfJsTemplate;
        }
        try {
            const response = await fetch('/api/pdfjs-viewer');
            if (!response.ok) {
                throw new Error(`Falha ao buscar viewer: ${response.status}`);
            }
            const html = await response.text();
            this._pdfJsTemplate = html;
            return html;
        } catch (error) {
            console.warn('[PDF.js] Falha ao carregar template viewer:', error.message);
            return null;
        }
    }

    addMarkdownGlobalFunctions(title, htmlContent) {
        window.printMarkdownDocument = (messageId, docTitle) => {
            const printWindow = window.open('', 'width=800,height=600');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${docTitle || title}</title>
                        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
                        <style>
                            body { font-family: "Times New Roman", serif; line-height: 1.6; margin: 24px; color: #0f172a; }
                            h1, h2, h3, h4 { color: #0f172a; }
                            .prose { max-width: 760px; margin: 0 auto; }
                        </style>
                    </head>
                    <body>
                        <h1>${docTitle || title}</h1>
                        <div class="prose">${htmlContent}</div>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        };
    }

    /**
     * Adiciona funções globais para download e impressão
     */
    addGlobalFunctions(title, latexCode, imageUrl = null) {
        window.downloadDocument = (msgId, filename) => {
            const blob = new Blob([latexCode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        };
        
        window.printDocument = (msgId) => {
            const printWindow = window.open('', 'width=800,height=600');
            const printableContent = imageUrl
                ? `<img src="${imageUrl}" style="max-width: 100%; height: auto;" alt="${title}">`
                : `<h1>${title}</h1><div class="content">${this.processLatex(latexCode)}</div>`;
            printWindow.document.write(`
                <html>
                    <head><title>${title}</title>
                        <style>
                            body { font-family: serif; line-height: 1.6; margin: 20px; }
                            h1 { color: #333; }
                            h2 { color: #444; margin-top: 20px; }
                            h3 { color: #555; margin-top: 15px; }
                            strong { font-weight: bold; }
                            em { font-style: italic; }
                            ul { margin-left: 20px; }
                            li { margin-bottom: 5px; }
                        </style>
                    </head>
                    <body>
                        ${printableContent}
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        };
    }

    /**
     * Atualiza a mensagem de processamento
     */
    updateProcessingMessage(messageId, text) {
        let messageElement = document.getElementById(`responseText_${messageId}`);
        
        if (!messageElement) {
            const allMessages = document.querySelectorAll('[id^="responseText_"]');
            if (allMessages.length > 0) {
                messageElement = allMessages[allMessages.length - 1];
            }
        }
        
        if (messageElement) {
            if (text.includes('<div') && text.includes('</div>')) {
                messageElement.innerHTML = text;
            } else {
                messageElement.innerHTML = `
                    <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <div class="flex gap-1">
                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                        </div>
                        <span class="text-sm font-medium">${text}</span>
                    </div>
                `;
            }
            console.log('✅ Mensagem de processamento atualizada:', text);
        } else {
            console.warn('❌ Elemento de mensagem não encontrado para atualizar:', messageId);
        }
    }

    /**
     * Rola para o final da página
     */
    scrollToBottom() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    /**
     * Mostra fallback de erro
     */
    showLatexFallback(latexCode, messageId, errorMessage) {
        console.log('📄 [DOCUMENTO] Mostrando fallback LaTeX...');
        
        const fallbackHTML = '<div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">' +
            '<div class="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">' +
                '<div class="flex items-center gap-3">' +
                    '<span class="material-icons-outlined text-2xl">warning</span>' +
                    '<div>' +
                        '<h1 class="text-xl font-bold">Documento LaTeX (Fallback)</h1>' +
                        '<p class="text-orange-100 text-sm">Ocorreu um erro na renderização, mas o código foi gerado</p>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            
            '<div class="p-6">' +
                '<div class="mb-4">' +
                    '<h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Código LaTeX Gerado:</h3>' +
                    '<div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto">' +
                        '<pre class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">' + 
                            this.escapeHtml(latexCode) + 
                        '</pre>' +
                    '</div>' +
                '</div>' +
                
                '<div class="mb-4">' +
                    '<h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Informações:</h3>' +
                    '<ul class="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">' +
                        '<li>O código LaTeX foi gerado com sucesso pela IA</li>' +
                        '<li>Você pode copiar e compilar em um editor LaTeX</li>' +
                        '<li>Use Overleaf, TeXstudio, ou outro compilador LaTeX</li>' +
                        '<li>Erro: ' + this.escapeHtml(errorMessage) + '</li>' +
                    '</ul>' +
                '</div>' +
                
                '<div class="flex gap-2">' +
                    '<button onclick="navigator.clipboard.writeText(\'' + latexCode.replace(/'/g, "\\'").replace(/\n/g, '\\n') + '\'); alert(\'Código copiado!\');" ' +
                            'class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">' +
                        '<span class="material-icons-outlined">content_copy</span>' +
                        'Copiar Código' +
                    '</button>' +
                    '<button onclick="window.downloadLatexCode(\'' + latexCode.replace(/'/g, "\\'").replace(/\n/g, '\\n') + '\');" ' +
                            'class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">' +
                        '<span class="material-icons-outlined">download</span>' +
                        'Baixar .tex' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
        
        // Adicionar função de download global
        window.downloadLatexCode = function(code) {
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'documento.tex';
            a.click();
            URL.revokeObjectURL(url);
        };
        
        this.updateProcessingMessage(messageId, fallbackHTML);
        this.scrollToBottom();
    }

    /**
     * Escapa caracteres HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Exportar para uso global
window.documentRenderer = new DocumentRenderer();
