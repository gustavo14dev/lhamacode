class DrekeeMediaSearch {
    constructor() {
        this.mode = 'image';
        this.currentQuery = '';
        this.resultsMode = null;
        this.results = [];
        this.resultKeys = new Set();
        this.activeVideoId = null;
        this.nextImagePage = 1;
        this.nextVideoPageToken = '';
        this.hasMore = false;
        this.isLoading = false;
        this.isLoadingMore = false;

        this.elements = {
            form: document.getElementById('mediaSearchForm'),
            input: document.getElementById('mediaQueryInput'),
            newChatBtn: document.getElementById('newChatBtn'),
            backButton: document.getElementById('backButton'),
            updatesBtn: document.getElementById('updatesBtn'),
            mediaSearchBtn: document.getElementById('mediaSearchBtn'),
            imageModeBtn: document.getElementById('imageModeBtn'),
            videoModeBtn: document.getElementById('videoModeBtn'),
            resultsSubtitle: document.getElementById('resultsSubtitle'),
            mediaResults: document.getElementById('mediaResults'),
            videoSpotlight: document.getElementById('videoSpotlight'),
            submitSearchButton: document.getElementById('submitSearchButton'),
            loadMoreShell: document.getElementById('loadMoreShell'),
            loadMoreButton: document.getElementById('loadMoreButton'),
            loadMoreHint: document.getElementById('loadMoreHint'),
            heroModeStat: document.getElementById('heroModeStat'),
            heroBatchStat: document.getElementById('heroBatchStat'),
            heroLoadedStat: document.getElementById('heroLoadedStat'),
            heroStatusStat: document.getElementById('heroStatusStat'),
            resultsModePill: document.getElementById('resultsModePill'),
            resultsBatchPill: document.getElementById('resultsBatchPill'),
            resultsCountPill: document.getElementById('resultsCountPill')
        };

        this.bindEvents();
        this.renderIdleState();
    }

    bindEvents() {
        this.elements.form?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.search();
        });

        this.elements.imageModeBtn?.addEventListener('click', () => this.setMode('image'));
        this.elements.videoModeBtn?.addEventListener('click', () => this.setMode('video'));
        this.elements.loadMoreButton?.addEventListener('click', () => this.search({ append: true }));
        this.elements.newChatBtn?.addEventListener('click', () => this.goBackToChat());
        this.elements.backButton?.addEventListener('click', () => this.goBackToChat());
        this.elements.updatesBtn?.addEventListener('click', () => {
            window.location.href = 'atualizacoes.html';
        });
        this.elements.mediaSearchBtn?.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    setMode(mode) {
        if (mode !== 'image' && mode !== 'video' || this.mode === mode) {
            return;
        }

        this.mode = mode;
        this.elements.imageModeBtn?.classList.toggle('active', mode === 'image');
        this.elements.videoModeBtn?.classList.toggle('active', mode === 'video');
        this.resetResultState();
        this.renderIdleState();
    }

    goBackToChat() {
        window.location.href = 'code.html?newChat=1';
    }

    getModeLabel(mode = this.mode) {
        return mode === 'image' ? 'Imagem' : 'Video';
    }

    getModePlural(mode = this.mode) {
        return mode === 'image' ? 'imagens' : 'videos';
    }

    getBatchSize(mode = this.mode) {
        return mode === 'image' ? 30 : 50;
    }

    resetResultState() {
        this.currentQuery = '';
        this.resultsMode = null;
        this.results = [];
        this.resultKeys = new Set();
        this.activeVideoId = null;
        this.nextImagePage = 1;
        this.nextVideoPageToken = '';
        this.hasMore = false;
        this.elements.videoSpotlight?.classList.add('hidden');
    }

    renderIdleState() {
        const modeLabel = this.getModeLabel();
        const batchSize = this.getBatchSize();

        this.elements.resultsSubtitle.textContent = modeLabel === 'Imagem'
            ? 'Escolha um tema e monte um mural visual do Unsplash.'
            : 'Escolha um tema e abra um catalogo de videos do YouTube com player interno.';

        this.setDashboardStats({
            mode: modeLabel,
            batch: `${batchSize} por clique`,
            loaded: '0 itens',
            status: 'Aguardando busca',
            countPill: '0 itens'
        });

        this.toggleLoadMore(false);
        this.elements.mediaResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">
                    <span class="material-icons-outlined">dashboard_customize</span>
                </div>
                <h3>Seu catalogo visual comeca aqui</h3>
                <p>${modeLabel === 'Imagem'
                    ? 'Cada busca carrega 30 imagens por lote e voce pode puxar mais no fim da parede.'
                    : 'Cada busca carrega 50 videos por lote e o botao Mostrar mais abre outro lote sem repetir item.'}</p>
            </div>
        `;
    }

    async search({ append = false } = {}) {
        const query = String(this.elements.input?.value || '').trim();
        if (!query) {
            this.elements.input?.focus();
            return;
        }

        if (this.isLoading || this.isLoadingMore) {
            return;
        }

        const isFreshSearch = !append || query !== this.currentQuery || this.resultsMode !== this.mode;
        if (isFreshSearch) {
            this.resetResultState();
            this.currentQuery = query;
            this.resultsMode = this.mode;
        } else if (!this.hasMore) {
            return;
        }

        if (append) {
            this.isLoadingMore = true;
            this.setLoadMoreState(true);
        } else {
            this.isLoading = true;
            this.setSubmitLoadingState(true);
            this.renderLoading(query);
        }

        try {
            const batch = await this.collectNextUniqueBatch(query);

            if (batch.newItems.length > 0) {
                this.results = this.results.concat(batch.newItems);
                if (this.mode === 'video' && !this.activeVideoId) {
                    this.activeVideoId = this.results[0]?.videoId || null;
                }
            }

            this.hasMore = batch.hasMore;

            if (this.results.length === 0) {
                this.renderFeedbackState(
                    'Nada encontrado',
                    this.mode === 'image'
                        ? `Nao encontrei imagens relevantes para "${query}". Tente outra formulacao ou um termo mais especifico.`
                        : `Nao encontrei videos relevantes para "${query}". Tente simplificar o assunto ou usar outras palavras.`
                );
                return;
            }

            this.renderResults(this.results, query);
        } catch (error) {
            console.error('[midia] search failed:', error);
            this.renderFeedbackState(
                'Busca indisponivel',
                error?.message || 'Nao foi possivel concluir a busca agora. Tente novamente em alguns instantes.'
            );
        } finally {
            this.isLoading = false;
            this.isLoadingMore = false;
            this.setSubmitLoadingState(false);
            this.setLoadMoreState(false);
        }
    }

    async collectNextUniqueBatch(query) {
        let hasMore = false;
        let newItems = [];
        let attempts = 0;

        while (attempts < 3) {
            const batch = this.mode === 'image'
                ? await this.fetchImages(query, this.nextImagePage)
                : await this.fetchVideos(query, this.nextVideoPageToken);

            hasMore = batch.hasMore;
            this.consumeBatchCursor(batch);
            newItems = this.filterUniqueItems(batch.items);

            if (newItems.length > 0 || !hasMore) {
                break;
            }

            attempts += 1;
        }

        return {
            newItems,
            hasMore
        };
    }

    consumeBatchCursor(batch) {
        if (this.mode === 'image') {
            this.nextImagePage = batch.nextPage;
            return;
        }

        this.nextVideoPageToken = batch.nextPageToken;
    }

    filterUniqueItems(items) {
        const uniqueItems = [];

        items.forEach((item) => {
            const key = this.mode === 'image'
                ? String(item?.id || item?.url || item?.src?.large || '')
                : String(item?.videoId || '');

            if (!key || this.resultKeys.has(key)) {
                return;
            }

            this.resultKeys.add(key);
            uniqueItems.push(item);
        });

        return uniqueItems;
    }

    async fetchImages(query, page = 1) {
        const response = await fetch('/api/unsplash-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query,
                page,
                maxResults: 30
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.friendly_message || data.error || 'Falha ao buscar imagens no Unsplash.');
        }

        const items = Array.isArray(data.photos) ? data.photos : [];
        const currentPage = Number(data.page || page || 1);
        const hasMore = Boolean(data.hasMore);

        return {
            items,
            hasMore,
            nextPage: hasMore ? currentPage + 1 : currentPage
        };
    }

    async fetchVideos(query, pageToken = '') {
        const response = await fetch('/api/youtube-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query,
                pageToken,
                maxResults: 50
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Falha ao buscar videos no YouTube.');
        }

        const items = Array.isArray(data.videos) ? data.videos : [];
        const nextPageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';

        return {
            items,
            hasMore: Boolean(nextPageToken),
            nextPageToken
        };
    }

    renderLoading(query) {
        this.elements.videoSpotlight?.classList.add('hidden');
        this.toggleLoadMore(false);
        this.setDashboardStats({
            mode: this.getModeLabel(),
            batch: `${this.getBatchSize()} por clique`,
            loaded: '0 itens',
            status: `Buscando ${this.getModeLabel().toLowerCase()}`,
            countPill: '0 itens'
        });
        this.elements.resultsSubtitle.textContent = this.mode === 'image'
            ? `Buscando um lote inicial de imagens para "${query}".`
            : `Buscando um lote inicial de videos para "${query}".`;
        this.elements.mediaResults.innerHTML = `
            <div class="feedback-state">
                <div class="loading-badge">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <h3>Montando o catalogo</h3>
                <p>Separando ${this.mode === 'image' ? 'imagens' : 'videos'} para <strong>${this.escapeHtml(query)}</strong>. Assim que o primeiro lote chegar, voce ja pode explorar.</p>
            </div>
        `;
    }

    renderResults(results, query) {
        const modeLabel = this.getModeLabel();
        const batchSize = this.getBatchSize();

        const unitLabel = results.length === 1
            ? modeLabel.toLowerCase()
            : this.getModePlural();

        this.elements.resultsSubtitle.textContent = `${this.formatCount(results.length)} ${unitLabel} carregado${results.length === 1 ? '' : 's'} para "${query}".`;
        this.setDashboardStats({
            mode: modeLabel,
            batch: `${batchSize} por clique`,
            loaded: `${this.formatCount(results.length)} itens`,
            status: this.hasMore ? 'Pronto para carregar mais' : 'Fim do catalogo atual',
            countPill: `${this.formatCount(results.length)} itens`
        });

        if (this.mode === 'image') {
            this.renderImages(results, query);
        } else {
            this.renderVideos(results);
        }

        this.toggleLoadMore(this.hasMore);
        if (this.elements.loadMoreHint) {
            this.elements.loadMoreHint.textContent = this.hasMore
                ? `Buscar mais ${this.getModePlural()} sem repetir o lote anterior.`
                : 'Nao ha mais resultados disponiveis neste catalogo.';
        }
    }

    renderImages(images, query) {
        this.elements.videoSpotlight?.classList.add('hidden');

        const cards = images.map((image, index) => {
            const imageUrl = image?.src?.large || image?.url || image?.src?.medium || '';
            const previewUrl = image?.src?.medium || image?.src?.large || image?.url || '';
            const alt = image?.alt || query || 'Imagem';
            const photographer = image?.photographer || 'Autor';
            const sourceUrl = image?.unsplash_url || image?.photographer_url || '#';
            const filename = this.buildImageFilename(query, index + 1);

            return `
                <article class="image-card">
                    <img src="${this.escapeHtml(previewUrl)}" alt="${this.escapeHtml(alt)}" loading="lazy">
                    <div class="image-card__overlay">
                        <div class="image-card__topline">
                            <span class="image-card__index">#${String(index + 1).padStart(2, '0')}</span>
                            <button
                                class="image-card__download"
                                type="button"
                                data-url="${this.escapeAttribute(imageUrl)}"
                                data-filename="${this.escapeAttribute(filename)}"
                            >
                                <span class="material-icons-outlined" style="font-size:1rem;">download</span>
                                Baixar
                            </button>
                        </div>
                        <div class="image-card__footer">
                            <div class="image-card__caption">
                                <strong>${this.escapeHtml(this.truncate(alt, 74))}</strong>
                                <span>${this.escapeHtml(photographer)}</span>
                            </div>
                            <a
                                class="image-card__source"
                                href="${this.escapeHtml(sourceUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span class="material-icons-outlined" style="font-size:1rem;">open_in_new</span>
                                Fonte
                            </a>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        this.elements.mediaResults.innerHTML = `<div class="image-results">${cards}</div>`;
        this.elements.mediaResults.querySelectorAll('.image-card__download').forEach((button) => {
            button.addEventListener('click', () => {
                this.downloadImageFromUrl(button.dataset.url, button.dataset.filename, button);
            });
        });
    }

    renderVideos(videos) {
        if (!videos.some((video) => video.videoId === this.activeVideoId)) {
            this.activeVideoId = videos[0]?.videoId || null;
        }

        this.updateVideoSpotlight(videos, this.activeVideoId);

        const cards = videos.map((video, index) => {
            const isActive = video.videoId === this.activeVideoId;
            const meta = [
                video.channelTitle || 'Canal',
                video.durationLabel || '',
                video.viewCountLabel || ''
            ].filter(Boolean).join(' • ');

            return `
                <button class="video-card${isActive ? ' active' : ''}" type="button" data-video-id="${this.escapeAttribute(video.videoId)}">
                    <div class="video-card__thumb-wrap">
                        <img src="${this.escapeHtml(video.thumbnail || '')}" alt="${this.escapeHtml(video.title || 'Video do YouTube')}" loading="lazy">
                        <span class="video-card__badge">#${String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div class="video-card__title">${this.escapeHtml(this.truncate(video.title || 'Video do YouTube', 112))}</div>
                    <div class="video-card__meta">${this.escapeHtml(meta)}</div>
                </button>
            `;
        }).join('');

        this.elements.mediaResults.innerHTML = `<div class="video-grid">${cards}</div>`;
        this.elements.mediaResults.querySelectorAll('.video-card').forEach((button) => {
            button.addEventListener('click', () => {
                this.activeVideoId = button.dataset.videoId;
                this.updateVideoSpotlight(videos, this.activeVideoId);
                this.elements.mediaResults.querySelectorAll('.video-card').forEach((card) => {
                    card.classList.toggle('active', card.dataset.videoId === this.activeVideoId);
                });
            });
        });
    }

    updateVideoSpotlight(videos, activeVideoId) {
        const activeVideo = videos.find((video) => video.videoId === activeVideoId) || videos[0];
        if (!activeVideo) {
            this.elements.videoSpotlight?.classList.add('hidden');
            return;
        }

        const meta = [
            activeVideo.channelTitle || 'Canal',
            activeVideo.durationLabel || '',
            activeVideo.viewCountLabel || ''
        ].filter(Boolean).join(' • ');

        this.elements.videoSpotlight.innerHTML = `
            <div class="video-frame">
                <iframe
                    src="${this.escapeHtml(activeVideo.embedUrl)}"
                    title="${this.escapeHtml(activeVideo.title || 'Video do YouTube')}"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
            </div>
            <div class="video-meta">
                <span class="video-meta__eyebrow">Destaque ativo</span>
                <h3>${this.escapeHtml(activeVideo.title || 'Video do YouTube')}</h3>
                <div class="video-meta__line">${this.escapeHtml(meta)}</div>
                <p>${this.escapeHtml(this.truncate(activeVideo.description || 'Sem descricao disponivel.', 280))}</p>
                <div class="video-meta__actions">
                    <a class="primary-btn" href="${this.escapeHtml(activeVideo.watchUrl || `https://www.youtube.com/watch?v=${activeVideo.videoId}`)}" target="_blank" rel="noopener noreferrer">
                        <span class="material-icons-outlined" style="font-size:1rem;">open_in_new</span>
                        Abrir no YouTube
                    </a>
                </div>
            </div>
        `;
        this.elements.videoSpotlight.classList.remove('hidden');
    }

    renderFeedbackState(title, description) {
        this.elements.videoSpotlight?.classList.add('hidden');
        this.toggleLoadMore(false);
        this.elements.mediaResults.innerHTML = `
            <div class="feedback-state">
                <div class="empty-state__icon">
                    <span class="material-icons-outlined">info</span>
                </div>
                <h3>${this.escapeHtml(title)}</h3>
                <p>${this.escapeHtml(description)}</p>
            </div>
        `;
    }

    toggleLoadMore(visible) {
        if (!this.elements.loadMoreShell) {
            return;
        }

        this.elements.loadMoreShell.classList.toggle('hidden', !visible);
    }

    setSubmitLoadingState(isLoading) {
        if (!this.elements.submitSearchButton) {
            return;
        }

        this.elements.submitSearchButton.toggleAttribute('disabled', isLoading);
        this.elements.submitSearchButton.style.opacity = isLoading ? '0.82' : '1';
        this.elements.submitSearchButton.style.pointerEvents = isLoading ? 'none' : 'auto';
    }

    setLoadMoreState(isLoading) {
        if (!this.elements.loadMoreButton || !this.elements.loadMoreHint) {
            return;
        }

        this.elements.loadMoreButton.toggleAttribute('disabled', isLoading);
        this.elements.loadMoreButton.innerHTML = isLoading
            ? '<span class="material-icons-outlined" style="font-size:1rem;">autorenew</span> Carregando'
            : '<span class="material-icons-outlined" style="font-size:1rem;">expand_more</span> Mostrar mais';
        this.elements.loadMoreHint.textContent = isLoading
            ? `Buscando outro lote de ${this.getModePlural()} sem repetir os itens que ja estao na tela.`
            : this.hasMore
                ? `Buscar mais ${this.getModePlural()} sem repetir o lote anterior.`
                : 'Nao ha mais resultados disponiveis neste catalogo.';
    }

    setDashboardStats({ mode, batch, loaded, status, countPill }) {
        if (this.elements.heroModeStat) {
            this.elements.heroModeStat.textContent = mode;
        }
        if (this.elements.heroBatchStat) {
            this.elements.heroBatchStat.textContent = batch;
        }
        if (this.elements.heroLoadedStat) {
            this.elements.heroLoadedStat.textContent = loaded;
        }
        if (this.elements.heroStatusStat) {
            this.elements.heroStatusStat.textContent = status;
        }
        if (this.elements.resultsModePill) {
            this.elements.resultsModePill.textContent = mode;
        }
        if (this.elements.resultsBatchPill) {
            this.elements.resultsBatchPill.textContent = batch;
        }
        if (this.elements.resultsCountPill) {
            this.elements.resultsCountPill.textContent = countPill;
        }
    }

    async downloadImageFromUrl(url, filename = 'drekee-midia.jpg', button = null) {
        if (!url) {
            return;
        }

        const originalHtml = button ? button.innerHTML : '';

        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="material-icons-outlined" style="font-size:1rem;">downloading</span> Baixando';
            }

            const candidates = [
                `/api/image-proxy?url=${encodeURIComponent(url)}`,
                url
            ];

            let fileBlob = null;
            for (const candidate of candidates) {
                try {
                    const response = await fetch(candidate);
                    if (!response.ok) {
                        continue;
                    }

                    const blob = await response.blob();
                    if (blob && blob.size > 0) {
                        fileBlob = blob;
                        break;
                    }
                } catch (error) {
                    console.warn('[midia] image download candidate failed:', error);
                }
            }

            if (!fileBlob) {
                throw new Error('Nao foi possivel baixar a imagem selecionada.');
            }

            const objectUrl = URL.createObjectURL(fileBlob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);

            if (button) {
                button.innerHTML = '<span class="material-icons-outlined" style="font-size:1rem;">check</span> Pronto';
            }
        } catch (error) {
            console.error('[midia] image download failed:', error);
            if (button) {
                button.innerHTML = '<span class="material-icons-outlined" style="font-size:1rem;">error</span> Erro';
            }
        } finally {
            if (button) {
                window.setTimeout(() => {
                    button.disabled = false;
                    button.innerHTML = originalHtml;
                }, 1800);
            }
        }
    }

    buildImageFilename(query, index) {
        const slug = String(query || 'midia')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'midia';
        return `drekee-${slug}-${index}.jpg`;
    }

    truncate(value, maxLength) {
        const text = String(value || '').trim();
        if (!text || text.length <= maxLength) {
            return text;
        }
        return text.slice(0, Math.max(maxLength - 3, 1)).trimEnd() + '...';
    }

    formatCount(value) {
        return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeAttribute(value) {
        return this.escapeHtml(value).replace(/`/g, '&#96;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.drekeeMediaSearch = new DrekeeMediaSearch();
});
