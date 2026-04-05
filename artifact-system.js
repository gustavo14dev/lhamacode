export default class ArtifactSystem {
    constructor(agent, ui) {
        this.agent = agent;
        this.ui = ui;
    }

    async decideIfNeedsArtifact(userMessage, webData, relevantContext) {
        try {
            // Heurística rápida para palavras-chave que SEMPRE devem gerar artefatos
            const lowerMsg = userMessage.toLowerCase();
            const forceKeywords = ['resumo visual', 'quadro', 'tabela', 'gráfico', 'linha do tempo', 'cronologia', 'infográfico', 'mapa mental', 'artifact', 'artefato'];
            if (forceKeywords.some(kw => lowerMsg.includes(kw))) {
                console.log('🎯 [ARTIFACT-DECISION] Decisão: SIM (Heurística de palavra-chave)');
                return true;
            }

            const systemPrompt = `Você é um decisor binário de elite. Responda APENAS "SIM" ou "NÃO".
            Sua tarefa é decidir se a solicitação do usuário deve gerar um ARTIFACT (um componente visual rico, interativo e profissional).
            
            Responda SIM se o usuário pedir:
            - Resumos de estudo, quadros comparativos, tabelas, cronologias, linhas do tempo.
            - Código de programação, scripts, componentes web.
            - Fluxogramas, diagramas, mapas mentais.
            - Qualquer coisa que peça "visual", "quadro", "tabela" ou "resumo estruturado".
            
            Responda NÃO se for:
            - Apenas texto corrido, saudações, perguntas simples de "sim ou não", conversas informais sem necessidade de estrutura visual.
            
            Mensagem do Usuário: "${userMessage}"`;

            const response = await this.agent.callGroqAPI('llama-3.1-8b-instant', [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Devo gerar um artifact para: "${userMessage}"?` }
            ]);

            const decision = (response || '').trim().toUpperCase();
            console.log('🤖 [ARTIFACT-DECISION] Decisão do Modelo:', decision);
            
            // Se o modelo falhar ou der uma resposta ambígua, mas a mensagem parecer pedir algo estruturado, retornamos SIM
            if (decision.includes('SIM') || decision.includes('YES')) return true;
            
            // Fallback: se a mensagem for longa e tiver tópicos, provavelmente precisa de um artifact
            if (userMessage.length > 100 && (userMessage.includes('resumo') || userMessage.includes('estudo'))) return true;

            return false;
        } catch (e) {
            console.error('❌ [ARTIFACT-DECISION] Erro na decisão:', e);
            // Em caso de erro na API de decisão, se a mensagem contiver "resumo" ou "visual", assumimos SIM para não frustrar o usuário
            return userMessage.toLowerCase().includes('resumo') || userMessage.toLowerCase().includes('visual');
        }
    }

    extractArtifact(text) {
        if (!text) return null;
        
        // 1. Tentar extração via Regex padrão (mais rigoroso)
        const artifactRegex = /<artifact\s+type=["\']([^"\']+)["\'](?:\s+title=["\']([^"\']+)["\'])?[^>]*>([\s\S]*?)<\/artifact>/i;
        const match = text.match(artifactRegex);
        if (match) {
            return {
                type: match[1],
                title: match[2] || (match[1] === 'code' ? 'Código' : 'Documento'),
                content: match[3].trim()
            };
        }

        // 2. Tentar extração flexível (se o Qwen esquecer atributos ou usar aspas diferentes)
        const flexibleRegex = /<artifact[^>]*>([\s\S]*?)<\/artifact>/i;
        const flexMatch = text.match(flexibleRegex);
        if (flexMatch) {
            // Tentar descobrir o tipo pelo conteúdo
            const content = flexMatch[1].trim();
            let type = 'web'; // Default para Qwen que gera HTML
            
            // Se contém tags HTML estruturais, deve ser 'web' independente de outras palavras-chave
            if (content.includes('<!DOCTYPE') || content.includes('<html') || content.includes('<body') || (content.includes('<div') && content.includes('<style>'))) {
                type = 'web';
            } else if (content.includes('import ') || content.includes('function ') || content.includes('const ')) {
                type = 'code';
            }
            
            if (content.includes('graph TD') || content.includes('sequenceDiagram')) type = 'mermaid';
            
            return {
                type: type,
                title: 'Elemento Visual',
                content: content
            };
        }

        // 3. Fallback radical: se o texto contém muito HTML/CSS mas não tem as tags, tenta tratar como 'web'
        if (text.includes('<!DOCTYPE html>') || (text.includes('<style>') && text.includes('<div'))) {
            return {
                type: 'web',
                title: 'Resumo Visual',
                content: text.trim()
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
            iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals allow-same-origin');
            contentArea.appendChild(iframe);
            
            const loader = document.createElement('div');
            loader.className = 'absolute inset-0 flex items-center justify-center bg-[#0f172a] z-10 transition-opacity duration-500';
            loader.innerHTML = '<div class="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>';
            contentArea.appendChild(loader);
            
            setTimeout(() => {
                try {
                    // Garantir que o conteúdo tenha as bibliotecas necessárias se o Qwen esquecer
                    let fullContent = artifact.content;
                    if (!fullContent.includes('tailwindcss')) {
                        fullContent = `<script src="https://cdn.tailwindcss.com"></script>${fullContent}`;
                    }
                    
                    if (!fullContent.includes('fonts.googleapis.com')) {
                        const designBase = `
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --surface2: #21262d;
    --border: rgba(255,255,255,0.08); --accent: #7F77DD;
    --text: #e6edf3; --muted: #8b949e;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-body: 'DM Sans', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: var(--font-body); margin: 0; padding: 0; }
  h1, h2, h3 { font-family: var(--font-display); }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .animate-in { animation: fadeUp 0.4s ease forwards; opacity: 0; }
</style>`;
                        fullContent = designBase + fullContent;
                    }

                    iframe.srcdoc = fullContent;        
                    iframe.onload = () => {
                        console.log('✅ [ARTIFACT-RENDER] Iframe carregado com sucesso.');
                        iframe.classList.remove('opacity-0');
                        loader.classList.add('opacity-0');
                        setTimeout(() => loader.remove(), 500);
                    };
                } catch (e) {
                    console.error('❌ [ARTIFACT-RENDER] Erro ao renderizar iframe:', e);
                    contentArea.innerHTML = `<div class="p-8 text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg m-4">Erro na renderização visual: ${e.message}</div>`;
                }
            }, 100);
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

        const sourcesBtn = responseElement.querySelector('.sources-btn-container');
        if (sourcesBtn) {
            responseElement.insertBefore(container, sourcesBtn);
        } else {
            responseElement.appendChild(container);
        }
        
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
