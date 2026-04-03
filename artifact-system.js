export default class ArtifactSystem {
    constructor(ui) {
        this.ui = ui;
    }

    async decideIfNeedsArtifact(userMessage, webData, relevantContext) {
        try {
            const systemPrompt = `Você é um decisor binário. Responda APENAS "SIM" ou "NÃO".
            Decida se o usuário solicitou algo que se beneficiaria de um ARTIFACT (elemento visual, código, tabela, documento rico, linha do tempo).
            - Responda SIM se: for código, tabela, resumo de estudo, lista complexa, fluxograma, componente interativo.
            - Responda NÃO se: for apenas conversa, saudação, pergunta simples de texto.`;
            
            const response = await this.ui.agent.callGroqAPI('Meta-Llama-3.1-8B-Instruct', [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Mensagem: ${userMessage}` }
            ]);
            
            const decision = (response || '').trim().toUpperCase();
            console.log('🤖 [ARTIFACT-DECISION] Decisão:', decision);
            return decision.includes('SIM');
        } catch (e) {
            console.error('❌ [ARTIFACT-DECISION] Erro na decisão:', e);
            return false;
        }
    }

    extractArtifact(text) {
        if (!text) return null;
        const artifactRegex = /<artifact\s+type=["\']([^"\']+)["\'](?:\s+title=["\']([^"\']+)["\'])?[^>]*>([\s\S]*?)<\/artifact>/i;
        const match = text.match(artifactRegex);
        if (match) {
            return {
                type: match[1],
                title: match[2] || (match[1] === 'code' ? 'Código' : 'Documento'),
                content: match[3].trim()
            };
        }
        return null;
    }

        async renderArtifact(responseId, artifact) {
        const responseElement = document.getElementById(responseId);
        if (!responseElement) return;
        
        const container = document.createElement('div');
        container.className = 'claude-artifact-container animate-artifact my-4 overflow-hidden rounded-xl border border-white/10 bg-[#1a1b26] shadow-2xl text-left';
        
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between bg-[#13141c] px-4 py-2 border-b border-white/5';
        
        let icon = 'description';
        if (artifact.type === 'code') icon = 'code';
        if (artifact.type === 'web') icon = 'language';
        if (artifact.type === 'mermaid') icon = 'schema';

        header.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="material-icons-outlined text-blue-400 text-[18px]">${icon}</span>
                <span class="text-[13px] font-medium text-gray-300">${artifact.title}</span>
            </div>
            <div class="flex items-center gap-2">
                <button class="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors" title="Copiar">
                    <span class="material-icons-outlined text-[16px]">content_copy</span>
                </button>
            </div>
        `;

        const contentArea = document.createElement('div');
        contentArea.className = 'artifact-content-area overflow-hidden text-[14px] text-gray-200 leading-relaxed';
        
        if (artifact.type === 'web') {
            contentArea.className += ' h-[600px] bg-white';
            const iframe = document.createElement('iframe');
            iframe.className = 'w-full h-full border-none';
            iframe.sandbox = 'allow-scripts allow-forms allow-popups allow-modals';
            contentArea.appendChild(iframe);
            
            // Injetar o conteúdo no iframe
            setTimeout(() => {
                const doc = iframe.contentWindow.document;
                doc.open();
                doc.write(artifact.content);
                doc.close();
            }, 10);
        } else if (artifact.type === 'code') {
            contentArea.className += ' p-4 max-h-[500px] overflow-auto';
            contentArea.innerHTML = `<pre class="font-mono bg-transparent p-0 m-0 whitespace-pre-wrap break-all"><code>${this.escapeHtml(artifact.content)}</code></pre>`;
        } else {
            contentArea.className += ' p-4 max-h-[500px] overflow-auto';
            contentArea.innerHTML = this.formatDocumentContent(artifact.content);
        }

        container.appendChild(header);
        container.appendChild(contentArea);
        
        const copyBtn = header.querySelector('button');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(artifact.content);
            const iconSpan = copyBtn.querySelector('span');
            iconSpan.textContent = 'check';
            setTimeout(() => iconSpan.textContent = 'content_copy', 2000);
        };
        
        responseElement.appendChild(container);
    }</span>
                <span class="text-[13px] font-medium text-gray-300">${artifact.title}</span>
            </div>
            <div class="flex items-center gap-2">
                <button class="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors" title="Copiar">
                    <span class="material-icons-outlined text-[16px]">content_copy</span>
                </button>
            </div>
        `;

        const contentArea = document.createElement('div');
        contentArea.className = 'artifact-content-area p-4 max-h-[500px] overflow-auto text-[14px] text-gray-200 leading-relaxed';
        
        if (artifact.type === 'code') {
            contentArea.innerHTML = `<pre class="font-mono bg-transparent p-0 m-0 whitespace-pre-wrap break-all"><code>${this.escapeHtml(artifact.content)}</code></pre>`;
        } else {
            contentArea.innerHTML = this.formatDocumentContent(artifact.content);
        }

        container.appendChild(header);
        container.appendChild(contentArea);

        const copyBtn = header.querySelector('button');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(artifact.content);
            const iconSpan = copyBtn.querySelector('span');
            iconSpan.textContent = 'check';
            setTimeout(() => iconSpan.textContent = 'content_copy', 2000);
        };

        responseElement.appendChild(container);
    }

    formatDocumentContent(content) {
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\s*\+\s*(.*)/gm, '<li class="ml-4 list-none flex items-start gap-2"><span class="text-blue-400">•</span> $1</li>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    stripArtifactTags(text) {
        return text.replace(/<artifact[\s\S]*?<\/artifact>/gi, '').trim();
    }
}
