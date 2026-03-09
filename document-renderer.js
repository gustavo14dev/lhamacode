/**
 * Módulo de Renderização de Documentos LaTeX
 * Responsável por converter LaTeX para HTML e renderizar documentos
 */

class DocumentRenderer {
    constructor() {
        this.initialized = false;
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
            .replace(/\\begin\{thebibliography\}[^}]*\}/g, '')
            .replace(/\\end\{thebibliography\}/g, '')
            .replace(/\\begin\{titlepage\}/g, '')
            .replace(/\\end\{titlepage\}/g, '')
            .replace(/\\begin\{tabular\}[^{]*\{[^}]*\}/g, '')
            .replace(/\\end\{tabular\}/g, '')
            .replace(/\\begin\{table\}\[h\]/g, '')
            .replace(/\\end\{table\}/g, '')
            .replace(/\\begin\{enumerate\}/g, '<ol class="list-decimal list-inside my-3 space-y-2">')
            .replace(/\\end\{enumerate\}/g, '</ol>')
            .replace(/\\rowcolor[^{]*\{[^}]*\}/g, '')
            .replace(/\\multicolumn[^{]*\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, '')
            .replace(/\\cellcolor[^{]*\{[^}]*\}/g, '')
            .replace(/\\hline/g, '')
            .replace(/\\Huge\{([^}]+)\}/g, '<h1 class="text-3xl font-bold text-center mb-6">$1</h1>')
            .replace(/\\centering/g, '')
            .replace(/\\\\/g, '<br>');
        
        // Conversões para HTML
        htmlContent = htmlContent
            .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
            .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
            .replace(/\\section\*?\{([^}]+)\}/g, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-800 dark:text-gray-200">$1</h2>')
            .replace(/\\subsection\*?\{([^}]+)\}/g, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-300">$1</h3>')
            .replace(/\\begin\{itemize\}/g, '<ul class="list-disc list-inside my-3 space-y-1">')
            .replace(/\\end\{itemize\}/g, '</ul>')
            .replace(/\\item\s+([^\n]+)/g, '<li class="mb-1">$1</li>')
            // Processar tabelas
            .replace(/([^&\n]+)&\s*([^&\n]+)&\s*([^&\n]+)\s*\n/g, '<div class="grid grid-cols-3 gap-4 my-2"><div class="font-semibold">$1</div><div>$2</div><div>$3</div></div>')
            // Processar itens de enumerate
            .replace(/\\item\s+([^\n]+)/g, '<li class="mb-2">$1</li>')
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
            .replace(/\n\s*\n/g, '</p><p class="mb-4 text-gray-700 dark:text-gray-300">')
            .replace(/^\s*/, '<p class="mb-4 text-gray-700 dark:text-gray-300">')
            .replace(/\s*$/, '</p>');
        
        // Remover parágrafos vazios
        htmlContent = htmlContent.replace(/<p class="mb-4[^>]*">\s*<\/p>/g, '');
        
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
            <div id="document-${messageId}" class="document-viewer bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div class="document-pages p-0">
                    <!-- Página 1 -->
                    <div class="bg-white dark:bg-gray-800 min-h-[842px] p-12">
                        <!-- Título do Documento -->
                        <div class="text-center mb-8">
                            <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200">${formattedTitle}</h1>
                        </div>
                        
                        <!-- Conteúdo -->
                        <div class="space-y-6">
                            ${htmlContent}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Adiciona funções globais para download e impressão
     */
    addGlobalFunctions(title, latexCode) {
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
                        <h1>${title}</h1>
                        <div class="content">${this.processLatex(latexCode)}</div>
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
