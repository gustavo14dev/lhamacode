class DrekeeMediaSearch {
    constructor() {
        this.mode = 'image';
        this.results = [];
        this.resultsMode = null;
        this.activeVideoId = null;
        this.isLoading = false;

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
            submitSearchButton: document.getElementById('submitSearchButton')
        };

        this.bindEvents();
    }

    bindEvents() {
        this.elements.form?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.search();
        });

        this.elements.imageModeBtn?.addEventListener('click', () => this.setMode('image'));
        this.elements.videoModeBtn?.addEventListener('click', () => this.setMode('video'));
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
        if (mode !== 'image' && mode !== 'video') {
            return;
        }

        this.mode = mode;
        this.elements.imageModeBtn?.classList.toggle('active', mode === 'image');
        this.elements.videoModeBtn?.classList.toggle('active', mode === 'video');

        if (this.results.length > 0 && this.resultsMode === mode) {
            this.renderResults(this.results, this.elements.input?.value.trim() || '');
        } else {
            this.results = [];
            this.resultsMode = null;
            this.elements.videoSpotlight?.classList.add('hidden');
            this.renderFeedbackState(
                mode === 'image' ? 'Modo imagem ativo' : 'Modo vídeo ativo',
                mode === 'image'
                    ? 'Faça uma busca para preencher a parede com até 30 imagens do Unsplash.'
                    : 'Faça uma busca para carregar até 50 vídeos do YouTube com player interno.'
            );
            this.elements.resultsSubtitle.textContent = mode === 'image'
                ? 'Modo imagem ativo: até 30 fotos por busca.'
                : 'Modo vídeo ativo: até 50 vídeos por busca com player interno.';
        }
    }

    goBackToChat() {
        window.location.href = 'code.html?newChat=1';
    }

    async search() {
        const query = this.elements.input?.value.trim();
        if (!query || this.isLoading) {
            this.elements.input?.focus();
            return;
        }

        this.isLoading = true;
        this.setLoadingState(true);
        this.renderLoading(query);

        try {
            const results = this.mode === 'image'
                ? await this.fetchImages(query)
                : await this.fetchVideos(query);

            this.results = Array.isArray(results) ? results : [];
            this.resultsMode = this.mode;
            this.renderResults(this.results, query);
        } catch (error) {
            console.error('[midia] search failed:', error);
            this.renderFeedbackState(
                'Busca indisponível',
                error?.message || 'Não foi possível concluir a busca agora. Tente novamente em alguns instantes.'
            );
        } finally {
            this.isLoading = false;
            this.setLoadingState(false);
        }
    }

    async fetchImages(query) {
        const response = await fetch('/api/unsplash-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query,
                maxResults: 30
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.friendly_message || data.error || 'Falha ao buscar imagens no Unsplash.');
        }

        return Array.isArray(data.photos) ? data.photos.slice(0, 30) : [];
    }

    async fetchVideos(query) {
        const response = await fetch('/api/youtube-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query,
                maxResults: 50
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Falha ao buscar vídeos no YouTube.');
        }

        return Array.isArray(data.videos) ? data.videos.slice(0, 50) : [];
    }

    renderLoading(query) {
        this.elements.videoSpotlight?.classList.add('hidden');
        this.elements.mediaResults.innerHTML = `
            <div class="feedback-state">
                <div>
                    <div class="loading-dots" aria-hidden="true">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <h3>Buscando ${this.mode === 'image' ? 'imagens' : 'vídeos'}</h3>
                    <p>Montando o catálogo para <strong>${this.escapeHtml(query)}</strong>. Isso pode levar alguns segundos.</p>
                </div>
            </div>
        `;
        this.elements.resultsSubtitle.textContent = this.mode === 'image'
            ? 'Coletando até 30 resultados do Unsplash.'
            : 'Coletando até 50 resultados do YouTube.';
    }

    renderResults(results, query) {
        if (!Array.isArray(results) || results.length === 0) {
            this.elements.videoSpotlight?.classList.add('hidden');
            this.renderFeedbackState(
                'Nada encontrado',
                this.mode === 'image'
                    ? `Não encontrei imagens relevantes para "${query}". Tente um termo mais específico ou em inglês.`
                    : `Não encontrei vídeos adequados para "${query}". Tente refinar o tema ou usar palavras mais diretas.`
            );
            return;
        }

        this.elements.resultsSubtitle.textContent = this.mode === 'image'
            ? `${this.formatCount(results.length)} imagens encontradas para "${query}" (limite atual: 30).`
            : `${this.formatCount(results.length)} vídeos encontrados para "${query}" (limite atual: 50).`;

        if (this.mode === 'image') {
            this.renderImages(results, query);
            return;
        }

        this.renderVideos(results);
    }

    renderImages(images, query) {
        this.elements.videoSpotlight?.classList.add('hidden');

        const cards = images.map((image, index) => {
            const imageUrl = image?.src?.large || image?.url || image?.src?.medium || '';
            const previewUrl = image?.src?.medium || image?.src?.large || image?.url || '';
            const alt = image?.alt || query || 'Imagem do Unsplash';
            const photographer = image?.photographer || 'Autor do Unsplash';
            const unsplashUrl = image?.unsplash_url || image?.photographer_url || '#';
            const filename = this.buildImageFilename(query, index + 1);

            return `
                <article class="image-card">
                    <img src="${this.escapeHtml(previewUrl)}" alt="${this.escapeHtml(alt)}" loading="lazy">
                    <div class="image-card__overlay">
                        <div class="image-card__actions">
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
                                <strong>${this.escapeHtml(this.truncate(alt, 70))}</strong>
                                <span>${this.escapeHtml(photographer)}</span>
                            </div>
                            <a
                                class="image-card__source"
                                href="${this.escapeHtml(unsplashUrl)}"
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
        this.activeVideoId = videos[0]?.videoId || null;
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
                    <img src="${this.escapeHtml(video.thumbnail || '')}" alt="${this.escapeHtml(video.title || 'Vídeo do YouTube')}" loading="lazy">
                    <div class="video-card__title">${this.escapeHtml(this.truncate(video.title || 'Vídeo do YouTube', 110))}</div>
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
                    title="${this.escapeHtml(activeVideo.title || 'Vídeo do YouTube')}"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
            </div>
            <div class="video-meta">
                <div class="video-meta__line">${this.escapeHtml(meta)}</div>
                <h3>${this.escapeHtml(activeVideo.title || 'Vídeo do YouTube')}</h3>
                <p>${this.escapeHtml(this.truncate(activeVideo.description || 'Sem descrição disponível.', 260))}</p>
                <div>
                    <a class="primary-btn" href="${this.escapeHtml(activeVideo.watchUrl || `https://www.youtube.com/watch?v=${activeVideo.videoId}`)}" target="_blank" rel="noopener noreferrer">
                        <span class="material-icons-outlined" style="font-size:1rem;">open_in_new</span>
                        Assistir no YouTube
                    </a>
                </div>
            </div>
        `;
        this.elements.videoSpotlight.classList.remove('hidden');
    }

    renderFeedbackState(title, description) {
        this.elements.videoSpotlight?.classList.add('hidden');
        this.elements.mediaResults.innerHTML = `
            <div class="feedback-state">
                <div>
                    <span class="material-icons-outlined" style="font-size:2rem;color:#60a5fa;">info</span>
                    <h3>${this.escapeHtml(title)}</h3>
                    <p>${this.escapeHtml(description)}</p>
                </div>
            </div>
        `;
    }

    setLoadingState(isLoading) {
        this.elements.submitSearchButton?.toggleAttribute('disabled', isLoading);
        if (this.elements.submitSearchButton) {
            this.elements.submitSearchButton.style.opacity = isLoading ? '0.8' : '1';
            this.elements.submitSearchButton.style.pointerEvents = isLoading ? 'none' : 'auto';
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
