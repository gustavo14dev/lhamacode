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
            pageModeTitle: document.getElementById('pageModeTitle'),
            pageModeDescription: document.getElementById('pageModeDescription'),
            resultsSubtitle: document.getElementById('resultsSubtitle'),
            mediaResults: document.getElementById('mediaResults'),
            videoSpotlight: document.getElementById('videoSpotlight'),
            submitSearchButton: document.getElementById('submitSearchButton'),
            loadMoreShell: document.getElementById('loadMoreShell'),
            loadMoreButton: document.getElementById('loadMoreButton'),
            loadMoreHint: document.getElementById('loadMoreHint'),
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
        if ((mode !== 'image' && mode !== 'video') || this.mode === mode) {
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
        return mode === 'image' ? 'Imagens' : 'Vídeos';
    }

    getSingularModeLabel(mode = this.mode) {
        return mode === 'image' ? 'imagem' : 'vídeo';
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
        const singularLabel = this.getSingularModeLabel();
        const batchSize = this.getBatchSize();

        this.updatePageCopy({
            title: modeLabel,
            description: this.mode === 'image'
                ? 'Descreva o que você quer encontrar e o mural de imagens aparece logo abaixo.'
                : 'Digite o assunto que você quer ver e os vídeos aparecem logo abaixo.'
        });

        if (this.elements.input) {
            this.elements.input.placeholder = this.mode === 'image'
                ? 'Descreva uma imagem, estilo ou tema'
                : 'Busque um vídeo, aula, tutorial ou assunto';
        }

        this.updateResultPills({
            mode: modeLabel,
            batch: `${batchSize} por lote`,
            count: '0 itens'
        });

        this.elements.resultsSubtitle.textContent = this.mode === 'image'
            ? 'As imagens vão aparecer aqui embaixo assim que você buscar.'
            : 'Os vídeos vão aparecer aqui embaixo assim que você buscar.';

        this.toggleLoadMore(false);
        this.elements.mediaResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">
                    <span class="material-icons-outlined">search</span>
                </div>
                <h3>Nenhum ${singularLabel} carregado ainda</h3>
                <p>Use a caixa acima, escolha ${this.mode === 'image' ? 'Imagem' : 'Vídeo'} e o catálogo vai preencher a área abaixo.</p>
            </div>
        `;
    }

    updatePageCopy({ title, description }) {
        if (this.elements.pageModeTitle) {
            this.elements.pageModeTitle.textContent = title;
        }
        if (this.elements.pageModeDescription) {
            this.elements.pageModeDescription.textContent = description;
        }
    }

    updateResultPills({ mode, batch, count }) {
        if (this.elements.resultsModePill) {
            this.elements.resultsModePill.textContent = mode;
        }
        if (this.elements.resultsBatchPill) {
            this.elements.resultsBatchPill.textContent = batch;
        }
        if (this.elements.resultsCountPill) {
            this.elements.resultsCountPill.textContent = count;
        }
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
                        ? `Não encontrei imagens relevantes para "${query}". Tente outra descrição ou um tema mais específico.`
                        : `Não encontrei vídeos relevantes para "${query}". Tente simplificar o assunto ou trocar as palavras.`
                );
                return;
            }

            this.renderResults(this.results, query);
        } catch (error) {
            console.error('[midia] search failed:', error);
            this.renderFeedbackState(
                'Busca indisponivel',
                error?.message || 'Não foi possível concluir a busca agora. Tente novamente em alguns instantes.'
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
            throw new Error(data.message || data.error || 'Falha ao buscar vídeos no YouTube.');
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
        this.updateResultPills({
            mode: this.getModeLabel(),
            batch: `${this.getBatchSize()} por lote`,
            count: '0 itens'
        });
        this.elements.resultsSubtitle.textContent = `Buscando ${this.getModeLabel().toLowerCase()} para "${query}".`;
        this.elements.mediaResults.innerHTML = `
            <div class="feedback-state">
                <div class="loading-badge" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <h3>Montando os resultados</h3>
                <p>O primeiro lote vai aparecer logo abaixo, mantendo a tela limpa e direta.</p>
            </div>
        `;
    }

    renderResults(results, query) {
        const countLabel = `${this.formatCount(results.length)} itens`;
        this.updateResultPills({
            mode: this.getModeLabel(),
            batch: `${this.getBatchSize()} por lote`,
            count: countLabel
        });

        this.elements.resultsSubtitle.textContent = `${countLabel} carregados para "${query}".`;

        if (this.mode === 'image') {
            this.renderImages(results, query);
        } else {
            this.renderVideos(results);
        }

        this.toggleLoadMore(this.hasMore);
        if (this.elements.loadMoreHint) {
            this.elements.loadMoreHint.textContent = this.hasMore
                ? `Clique para puxar mais ${this.getModeLabel().toLowerCase()} sem repetir o lote anterior.`
                : 'Não há mais resultados disponíveis para este tema.';
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
                    <div class="image-card__media">
                        <img src="${this.escapeHtml(previewUrl)}" alt="${this.escapeHtml(alt)}" loading="lazy">
                        <button
                            class="image-card__download"
                            type="button"
                            data-url="${this.escapeAttribute(imageUrl)}"
                            data-filename="${this.escapeAttribute(filename)}"
                        >
                            <span class="material-icons-outlined" style="font-size:18px;">download</span>
                        </button>
                    </div>
                    <div class="image-card__body">
                        <div class="image-card__title">${this.escapeHtml(this.truncate(alt, 72))}</div>
                        <div class="image-card__meta">${this.escapeHtml(photographer)}</div>
                        <a
                            class="image-card__source"
                            href="${this.escapeHtml(sourceUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Ver fonte
                        </a>
                    </div>
                </article>
            `;
        }).join('');

        this.elements.mediaResults.innerHTML = `<div class="image-grid">${cards}</div>`;
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

        const cards = videos.map((video) => {
            const isActive = video.videoId === this.activeVideoId;
            const meta = [
                video.channelTitle || 'Canal',
                video.durationLabel || '',
                video.viewCountLabel || ''
            ].filter(Boolean).join(' • ');

            return `
                <button class="video-card${isActive ? ' active' : ''}" type="button" data-video-id="${this.escapeAttribute(video.videoId)}">
                    <div class="video-card__media">
                        <img src="${this.escapeHtml(video.thumbnail || '')}" alt="${this.escapeHtml(video.title || 'Vídeo do YouTube')}" loading="lazy">
                        ${video.durationLabel ? `<span class="video-card__duration">${this.escapeHtml(video.durationLabel)}</span>` : ''}
                    </div>
                    <div class="video-card__body">
                        <div class="video-card__title">${this.escapeHtml(this.truncate(video.title || 'Vídeo do YouTube', 92))}</div>
                        <div class="video-card__meta">${this.escapeHtml(meta)}</div>
                    </div>
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
            <div class="video-spotlight__frame">
                <iframe
                    src="${this.escapeHtml(activeVideo.embedUrl)}"
                    title="${this.escapeHtml(activeVideo.title || 'Vídeo do YouTube')}"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
            </div>
            <div class="video-spotlight__content">
                <span class="video-spotlight__eyebrow">Assistir dentro da IA</span>
                <h3>${this.escapeHtml(activeVideo.title || 'Vídeo do YouTube')}</h3>
                <div class="video-spotlight__meta">${this.escapeHtml(meta)}</div>
                <p>${this.escapeHtml(this.truncate(activeVideo.description || 'Sem descrição disponível.', 240))}</p>
                <div class="video-spotlight__actions">
                    <a class="primary-link" href="${this.escapeHtml(activeVideo.watchUrl || `https://www.youtube.com/watch?v=${activeVideo.videoId}`)}" target="_blank" rel="noopener noreferrer">
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
            ? '<span class="material-icons-outlined" style="font-size:18px;">autorenew</span> Carregando'
            : '<span class="material-icons-outlined" style="font-size:18px;">expand_more</span> Mostrar mais';
        this.elements.loadMoreHint.textContent = isLoading
            ? `Buscando outro lote de ${this.getModeLabel().toLowerCase()} sem repetir itens.`
            : this.hasMore
                ? `Clique para carregar mais ${this.getModeLabel().toLowerCase()}.`
                : 'Não há mais resultados disponíveis para este tema.';
    }

    async downloadImageFromUrl(url, filename = 'drekee-midia.jpg', button = null) {
        if (!url) {
            return;
        }

        const originalHtml = button ? button.innerHTML : '';

        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="material-icons-outlined" style="font-size:18px;">downloading</span>';
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
                throw new Error('Não foi possível baixar a imagem selecionada.');
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
                button.innerHTML = '<span class="material-icons-outlined" style="font-size:18px;">check</span>';
            }
        } catch (error) {
            console.error('[midia] image download failed:', error);
            if (button) {
                button.innerHTML = '<span class="material-icons-outlined" style="font-size:18px;">error</span>';
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
