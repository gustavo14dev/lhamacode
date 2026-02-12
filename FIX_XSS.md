# FIX XSS WARNING - Solução Final

## Problema Raiz
- `hljs.highlight()` está sendo chamado em `formatResponse()` (linha 1335) que gera HTML com `<span>` tags
- Depois esse HTML é inserido no DOM com `innerHTML` 
- Depois `hljs.highlightElement()` tenta fazer highlight NOVAMENTE nesse HTML já marcado
- Resultado: aviso XSS do Chrome

## Solução
1. **REMOVER** `hljs.highlight()` de `formatResponse()`
2. Deixar código como **plaintext** em um atributo data
3. Fazer highlight APENAS uma vez via `hljs.highlightElement()` após DOM estar pronto

## Mudanças Necessárias

### 1. Em formatResponse() - linhas 1328-1365:
```javascript
// Processar blocos de código com syntax highlight
formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const codeId = 'code_' + Date.now() + Math.random().toString(36).substr(2, 9);
    const trimmedCode = code.trim();
    
    // Store code in data attribute, render as plaintext
    const escapedCode = trimmedCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    return `<div class="bg-gray-900 dark:bg-gray-950 rounded-xl my-4 overflow-hidden border border-gray-700 dark:border-gray-800 shadow-lg">
        <div class="flex items-center justify-between px-4 py-3 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
            <span class="text-xs font-semibold text-gray-300 uppercase">${lang || 'code'}</span>
            <div class="flex gap-2">
                <button class="copy-code px-3 py-1.5 text-xs flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded" data-code-id="${codeId}">
                    <span class="material-icons-outlined text-sm">content_copy</span> Copiar
                </button>
                <button class="download-code px-3 py-1.5 text-xs flex items-center gap-1 bg-primary hover:bg-primary/90 text-white rounded" data-code-id="${codeId}" data-lang="${lang || 'txt'}">
                    <span class="material-icons-outlined text-sm">download</span> Baixar
                </button>
            </div>
        </div>
        <div class="p-4 overflow-x-auto bg-gray-950">
            <pre class="m-0"><code id="${codeId}" class="text-sm font-mono text-gray-100 language-${lang || 'plaintext'}" data-raw-code="${escapedCode}"></code></pre>
        </div>
    </div>`;
});
```

### 2. Após inserir HTML no DOM (em typewriterEffect):
```javascript
setTimeout(() => {
    // Descodificar e inserir código nos elementos que têm data-raw-code
    const codeBlocks = element.querySelectorAll('code[data-raw-code]');
    codeBlocks.forEach(codeBlock => {
        const rawCode = codeBlock.getAttribute('data-raw-code')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
        
        // Usar textContent para inserir código seguro
        codeBlock.textContent = rawCode;
        
        // Agora fazer highlight - nunca vai ter HTML não escapado
        try {
            hljs.highlightElement(codeBlock);
        } catch(e) {}
    });
}, 100);
```

### 3. Event listeners para copy/download (NO LUGAR de onclick):
```javascript
// Adicionar depois da mensagem ser inserida:
document.addEventListener('click', (e) => {
    if (e.target.closest('.copy-code')) {
        const codeId = e.target.closest('.copy-code').dataset.codeId;
        const code = document.getElementById(codeId)?.textContent;
        if (code) {
            navigator.clipboard.writeText(code);
            // Toast: "Copiado!"
        }
    }
    
    if (e.target.closest('.download-code')) {
        const btn = e.target.closest('.download-code');
        const codeId = btn.dataset.codeId;
        const lang = btn.dataset.lang;
        const code = document.getElementById(codeId)?.textContent;
        if (code) {
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `arquivo.${lang}`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
});
```

## Resultado
✅ Código nunca tem HTML escondido que hljs tente interpretar
✅ Highlight acontece apenas uma vez, seguro
✅ Sem mais warnings do Chrome
✅ Copy/Download funcionam via event listeners (seguro)
