// ==================== TIMELINE DE SNAPSHOTS ====================
// Ideia 10: Contexto Persistente Avançado
// Rastreia estado do código em cada mensagem, permite rollback

class TimelineSystem {
    constructor(ui) {
        this.ui = ui;
        this.snapshots = JSON.parse(localStorage.getItem('codeSnapshots') || '[]');
    }

    // Criar snapshot quando arquivo é adicionado/modificado
    createSnapshot(fileName, fileContent, chatId) {
        const snapshot = {
            id: 'snap_' + Date.now(),
            timestamp: new Date().toISOString(),
            fileName,
            fileContent,
            chatId,
            lineCount: fileContent.split('\n').length,
            charCount: fileContent.length,
            language: this.detectLanguage(fileName)
        };

        this.snapshots.push(snapshot);
        localStorage.setItem('codeSnapshots', JSON.stringify(this.snapshots));
        return snapshot;
    }

    // Obter timeline visual para um arquivo
    getTimelineForFile(fileName, chatId) {
        const fileSnapshots = this.snapshots.filter(s => s.fileName === fileName && s.chatId === chatId);
        return fileSnapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Renderizar timeline visual
    renderTimeline(fileName, chatId) {
        const timeline = this.getTimelineForFile(fileName, chatId);
        if (timeline.length === 0) return '';

        const events = timeline.map((snap, idx) => {
            const date = new Date(snap.timestamp);
            const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const changeSize = idx > 0 ? timeline[idx].charCount - timeline[idx - 1].charCount : 0;
            const changePercent = idx > 0 ? Math.round((changeSize / timeline[idx - 1].charCount) * 100) : 0;

            return `
                <div class="flex items-center gap-3 mb-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors" onclick="window.timelineSystem?.restoreSnapshot('${snap.id}')">
                    <div class="w-2 h-2 rounded-full ${changeSize >= 0 ? 'bg-green-500' : 'bg-red-500'}"></div>
                    <div class="flex-1 text-xs">
                        <div class="font-semibold text-gray-900 dark:text-white">${timeStr}</div>
                        <div class="text-gray-600 dark:text-gray-400">${snap.lineCount} linhas • ${snap.charCount} chars</div>
                    </div>
                    <div class="text-xs font-mono px-2 py-1 rounded ${changeSize >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}">
                        ${changeSize >= 0 ? '+' : ''}${changeSize} chars ${changePercent >= 0 ? '+' : ''}${changePercent}%
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <span class="material-icons-outlined text-sm">history</span>
                    Timeline de ${fileName}
                </h4>
                <div class="max-h-40 overflow-y-auto space-y-1">
                    ${events}
                </div>
            </div>
        `;
    }

    // Restaurar snapshot
    restoreSnapshot(snapId) {
        const snap = this.snapshots.find(s => s.id === snapId);
        if (!snap) return;

        this.ui.addAssistantMessage(`✅ Código restaurado para ${new Date(snap.timestamp).toLocaleString('pt-BR')}:\n\n\`\`\`${snap.language}\n${snap.fileContent}\n\`\`\``);
    }

    // Comparar dois snapshots (diff visual)
    compareDiff(snap1Id, snap2Id) {
        const snap1 = this.snapshots.find(s => s.id === snap1Id);
        const snap2 = this.snapshots.find(s => s.id === snap2Id);
        if (!snap1 || !snap2) return;

        // Simples: mostrar ambas as versões lado a lado
        return `
            <div class="grid grid-cols-2 gap-4 mt-4">
                <div>
                    <h5 class="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Versão ${new Date(snap1.timestamp).toLocaleTimeString('pt-BR')}</h5>
                    <pre class="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-40"><code>${snap1.fileContent}</code></pre>
                </div>
                <div>
                    <h5 class="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Versão ${new Date(snap2.timestamp).toLocaleTimeString('pt-BR')}</h5>
                    <pre class="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-40"><code>${snap2.fileContent}</code></pre>
                </div>
            </div>
        `;
    }

    detectLanguage(fileName) {
        const ext = fileName.split('.').pop();
        const langMap = {
            'js': 'javascript', 'ts': 'typescript', 'py': 'python',
            'java': 'java', 'cpp': 'cpp', 'c': 'c', 'rs': 'rust',
            'go': 'go', 'rb': 'ruby', 'php': 'php', 'css': 'css',
            'html': 'html', 'json': 'json', 'sql': 'sql'
        };
        return langMap[ext] || 'plaintext';
    }
}

export { TimelineSystem };
export default TimelineSystem;
