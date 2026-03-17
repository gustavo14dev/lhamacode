import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';

const VIEWPORT = {
    width: 1440,
    height: 1024,
    deviceScaleFactor: 1
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const task = typeof req.body?.task === 'string' ? req.body.task : '';
    const normalizedUrl = normalizeUrl(rawUrl);

    if (!normalizedUrl) {
        return res.status(400).json({ error: 'Invalid or missing URL' });
    }

    let browser;

    try {
        browser = await launchAgentBrowser();

        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);
        await page.emulateMediaType('screen');
        await page.goto(normalizedUrl, {
            waitUntil: 'networkidle2',
            timeout: 45000
        });

        await wait(1200);
        await waitForReadableCapture(page);

        let pageContext = await collectPageContext(page);
        let pageTitle = await page.title();

        if (isProtectedPage(pageTitle, pageContext)) {
            const fallback = await createMetadataFallback(
                normalizedUrl,
                'O site bloqueou a navegacao automatizada nesta tentativa.'
            );

            return res.status(200).json({
                ...fallback,
                mode: fallback.mode === 'hosted-screenshot' ? 'site-protected-hosted' : 'site-protected-fallback'
            });
        }

        const screenshots = [];
        const navigationTrail = [];

        screenshots.push(await captureScreenshot(page, 'Homepage carregada', 'Acabei de abrir o site no navegador controlado pelo agente.'));

        const navigationHints = extractNavigationHints(task).slice(0, 3);
        for (const hint of navigationHints) {
            const navigation = await navigateToHint(page, hint);
            navigationTrail.push(navigation);

            if (!navigation.success) {
                continue;
            }

            await wait(1200);
            await waitForReadableCapture(page);
            pageContext = await collectPageContext(page);
            pageTitle = await page.title();

            screenshots.push(await captureScreenshot(
                page,
                pageTitle || `Pagina: ${hint}`,
                `Naveguei para ${hint}.`
            ));

            if (isProtectedPage(pageTitle, pageContext)) {
                const fallback = await createMetadataFallback(
                    page.url(),
                    'A pagina de destino bloqueou a navegacao automatizada nesta tentativa.'
                );

                return res.status(200).json({
                    ...fallback,
                    mode: fallback.mode === 'hosted-screenshot' ? 'site-protected-hosted' : 'site-protected-fallback',
                    requestedUrl: normalizedUrl,
                    currentUrl: page.url(),
                    navigationTrail
                });
            }
        }

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));

        return res.status(200).json({
            mode: 'live-browser',
            requestedUrl: normalizedUrl,
            currentUrl: page.url(),
            title: pageTitle,
            page: pageContext,
            screenshots,
            navigationTrail
        });
    } catch (error) {
        console.error('Agent browser error:', error);

        if (isBrowserUnavailableError(error)) {
            const fallback = await createMetadataFallback(normalizedUrl, error.message);
            return res.status(200).json(fallback);
        }

        return res.status(500).json({ error: error.message || 'Failed to browse URL' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function launchAgentBrowser() {
    const executablePath = resolveExecutablePath();
    const launchOptions = {
        headless: true,
        pipe: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-background-networking',
            '--disable-extensions'
        ]
    };

    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    try {
        return await puppeteer.launch(launchOptions);
    } catch (error) {
        if (looksLikeMissingBrowserError(error)) {
            const wrapped = new Error(
                'Chrome do agente nao esta disponivel. Instale com "npx puppeteer browsers install chrome" ou configure PUPPETEER_EXECUTABLE_PATH.'
            );
            wrapped.code = 'BROWSER_UNAVAILABLE';
            throw wrapped;
        }

        throw error;
    }
}

function resolveExecutablePath() {
    const envCandidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_EXECUTABLE_PATH,
        process.env.GOOGLE_CHROME_BIN
    ].filter(Boolean);

    for (const candidate of envCandidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    try {
        const bundled = puppeteer.executablePath();
        if (bundled && fs.existsSync(bundled)) {
            return bundled;
        }
    } catch {
        // Ignore and keep searching common OS paths.
    }

    const homeDir = os.homedir();
    const commonCandidates = [
        path.join(homeDir, '.cache', 'puppeteer', 'chrome', 'win64-144.0.7559.96', 'chrome-win64', 'chrome.exe'),
        path.join(homeDir, '.cache', 'puppeteer', 'chrome', 'linux-144.0.7559.96', 'chrome-linux64', 'chrome'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ];

    return commonCandidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function looksLikeMissingBrowserError(error) {
    const message = String(error?.message || '');
    return message.includes('Could not find Chrome')
        || message.includes('Could not find Chromium')
        || message.includes('Browser was not found');
}

function isBrowserUnavailableError(error) {
    return error?.code === 'BROWSER_UNAVAILABLE' || looksLikeMissingBrowserError(error);
}

function normalizeUrl(rawUrl) {
    if (typeof rawUrl !== 'string') {
        return null;
    }

    const cleaned = rawUrl.trim().replace(/[),.;!?]+$/g, '');
    if (!cleaned) {
        return null;
    }

    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;

    try {
        const parsed = new URL(withProtocol);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

async function collectPageContext(page) {
    return page.evaluate(() => {
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
            .map((element) => element.textContent?.trim())
            .filter(Boolean)
            .slice(0, 8);

        const interactiveElements = Array.from(document.querySelectorAll('a, button, input, textarea, select'))
            .map((element) => {
                const text = element.textContent?.trim()
                    || element.getAttribute('aria-label')
                    || element.getAttribute('placeholder')
                    || element.getAttribute('value')
                    || element.getAttribute('name')
                    || element.getAttribute('id')
                    || element.tagName.toLowerCase();

                return {
                    tag: element.tagName.toLowerCase(),
                    text
                };
            })
            .filter((item) => item.text)
            .slice(0, 20);

        const visibleText = Array.from(document.querySelectorAll('h1, h2, h3, p, li, a, button, span'))
            .map((element) => element.textContent?.replace(/\s+/g, ' ').trim())
            .filter((text) => text && text.length > 1)
            .filter((text, index, array) => array.indexOf(text) === index)
            .slice(0, 80);

        return {
            title: document.title || '',
            description: metaDescription,
            headings,
            interactiveElements,
            visibleText,
            scrollHeight: Math.max(
                document.body?.scrollHeight || 0,
                document.documentElement?.scrollHeight || 0
            )
        };
    });
}

function extractNavigationHints(task) {
    const hints = [];
    const normalizedTask = normalizeSearchText(
        String(task || '')
            .replace(/https?:\/\/\S+/gi, ' ')
            .replace(/\bwww\.[^\s]+/gi, ' ')
    );
    const patterns = [
        /(?:pagina|secao|aba|menu)\s+de\s+(.+?)(?=\s+e\s+(?:me|depois|entao)|$)/gi,
        /(?:va|entre|acesse|abra|navegue|ir)\s+(?:na|no|para a|para o|para|ate)\s+(.+?)(?=\s+e\s+(?:me|depois|entao)|$)/gi
    ];
    const blacklist = new Set(['site', 'pagina', 'home', 'inicio', 'inicial']);

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(normalizedTask)) !== null) {
            const value = sanitizeNavigationHint(match[1]);
            const cleaned = normalizeSearchText(value);
            if (!cleaned || blacklist.has(cleaned)) {
                continue;
            }

            const isDuplicate = hints.some((existingHint) => {
                const existingCleaned = normalizeSearchText(existingHint);
                return existingCleaned === cleaned
                    || existingCleaned.includes(cleaned)
                    || cleaned.includes(existingCleaned);
            });

            if (!isDuplicate) {
                hints.push(value);
            }
        }
    }

    return hints;
}

function sanitizeNavigationHint(value) {
    return String(value || '')
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\bwww\.[^\s]+/gi, ' ')
        .replace(/^(?:de\s+)?(?:site|pagina|secao)\s+(?:de|do|da)\s+/i, '')
        .replace(/^(?:de\s+)?(?:site|pagina|secao)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function navigateToHint(page, hint) {
    const target = await findBestNavigationTarget(page, hint);
    if (!target) {
        return {
            targetHint: hint,
            success: false
        };
    }

    const previousUrl = page.url();

    if (target.href && /^https?:/i.test(target.href)) {
        await page.goto(target.href, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
    } else {
        await page.evaluate((index) => {
            const candidates = Array.from(document.querySelectorAll('a, button, [role="button"], summary'));
            const element = candidates[index];
            if (element) {
                element.click();
            }
        }, target.domIndex);

        await waitForPossibleNavigation(page, previousUrl);
    }

    return {
        targetHint: hint,
        success: true,
        matchedText: target.text,
        href: target.href || null,
        previousUrl,
        currentUrl: page.url()
    };
}

async function findBestNavigationTarget(page, hint) {
    const pageOrigin = new URL(page.url()).origin;
    const candidates = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a, button, [role="button"], summary'))
            .map((element, domIndex) => {
                const text = (element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || '')
                    .replace(/\s+/g, ' ')
                    .trim();

                const href = element.tagName.toLowerCase() === 'a'
                    ? element.href
                    : element.getAttribute('href') || '';

                const style = window.getComputedStyle(element);
                const visible = style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0'
                    && element.getBoundingClientRect().width > 0
                    && element.getBoundingClientRect().height > 0;

                return {
                    domIndex,
                    text,
                    href,
                    visible
                };
            })
            .filter((item) => item.visible && (item.text || item.href));
    });

    const hintTokens = expandNavigationTokens(hint);
    let best = null;

    for (const candidate of candidates) {
        const haystack = normalizeSearchText(`${candidate.text} ${candidate.href}`);
        let score = 0;

        for (const token of hintTokens) {
            if (haystack.includes(token)) {
                score += token.length > 4 ? 4 : 2;
            }
        }

        const wholeHint = normalizeSearchText(hint);
        if (wholeHint && haystack.includes(wholeHint)) {
            score += 8;
        }
        if (wholeHint && normalizeSearchText(candidate.text) === wholeHint) {
            score += 12;
        }
        if (wholeHint && normalizeSearchText(candidate.text).startsWith(wholeHint)) {
            score += 6;
        }

        if (candidate.href && candidate.href.includes('#')) {
            score -= 1;
        }

        if (candidate.href) {
            try {
                if (new URL(candidate.href).origin !== pageOrigin) {
                    score -= 4;
                }
            } catch {
                // Ignore malformed URLs.
            }
        }

        if (!best || score > best.score) {
            best = {
                ...candidate,
                score
            };
        }
    }

    return best && best.score > 0 ? best : null;
}

function expandNavigationTokens(hint) {
    const baseTokens = normalizeSearchText(hint)
        .split(' ')
        .filter(Boolean);

    const synonyms = {
        ia: ['ai', 'artificial', 'intelligence'],
        modelos: ['models', 'model'],
        modelo: ['models', 'model'],
        preco: ['pricing', 'price', 'plans'],
        precos: ['pricing', 'price', 'plans'],
        preços: ['pricing', 'price', 'plans'],
        preço: ['pricing', 'price', 'plans'],
        inicio: ['home'],
        documentação: ['docs', 'documentation'],
        documentacao: ['docs', 'documentation'],
        exemplos: ['examples'],
        blog: ['blog'],
        contato: ['contact'],
        sobre: ['about']
    };

    const expanded = new Set(baseTokens);
    for (const token of baseTokens) {
        const related = synonyms[token];
        if (related) {
            related.forEach((value) => expanded.add(value));
        }
    }

    return Array.from(expanded);
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

async function waitForPossibleNavigation(page, previousUrl) {
    try {
        await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }),
            wait(2500)
        ]);
    } catch {
        await wait(1200);
    }

    if (page.url() === previousUrl) {
        await wait(1000);
    }
}

