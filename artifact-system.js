export default class ArtifactSystem {
    constructor(agent, ui) {
        this.agent = agent;
        this.ui = ui;
    }

    async decideIfNeedsArtifact(userMessage, webData, relevantContext) {
        try {
            const systemPrompt = `Você é um decisor binário. Responda APENAS "SIM" ou "NÃO".
            Decida se o usuário solicitou algo que se beneficiaria de um ARTIFACT (elemento visual, código, tabela, documento rico, linha do tempo).
            - Responda SIM se: for código, tabela, resumo de estudo, lista complexa, fluxograma, componente interativo.
            - Responda NÃO se: for apenas conversa, saudação, pergunta simples de texto.`;

            const response = await this.agent.callGroqAPI(\'llama-3.1-8b-instant\', [               { role: 'system', content: systemPrompt },
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
        container.className = 'claude-artifact-container animate-artifact my-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-left w-full max-w-5xl mx-auto';
        
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between bg-[#1e293b]/80 backdrop-blur-md px-5 py-3 border-b border-white/5';
        
        let icon = 'description';
        if (artifact.type === 'code') icon = 'code';
        if (artifact.type === 'web') icon = 'auto_awesome';
        if (artifact.type === 'mermaid') icon = 'account_tree';

        header.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="p-1.5 bg-blue-500/20 rounded-lg">
                    <span class="material-icons-outlined text-blue-400 text-[20px] block">${icon}</span>
                </div>
                <div class="flex flex-col">
                    <span class="text-[13px] font-bold text-white tracking-tight">${artifact.title}</span>
                    <span class="text-[10px] text-slate-400 uppercase tracking-widest font-medium">${artifact.type} artifact</span>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button class="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all group" title="Copiar Conteúdo">
                    <span class="material-icons-outlined text-[18px]">content_copy</span>
                </button>
                <button class="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all group download-png-btn" title="Baixar como PNG">
                    <span class="material-icons-outlined text-[18px]">download</span>
                </button>
                <button class="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all" title="Expandir" onclick="this.closest('.claude-artifact-container').classList.toggle('max-w-full')">
                    <span class="material-icons-outlined text-[18px]">fullscreen</span>
                </button>
            </div>
        `;

        const contentArea = document.createElement('div');
        contentArea.className = 'artifact-content-area overflow-hidden text-[14px] text-slate-200 leading-relaxed relative';

        if (artifact.type === 'web') {
            contentArea.className += ' h-[700px] bg-[#0f172a]';
            const iframe = document.createElement('iframe');
            iframe.className = 'w-full h-full border-none opacity-0 transition-opacity duration-700';
            iframe.sandbox = 'allow-scripts allow-forms allow-popups allow-modals allow-same-origin';
            contentArea.appendChild(iframe);
            
            // Loading state
            const loader = document.createElement('div');
            loader.className = 'absolute inset-0 flex items-center justify-center bg-[#0f172a] z-10 transition-opacity duration-500';
            loader.innerHTML = '<div class="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>';
            contentArea.appendChild(loader);

            setTimeout(() => {
                try {
                    const doc = iframe.contentWindow.document;
                    doc.open();
                    iframe.srcdoc = artifact.content;
                    doc.close();
                    iframe.onload = () => {
                        iframe.classList.remove('opacity-0');
                        loader.classList.add('opacity-0');
                        setTimeout(() => loader.remove(), 500);
                    };
                } catch (e) {
                    console.error('Erro ao renderizar iframe:', e);
                    contentArea.innerHTML = `<div class="p-8 text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg m-4">Erro na renderização visual: ${e.message}</div>`;
                }
            }, 50);
        } else if (artifact.type === 'code') {
            contentArea.className += ' p-6 max-h-[600px] overflow-auto bg-[#011627]';
            contentArea.innerHTML = `<pre class="font-mono p-0 m-0 whitespace-pre-wrap break-all text-blue-100"><code>${this.escapeHtml(artifact.content)}</code></pre>`;
        } else {
            contentArea.className += ' p-8 max-h-[700px] overflow-auto bg-slate-900/50';
            contentArea.innerHTML = `<div class="prose prose-invert max-w-none">${this.formatDocumentContent(artifact.content)}</div>`;
        }

        container.appendChild(header);
        container.appendChild(contentArea);

        const copyBtn = header.querySelector('button');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(artifact.content);
            const iconSpan = copyBtn.querySelector('span');
            iconSpan.textContent = 'check';
            iconSpan.classList.add('text-emerald-400');
            setTimeout(() => {
                iconSpan.textContent = 'content_copy';
                iconSpan.classList.remove('text-emerald-400');
            }, 2000);
        };
        const downloadBtn = header.querySelector('.download-png-btn');
        downloadBtn.onclick = () => {
            const blob = new Blob([artifact.content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${artifact.identifier || 'artifact'}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            const iconSpan = downloadBtn.querySelector('span');
            iconSpan.textContent = 'check';
            iconSpan.classList.add('text-emerald-400');
            setTimeout(() => {
                iconSpan.textContent = 'download';
                iconSpan.classList.remove('text-emerald-400');
            }, 2000);
        };

        // Injetar o artifact no final da mensagem, mas antes de qualquer botão de fontes
        const sourcesBtn = responseElement.querySelector('.sources-btn-container');
        if (sourcesBtn) {
            responseElement.insertBefore(container, sourcesBtn);
        } else {
            responseElement.appendChild(container);
        }
        
        // Rolar para mostrar o artifact
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