function isProtectedPage(title, pageContext = {}) {
    const combined = [
        title || '',
        pageContext.title || '',
        pageContext.description || '',
        ...(pageContext.headings || [])
    ].join(' ');

    return /access denied|forbidden|blocked|captcha|unauthorized|verify you are human|robot/i.test(combined);
}

async function createMetadataFallback(normalizedUrl, reason) {
    let html = '';

    try {
        const response = await fetch(normalizedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DrekeeAgent/1.0)'
            }
        });
        html = await response.text();
    } catch (error) {
        console.error('Metadata fallback fetch error:', error);
    }

    const page = extractPageMetadata(html, normalizedUrl);
    const remoteScreenshot = await fetchHostedScreenshot(normalizedUrl);
    const screenshots = remoteScreenshot
        ? [
            {
                label: 'Captura do site',
                note: 'Capturei uma visualizacao compativel do site para continuar o fluxo.',
                dataUrl: remoteScreenshot
            }
        ]
        : [
            {
                label: 'Preview do site',
                note: 'Gerei uma visualizacao resumida do site para continuar o fluxo.',
                dataUrl: createPreviewImage({
                    url: normalizedUrl,
                    title: page.title,
                    description: page.description,
                    headings: page.headings
                })
            }
        ];

    return {
        mode: remoteScreenshot ? 'hosted-screenshot' : 'metadata-fallback',
        warning: reason,
        requestedUrl: normalizedUrl,
        currentUrl: normalizedUrl,
        title: page.title,
        page: {
            ...page,
            scrollHeight: VIEWPORT.height
        },
        screenshots
    };
}

async function fetchHostedScreenshot(normalizedUrl) {
    const providers = [
        `https://image.thum.io/get/width/1440/crop/1024/noanimate/${normalizedUrl}`,
        `https://image.thum.io/get/width/1440/crop/1024/noanimate?url=${encodeURIComponent(normalizedUrl)}`
    ];

    for (const endpoint of providers) {
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DrekeeAgent/1.0)'
                }
            });

            if (!response.ok) {
                continue;
            }

            const contentType = response.headers.get('content-type') || 'image/jpeg';
            if (!contentType.startsWith('image/')) {
                continue;
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            return `data:${contentType};base64,${buffer.toString('base64')}`;
        } catch (error) {
            console.error('Hosted screenshot provider failed:', error);
        }
    }

    return null;
}

function extractPageMetadata(html, normalizedUrl) {
    const title = decodeHtml(findFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)) || normalizedUrl;
    const description = decodeHtml(findMetaContent(html, 'description')) || 'Sem descricao detectada no HTML.';
    const headings = extractMatches(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, 6);
    const links = extractMatches(html, /<a\b[^>]*>([\s\S]*?)<\/a>/gi, 10);
    const buttons = extractMatches(html, /<button\b[^>]*>([\s\S]*?)<\/button>/gi, 6);

    return {
        title,
        description,
        headings,
        visibleText: [...headings, description].filter(Boolean),
        interactiveElements: [...links, ...buttons].slice(0, 12).map((text) => ({
            tag: 'interactive',
            text
        }))
    };
}

function findMetaContent(html, name) {
    const regex = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    return findFirstMatch(html, regex);
}

function findFirstMatch(html, regex) {
    const match = String(html || '').match(regex);
    return match ? stripTags(match[1]) : '';
}

function extractMatches(html, regex, limit) {
    const results = [];
    let match;
    const source = String(html || '');

    while ((match = regex.exec(source)) && results.length < limit) {
        const clean = decodeHtml(stripTags(match[1]).replace(/\s+/g, ' ').trim());
        if (clean) {
            results.push(clean);
        }
    }

    return results;
}

function stripTags(text) {
    return String(text || '').replace(/<[^>]+>/g, ' ');
}

function decodeHtml(text) {
    return String(text || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function createPreviewImage({ url, title, description, headings = [] }) {
    const safeTitle = escapeXml(title || url);
    const safeUrl = escapeXml(url);
    const safeDescription = escapeXml(description || 'Sem descricao');
    const headingLines = headings.slice(0, 3).map((heading, index) => `
        <text x="48" y="${230 + (index * 40)}" font-size="24" fill="#cbd5e1">${escapeXml(`- ${heading}`)}</text>
    `).join('');

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1024" viewBox="0 0 1440 1024">
            <defs>
                <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stop-color="#0f172a" />
                    <stop offset="100%" stop-color="#1e293b" />
                </linearGradient>
            </defs>
            <rect width="1440" height="1024" fill="url(#bg)" />
            <rect x="36" y="36" width="1368" height="952" rx="28" fill="#111827" stroke="#f97316" stroke-opacity="0.45" />
            <rect x="72" y="84" width="1296" height="72" rx="18" fill="#1f2937" />
            <circle cx="114" cy="120" r="10" fill="#f97316" />
            <text x="144" y="130" font-size="26" fill="#f8fafc" font-family="Arial, sans-serif">Drekee Agent - preview do site</text>
            <text x="72" y="210" font-size="38" fill="#ffffff" font-family="Arial, sans-serif">${safeTitle}</text>
            <text x="72" y="170" font-size="22" fill="#fdba74" font-family="Arial, sans-serif">${safeUrl}</text>
            <foreignObject x="72" y="300" width="1180" height="180">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #cbd5e1; font-size: 27px; line-height: 1.45;">
                    ${safeDescription}
                </div>
            </foreignObject>
            ${headingLines}
            <rect x="72" y="820" width="760" height="86" rx="24" fill="#1f2937" stroke="#334155" />
            <text x="108" y="874" font-size="24" fill="#e2e8f0" font-family="Arial, sans-serif">Preview gerada porque o navegador visual nao estava disponivel.</text>
        </svg>
    `.trim();

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function escapeXml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function captureScreenshot(page, label, note) {
    await waitForReadableCapture(page);

    const base64 = await page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: false
    });

    return {
        label,
        note,
        dataUrl: `data:image/png;base64,${base64}`
    };
}

async function waitForReadableCapture(page) {
    try {
        await page.evaluate(async () => {
            if (document.fonts?.ready) {
                try {
                    await document.fonts.ready;
                } catch {
                    // Ignore font loading failures and keep going.
                }
            }

            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            document.body?.offsetHeight;
        });
    } catch {
        // Ignore transient evaluate failures and keep the capture flow moving.
    }

    await wait(500);
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
