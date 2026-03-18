import fs from 'fs';
import os from 'os';
import path from 'path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const VIEWPORT = {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const action = typeof req.body?.action === 'string' ? req.body.action : 'browse';
    const task = typeof req.body?.task === 'string' ? req.body.task : '';

    if (action === 'resolve-target') {
        try {
            const result = await resolveTargetForTask(task);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ error: error.message || 'Failed to resolve target URL' });
        }
    }

    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
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

        let pageContext = await collectRichPageContext(page);
        let pageTitle = pageContext.title || await page.title();

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

        const taskInteraction = await performTaskSpecificInteractions(page, task, pageTitle, pageContext);
        pageContext = taskInteraction.pageContext;
        pageTitle = taskInteraction.pageTitle;
        screenshots.push(...taskInteraction.screenshots);
        navigationTrail.push(...taskInteraction.navigationTrail);

        const autonomousLoop = await runAutonomousBrowserLoop(page, task, pageTitle, pageContext, taskInteraction.navigationTrail);
        pageContext = autonomousLoop.pageContext;
        pageTitle = autonomousLoop.pageTitle;
        screenshots.push(...autonomousLoop.screenshots);
        navigationTrail.push(...autonomousLoop.navigationTrail);

        const navigationHints = extractNavigationHints(task).slice(0, 3);
        for (const hint of navigationHints) {
            if (pageAlreadyMatchesHint(page.url(), pageTitle, pageContext, hint)) {
                navigationTrail.push({
                    targetHint: hint,
                    success: true,
                    matchedText: pageTitle || hint,
                    href: page.url(),
                    previousUrl: page.url(),
                    currentUrl: page.url(),
                    alreadyOnTarget: true
                });
                continue;
            }

            const navigation = await navigateToHint(page, hint);
            navigationTrail.push(navigation);

            if (!navigation.success) {
                continue;
            }

            await wait(1200);
            await waitForReadableCapture(page);
            pageContext = await collectRichPageContext(page);
            pageTitle = pageContext.title || await page.title();

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

        const scrollCollection = await collectScrollableSnapshots(page, pageContext, pageTitle, task);
        pageContext = scrollCollection.pageContext;
        pageTitle = scrollCollection.pageTitle;
        screenshots.push(...scrollCollection.screenshots);

        await resetScrollableViewport(page);

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
    const remoteEndpoint = resolveRemoteBrowserEndpoint();
    if (remoteEndpoint) {
        try {
            return await puppeteer.connect({
                browserWSEndpoint: remoteEndpoint
            });
        } catch (error) {
            console.error('Remote agent browser connection failed:', error);
        }
    }

    const isServerlessRuntime = Boolean(process.env.VERCEL || process.env.AWS_REGION || process.env.LAMBDA_TASK_ROOT);
    const executablePath = await resolveExecutablePath(isServerlessRuntime);
    const launchOptions = {
        headless: true,
        pipe: !isServerlessRuntime,
        args: isServerlessRuntime
            ? [
                ...chromium.args,
                '--disable-background-networking',
                '--disable-extensions'
            ]
            : [
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
        if (isServerlessRuntime && typeof chromium.setGraphicsMode === 'boolean') {
            chromium.setGraphicsMode = false;
        }

        return await puppeteer.launch(launchOptions);
    } catch (error) {
        if (looksLikeMissingBrowserError(error)) {
            const wrapped = new Error(
                'Chrome do agente nao esta disponivel no runtime atual. Configure PUPPETEER_EXECUTABLE_PATH ou habilite o Chromium serverless no deploy.'
            );
            wrapped.code = 'BROWSER_UNAVAILABLE';
            throw wrapped;
        }

        throw error;
    }
}

async function resolveExecutablePath(isServerlessRuntime = false) {
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

    if (isServerlessRuntime) {
        try {
            const serverlessExecutable = await chromium.executablePath();
            if (serverlessExecutable) {
                return serverlessExecutable;
            }
        } catch {
            // Ignore and keep searching common OS paths.
        }
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
        || message.includes('Browser was not found')
        || message.includes('error while loading shared libraries')
        || message.includes('libnss3.so')
        || message.includes('libatk-1.0.so.0')
        || message.includes('libdrm.so.2')
        || message.includes('libxkbcommon.so.0')
        || message.includes('libxshmfence.so.1');
}

function isBrowserUnavailableError(error) {
    return error?.code === 'BROWSER_UNAVAILABLE' || looksLikeMissingBrowserError(error);
}

function resolveRemoteBrowserEndpoint() {
    const candidates = [
        process.env.BROWSER_WS_ENDPOINT,
        process.env.PUPPETEER_WS_ENDPOINT,
        process.env.BROWSERLESS_WS_ENDPOINT
    ].filter(Boolean);

    return candidates.find((value) => /^wss?:\/\//i.test(String(value || '').trim())) || '';
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

async function resolveTargetForTask(task) {
    const cleanTask = String(task || '').trim();
    if (!cleanTask) {
        throw new Error('Missing task');
    }

    const explicitUrl = extractExplicitUrl(cleanTask);
    if (explicitUrl) {
        return {
            url: explicitUrl,
            title: explicitUrl,
            source: 'explicit-url',
            results: []
        };
    }

    const guessedUrl = guessUrlFromTask(cleanTask);
    const query = buildSearchQuery(cleanTask);

    try {
        let results = [];

        if (process.env.TAVILY_API_KEY) {
            const tavilyData = await callAgentTavilySearch(query);
            results = Array.isArray(tavilyData?.results) ? tavilyData.results : [];
        }

        if (!results.length) {
            results = await fallbackAgentWebSearch(query);
        }

        const selected = selectBestAgentSearchResult(cleanTask, results);
        if (selected?.url) {
            return {
                url: selected.url,
                title: selected.title || selected.url,
                snippet: selected.content || '',
                query,
                source: results.length ? 'search' : 'domain-guess',
                results: results.slice(0, 5)
            };
        }
    } catch (error) {
        console.error('Agent target resolution error:', error);
    }

    if (guessedUrl) {
        return {
            url: guessedUrl,
            title: guessedUrl,
            source: 'domain-guess',
            query,
            results: []
        };
    }

    throw new Error('No suitable URL found for this task');
}

function extractExplicitUrl(task) {
    const source = String(task || '');
    const explicitMatch = source.match(/((?:https?:\/\/|www\.)[^\s]+)/i);
    if (explicitMatch?.[1]) {
        return normalizeUrl(explicitMatch[1]);
    }

    const bareMatches = [...source.matchAll(/(^|\s)((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi)];
    for (const match of bareMatches) {
        const prefix = String(match[1] || '');
        const value = String(match[2] || '');
        const leadingSlice = source.slice(0, match.index || 0).trimEnd();
        if (/site:$/i.test(leadingSlice)) {
            continue;
        }

        if (prefix !== '' || value) {
            return normalizeUrl(value);
        }
    }

    return null;
}

function guessUrlFromTask(task) {
    const normalized = normalizeSearchText(task);
    const match = normalized.match(/site d[oa] ([a-z0-9-]+)/i) || normalized.match(/site de ([a-z0-9-]+)/i);
    if (!match?.[1]) {
        return null;
    }

    const label = match[1].toLowerCase();
    if (KNOWN_AGENT_DOMAINS[label]) {
        return KNOWN_AGENT_DOMAINS[label];
    }

    return `https://${label}.com`;
}

function buildSearchQuery(task) {
    const searchContext = buildAgentSearchContext(task);
    const cleanTask = String(task || '')
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\bwww\.[^\s]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return [
        cleanTask,
        searchContext.preferredHost ? `site:${searchContext.preferredHost}` : '',
        searchContext.asksModels ? 'models model modelos IA' : '',
        searchContext.asksLatest ? 'latest recent mais recentes' : '',
        'site oficial'
    ].filter(Boolean).join(' ');
}

function buildAgentSearchContext(task) {
    const normalized = normalizeSearchText(task);
    const preferredHost = extractPreferredOfficialHost(task);

    return {
        preferredHost,
        officialOnly: /site oficial|site d[oa]|site de/i.test(task || ''),
        asksModels: /\b(modelo|modelos|models)\b/i.test(normalized),
        asksLatest: /\b(recente|recentes|latest|novo|novos|mais recente)\b/i.test(normalized)
    };
}

function extractPreferredOfficialHost(task) {
    const explicitUrl = extractExplicitUrl(task);
    if (explicitUrl) {
        try {
            return new URL(explicitUrl).hostname.replace(/^www\./i, '');
        } catch {
            return '';
        }
    }

    const normalized = normalizeSearchText(task);
    const siteOperator = String(task || '').match(/\bsite:([a-z0-9.-]+\.[a-z]{2,})/i);
    if (siteOperator?.[1]) {
        return siteOperator[1].replace(/^www\./i, '').toLowerCase();
    }

    const explicitEntity = normalized.match(/site oficial d[oa] ([a-z0-9-]+)/i)
        || normalized.match(/site d[oa] ([a-z0-9-]+)/i)
        || normalized.match(/site de ([a-z0-9-]+)/i);

    if (!explicitEntity?.[1]) {
        return '';
    }

    const label = explicitEntity[1].toLowerCase();
    const knownUrl = KNOWN_AGENT_DOMAINS[label];
    if (!knownUrl) {
        return '';
    }

    try {
        return new URL(knownUrl).hostname.replace(/^www\./i, '');
    } catch {
        return '';
    }
}

async function callAgentTavilySearch(query) {
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: 'advanced',
            max_results: 8,
            include_answer: false,
            include_images: false,
            include_raw_content: false
        })
    });

    if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

async function fallbackAgentWebSearch(query) {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DrekeeAgent/1.0)'
        }
    });

    if (!response.ok) {
        throw new Error(`DuckDuckGo search error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const matches = [...String(html || '').matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];

    return matches.slice(0, 8).map((match) => ({
        url: decodeDuckDuckGoUrl(match[1]),
        title: stripTags(match[2]).replace(/\s+/g, ' ').trim(),
        content: ''
    })).filter((item) => item.url && item.title);
}

function decodeDuckDuckGoUrl(rawUrl) {
    if (/^https?:\/\//i.test(rawUrl || '')) {
        return rawUrl;
    }

    try {
        const wrapped = new URL(`https://duckduckgo.com${rawUrl}`);
        const target = wrapped.searchParams.get('uddg');
        return target ? decodeURIComponent(target) : null;
    } catch {
        return null;
    }
}

function selectBestAgentSearchResult(task, results = []) {
    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    const entityTokens = extractAgentEntityTokens(task);
    const intentTokens = extractAgentIntentTokens(task);
    const searchContext = buildAgentSearchContext(task);

    return results
        .map((result, index) => ({
            ...result,
            score: scoreAgentSearchResult(result, entityTokens, intentTokens, index, searchContext)
        }))
        .sort((left, right) => right.score - left.score)[0] || null;
}

function scoreAgentSearchResult(result, entityTokens, intentTokens, index, searchContext = {}) {
    const url = String(result?.url || '');
    const title = String(result?.title || '');
    const content = String(result?.content || '');
    const haystack = normalizeSearchText(`${url} ${title} ${content}`);
    const host = safeAgentHostname(url);
    let score = Math.max(0, 20 - index);
    let hostMatchesEntity = false;

    for (const token of entityTokens) {
        if (host.includes(token)) {
            score += 28;
            hostMatchesEntity = true;
        }
        if (haystack.includes(token)) {
            score += 8;
        }
    }

    if (entityTokens.length && !hostMatchesEntity) {
        score -= 24;
    }

    if (searchContext.preferredHost) {
        if (host === searchContext.preferredHost || host.endsWith(`.${searchContext.preferredHost}`)) {
            score += 48;
        } else {
            score -= 70;
        }
    }

    for (const token of intentTokens) {
        if (haystack.includes(token)) {
            score += token.length > 5 ? 8 : 4;
        }
        if (normalizeSearchText(url).includes(token)) {
            score += 6;
        }
    }

    if (/github|linkedin|youtube|instagram|facebook|x\.com|twitter/i.test(host)) {
        score -= 12;
    }

    if (/broadcast|estadao|prnewswire|news|noticias|medium|substack/i.test(host) && !hostMatchesEntity) {
        score -= 20;
    }

    if (/docs|documentation|models|pricing|api|platform|downloads/i.test(url)) {
        score += 6;
    }

    if (/official|oficial/i.test(title)) {
        score += 4;
    }

    if (searchContext.asksModels) {
        if (/models?|docs\/models|api\/models|api\/?$/i.test(url) || /models?|modelos?/i.test(`${title} ${content}`)) {
            score += 24;
        }

        try {
            const parsed = new URL(normalizeUrl(url));
            if ((parsed.pathname === '/' || !parsed.pathname) && !/models?|api|docs/i.test(`${title} ${content}`)) {
                score -= 18;
            }
        } catch {
            // ignore malformed URL
        }
    }

    if (searchContext.asksLatest && /latest|recent|new|frontier|release|launch|updated/i.test(`${url} ${title} ${content}`)) {
        score += 12;
    }

    return score;
}

function extractAgentEntityTokens(task) {
    const normalized = normalizeSearchText(task);
    const explicitEntity = normalized.match(/site d[oa] ([a-z0-9-]+)/i) || normalized.match(/site de ([a-z0-9-]+)/i);

    if (explicitEntity?.[1]) {
        return [explicitEntity[1]].filter(Boolean);
    }

    return normalized
        .split(' ')
        .filter(Boolean)
        .filter((token) => token.length > 2)
        .filter((token) => !AGENT_SEARCH_STOP_WORDS.has(token))
        .slice(0, 4);
}

function extractAgentIntentTokens(task) {
    return normalizeSearchText(task)
        .split(' ')
        .filter(Boolean)
        .filter((token) => token.length > 2)
        .filter((token) => !AGENT_SEARCH_STOP_WORDS.has(token))
        .slice(0, 8);
}

function safeAgentHostname(rawUrl) {
    try {
        return new URL(normalizeUrl(rawUrl)).hostname.replace(/^www\./i, '');
    } catch {
        return '';
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

        const visibleText = [
            ...Array.from(document.querySelectorAll('h1, h2, h3, p, li, a, button, span'))
                .map((element) => element.textContent?.replace(/\s+/g, ' ').trim()),
            ...String(document.body?.innerText || '')
                .split('\n')
                .map((line) => line.replace(/\s+/g, ' ').trim())
        ]
            .filter((text) => text && text.length > 1)
            .filter((text, index, array) => array.indexOf(text) === index)
            .slice(0, 220);

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

async function collectRichPageContext(page) {
    const baseContext = await collectPageContext(page);
    return enrichSparsePageContext(page, baseContext);
}

async function enrichSparsePageContext(page, pageContext = {}) {
    const visibleText = Array.isArray(pageContext.visibleText) ? pageContext.visibleText : [];
    const hasReadableTitle = Boolean(pageContext.title) && !looksLikeUrlText(pageContext.title);
    const hasUsefulText = visibleText.length >= 16 || visibleText.some((item) => String(item || '').length >= 60);
    const hasDescription = Boolean(pageContext.description) && !/sem descricao detectada/i.test(pageContext.description);

    if (hasReadableTitle && hasUsefulText && hasDescription) {
        return pageContext;
    }

    let html = '';
    try {
        html = await page.content();
    } catch {
        return pageContext;
    }

    if (!html) {
        return pageContext;
    }

    const metadata = extractPageMetadata(html, page.url());
    const htmlVisibleText = extractVisibleTextFromHtml(html, 260);

    return mergePageContexts({
        title: metadata.title,
        description: metadata.description,
        headings: metadata.headings,
        interactiveElements: metadata.interactiveElements,
        visibleText: [...metadata.visibleText, ...htmlVisibleText],
        scrollHeight: pageContext.scrollHeight || 0
    }, pageContext);
}

function looksLikeUrlText(value) {
    const text = String(value || '').trim();
    return !text || /^https?:\/\//i.test(text) || /^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(text);
}

function mergePageContexts(baseContext = {}, nextContext = {}) {
    const mergeTextList = (left = [], right = []) => [...left, ...right]
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index)
        .slice(0, 260);

    const mergeInteractiveElements = (left = [], right = []) => [...left, ...right]
        .filter((item) => item?.text)
        .filter((item, index, array) => array.findIndex((candidate) => candidate?.tag === item?.tag && candidate?.text === item?.text) === index)
        .slice(0, 40);

    return {
        title: nextContext.title || baseContext.title || '',
        description: nextContext.description || baseContext.description || '',
        headings: mergeTextList(baseContext.headings, nextContext.headings),
        interactiveElements: mergeInteractiveElements(baseContext.interactiveElements, nextContext.interactiveElements),
        visibleText: mergeTextList(baseContext.visibleText, nextContext.visibleText),
        scrollHeight: Math.max(baseContext.scrollHeight || 0, nextContext.scrollHeight || 0)
    };
}

async function performTaskSpecificInteractions(page, task, initialTitle, initialContext) {
    let pageTitle = initialTitle;
    let pageContext = initialContext;
    const screenshots = [];
    const navigationTrail = [];
    const taskProfile = buildTaskProfile(task);

    if (!taskProfile.searchQuery || !shouldAttemptInternalSearch(page.url(), taskProfile)) {
        return {
            pageTitle,
            pageContext,
            screenshots,
            navigationTrail
        };
    }

    let searchResult = await attemptInternalSiteSearch(page, taskProfile.searchQuery);
    if (!searchResult.success) {
        searchResult = await navigateToDirectSiteSearch(page, taskProfile.searchQuery);
    }

    if (!searchResult.success) {
        return {
            pageTitle,
            pageContext,
            screenshots,
            navigationTrail
        };
    }

    await wait(1000);
    await waitForReadableCapture(page);
    const searchContext = await collectRichPageContext(page);
    pageContext = mergePageContexts(pageContext, searchContext);
    pageTitle = searchContext.title || pageTitle || await page.title();

    screenshots.push(await captureScreenshot(
        page,
        `Busca: ${taskProfile.searchQuery}`,
        `Pesquisei internamente por ${taskProfile.searchQuery}.`
    ));

    navigationTrail.push({
        targetHint: `buscar ${taskProfile.searchQuery}`,
        success: true,
        matchedText: searchResult.inputLabel || taskProfile.searchQuery,
        href: page.url(),
        previousUrl: searchResult.previousUrl,
        currentUrl: page.url(),
        interactionType: 'internal-search',
        query: taskProfile.searchQuery
    });

    if (taskProfile.asksPrice || taskProfile.asksProducts) {
        const resultNavigation = await attemptProductResultNavigation(page, taskProfile.searchQuery);
        if (resultNavigation.success) {
            await wait(1000);
            await waitForReadableCapture(page);
            const productContext = await collectRichPageContext(page);
            pageContext = mergePageContexts(pageContext, productContext);
            pageTitle = productContext.title || pageTitle || await page.title();

            screenshots.push(await captureScreenshot(
                page,
                `Produto: ${resultNavigation.label || taskProfile.searchQuery}`,
                `Abri o resultado mais relevante para ${taskProfile.searchQuery}.`
            ));

            navigationTrail.push({
                targetHint: `abrir resultado de ${taskProfile.searchQuery}`,
                success: true,
                matchedText: resultNavigation.label || taskProfile.searchQuery,
                href: page.url(),
                previousUrl: resultNavigation.previousUrl,
                currentUrl: page.url(),
                interactionType: 'product-result',
                query: taskProfile.searchQuery
            });
        }
    }

    return {
        pageTitle,
        pageContext,
        screenshots,
        navigationTrail
    };
}

async function runAutonomousBrowserLoop(page, task, initialTitle, initialContext, priorTrail = []) {
    const taskProfile = buildTaskProfile(task);
    const shouldRunLoop = shouldRunAutonomousBrowserLoop(taskProfile, task, initialContext, priorTrail);

    if (!shouldRunLoop) {
        return {
            pageTitle: initialTitle,
            pageContext: initialContext,
            screenshots: [],
            navigationTrail: []
        };
    }

    let pageTitle = initialTitle;
    let pageContext = initialContext;
    const screenshots = [];
    const navigationTrail = [];
    const actionHistory = [];
    const maxSteps = taskProfile.asksPrice || taskProfile.asksProducts ? 4 : 3;

    for (let step = 1; step <= maxSteps; step += 1) {
        const state = await collectActionablePageState(page, pageContext);
        const nextAction = await decideNextBrowserAction(task, state, taskProfile, actionHistory);

        if (!nextAction || nextAction.action === 'finish') {
            break;
        }

        const actionResult = await executeBrowserAction(page, nextAction, step);
        actionHistory.push({
            step,
            action: nextAction.action,
            selector: nextAction.selector || '',
            text: nextAction.text || '',
            success: actionResult.success,
            note: actionResult.note || '',
            url: page.url()
        });

        if (!actionResult.success) {
            continue;
        }

        await wait(700);
        await waitForReadableCapture(page);

        const updatedContext = await collectRichPageContext(page);
        pageContext = mergePageContexts(pageContext, updatedContext);
        pageTitle = updatedContext.title || pageTitle || await page.title();

        screenshots.push(await captureScreenshot(
            page,
            `Ação ${step}: ${describeBrowserAction(nextAction)}`,
            actionResult.note || `Executei a ação ${nextAction.action}.`
        ));

        navigationTrail.push({
            targetHint: nextAction.action,
            success: true,
            matchedText: nextAction.selector || nextAction.text || nextAction.direction || nextAction.key || nextAction.action,
            href: page.url(),
            previousUrl: actionResult.previousUrl,
            currentUrl: page.url(),
            interactionType: 'autonomous-action',
            action: nextAction.action,
            selector: nextAction.selector || '',
            text: nextAction.text || ''
        });

        if (taskProfile.asksPrice && hasVisiblePriceInContext(pageContext)) {
            break;
        }
    }

    return {
        pageTitle,
        pageContext,
        screenshots,
        navigationTrail
    };
}

function shouldRunAutonomousBrowserLoop(taskProfile = {}, task = '', pageContext = {}, priorTrail = []) {
    const normalizedTask = normalizeSearchText(task);
    if (!normalizedTask) {
        return false;
    }

    if (hasVisiblePriceInContext(pageContext) || hasProductDetailsInContext(pageContext)) {
        return false;
    }

    const alreadySearched = Array.isArray(priorTrail) && priorTrail.some((step) => ['internal-search', 'product-result', 'autonomous-action'].includes(step?.interactionType));
    if (alreadySearched && !taskProfile.asksPrice && !taskProfile.asksProducts) {
        return false;
    }

    return taskProfile.asksPrice
        || taskProfile.asksProducts
        || /\b(clicar|digitar|pesquisar|procurar|buscar|rolar|descer|subir|abrir resultado|abrir produto)\b/i.test(normalizedTask);
}

async function collectActionablePageState(page, pageContext = {}) {
    const state = await page.evaluate(() => {
        const isVisible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 16
                && rect.height > 16
                && style.visibility !== 'hidden'
                && style.display !== 'none';
        };

        const buildSelector = (element) => {
            if (element.id) {
                return `#${CSS.escape(element.id)}`;
            }

            const dataTestId = element.getAttribute('data-testid');
            if (dataTestId) {
                return `[data-testid="${CSS.escape(dataTestId)}"]`;
            }

            const name = element.getAttribute('name');
            if (name) {
                return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
            }

            const ariaLabel = element.getAttribute('aria-label');
            if (ariaLabel) {
                return `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
            }

            const placeholder = element.getAttribute('placeholder');
            if (placeholder) {
                return `${element.tagName.toLowerCase()}[placeholder="${CSS.escape(placeholder)}"]`;
            }

            const href = element.getAttribute('href');
            if (href) {
                return `a[href="${CSS.escape(href)}"]`;
            }

            const parent = element.parentElement;
            if (!parent) {
                return element.tagName.toLowerCase();
            }

            const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
            const index = siblings.indexOf(element) + 1;
            return `${element.tagName.toLowerCase()}:nth-of-type(${Math.max(index, 1)})`;
        };

        const elements = Array.from(document.querySelectorAll('input, textarea, button, a[href], [role="button"], [role="searchbox"]'))
            .filter(isVisible)
            .map((element) => {
                const text = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('placeholder') || ''} ${element.getAttribute('title') || ''}`
                    .replace(/\s+/g, ' ')
                    .trim();

                return {
                    tag: element.tagName.toLowerCase(),
                    type: element.getAttribute('type') || '',
                    text,
                    selector: buildSelector(element)
                };
            })
            .filter((item) => item.selector && (item.text || item.tag === 'input' || item.tag === 'textarea'))
            .slice(0, 40);

        return {
            url: location.href,
            title: document.title || '',
            bodyText: String(document.body?.innerText || '')
                .split('\n')
                .map((line) => line.replace(/\s+/g, ' ').trim())
                .filter(Boolean)
                .slice(0, 120),
            elements
        };
    });

    return {
        ...state,
        bodyText: mergeTextLines(state.bodyText, pageContext.visibleText || []).slice(0, 140)
    };
}

async function decideNextBrowserAction(task, pageState = {}, taskProfile = {}, history = []) {
    if (!process.env.GROQ_API_KEY) {
        return decideHeuristicBrowserAction(task, pageState, taskProfile, history);
    }

    const systemPrompt = [
        'Voce controla um navegador real para cumprir tarefas na web.',
        'Responda SOMENTE com JSON valido.',
        'Acoes permitidas:',
        '{ "action": "click|type|press|scroll|wait|finish", "selector": "css opcional", "text": "texto opcional", "key": "tecla opcional", "direction": "down|up opcional", "reason": "motivo curto" }',
        'Regras:',
        '- use apenas seletores presentes na lista de elementos visiveis;',
        '- se a tarefa pedir produto/preco e houver campo de busca, prefira digitar nele;',
        '- se houver resultados de produto com o item pedido, clique em um resultado relevante;',
        '- se ja houver preco visivel e pagina de produto adequada, responda finish;',
        '- nunca invente seletor; se nada fizer sentido, use wait ou scroll.',
        '- escolha somente UMA proxima acao.'
    ].join('\n');

    const userPrompt = [
        `Tarefa: ${task}`,
        '',
        `URL atual: ${pageState.url || ''}`,
        `Titulo atual: ${pageState.title || ''}`,
        '',
        'Historico recente:',
        JSON.stringify(history.slice(-6), null, 2),
        '',
        'Texto visivel da pagina:',
        pageState.bodyText.slice(0, 60).join('\n'),
        '',
        'Elementos interativos visiveis:',
        JSON.stringify(pageState.elements.slice(0, 30), null, 2),
        '',
        'Qual e a proxima acao?'
    ].join('\n');

    try {
        const rawResponse = await callGroqBrowserDecision(systemPrompt, userPrompt);
        const parsed = extractJsonObject(rawResponse);
        if (parsed?.action) {
            return normalizeBrowserAction(parsed);
        }
    } catch (error) {
        console.error('Autonomous browser loop decision failed:', error.message);
    }

    return decideHeuristicBrowserAction(task, pageState, taskProfile, history);
}

function decideHeuristicBrowserAction(task, pageState = {}, taskProfile = {}, history = []) {
    const elements = Array.isArray(pageState.elements) ? pageState.elements : [];
    const normalizedTask = normalizeSearchText(task);
    const query = taskProfile.searchQuery || '';
    const historyActions = history.map((item) => item.action);

    if ((taskProfile.asksPrice || taskProfile.asksProducts) && query && !historyActions.includes('type')) {
        const searchField = elements.find((element) => /input|textarea/.test(element.tag) && /(busca|buscar|search|pesquisar|o que voce procura|pesquise)/i.test(element.text || element.selector));
        if (searchField) {
            return {
                action: 'type',
                selector: searchField.selector,
                text: query,
                reason: 'Preencher a busca interna do site.'
            };
        }
    }

    if ((taskProfile.asksPrice || taskProfile.asksProducts) && historyActions.includes('type') && !historyActions.includes('press')) {
        return {
            action: 'press',
            key: 'Enter',
            reason: 'Enviar a busca do produto.'
        };
    }

    const clickableProduct = elements.find((element) => {
        const normalizedText = normalizeSearchText(element.text || '');
        return element.tag === 'a'
            && /(iphone|galaxy|maquina de lavar|lava e seca|produto|comprar|detalhes)/i.test(normalizedText)
            && normalizedTask.split(' ').filter((token) => token.length > 2).some((token) => normalizedText.includes(token));
    });

    if (clickableProduct && !historyActions.includes('click')) {
        return {
            action: 'click',
            selector: clickableProduct.selector,
            reason: 'Abrir um resultado relevante do produto.'
        };
    }

    if (!historyActions.includes('scroll')) {
        return {
            action: 'scroll',
            direction: 'down',
            reason: 'Coletar mais resultados visiveis.'
        };
    }

    return {
        action: 'finish',
        reason: 'Nao identifiquei uma proxima acao confiavel.'
    };
}

async function callGroqBrowserDecision(systemPrompt, userPrompt) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ],
            max_tokens: 300,
            temperature: 0.1
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `Groq browser decision failed with ${response.status}`);
    }

    return extractMessageText(data.choices?.[0]?.message?.content);
}

function normalizeBrowserAction(action = {}) {
    return {
        action: String(action.action || '').trim().toLowerCase(),
        selector: String(action.selector || '').trim(),
        text: String(action.text || '').trim(),
        key: String(action.key || '').trim(),
        direction: String(action.direction || '').trim().toLowerCase(),
        reason: String(action.reason || '').trim()
    };
}

async function executeBrowserAction(page, action = {}, step = 0) {
    const previousUrl = page.url();

    try {
        if (action.action === 'click' && action.selector) {
            await page.click(action.selector, { timeout: 5000 });
            await waitForPossibleNavigation(page, previousUrl);
            return { success: true, previousUrl, note: action.reason || `Cliquei em ${action.selector}.` };
        }

        if (action.action === 'type' && action.selector) {
            await page.focus(action.selector);
            await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                if (element && 'value' in element) {
                    element.value = '';
                }
            }, action.selector);
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyA');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await page.type(action.selector, action.text || '', { delay: 30 });
            return { success: true, previousUrl, note: action.reason || `Digitei "${action.text}".` };
        }

        if (action.action === 'press') {
            await page.keyboard.press(action.key || 'Enter');
            await waitForPossibleNavigation(page, previousUrl);
            return { success: true, previousUrl, note: action.reason || `Pressionei ${action.key || 'Enter'}.` };
        }

        if (action.action === 'scroll') {
            const direction = action.direction === 'up' ? -1 : 1;
            await page.evaluate((sign) => {
                window.scrollBy({ top: sign * Math.max(window.innerHeight * 0.8, 480), behavior: 'auto' });
            }, direction);
            return { success: true, previousUrl, note: action.reason || `Rolei a página para ${action.direction || 'down'}.` };
        }

        if (action.action === 'wait') {
            await wait(1200);
            return { success: true, previousUrl, note: action.reason || 'Esperei a página estabilizar.' };
        }
    } catch (error) {
        return {
            success: false,
            previousUrl,
            note: error.message || `Falha na ação ${action.action || `#${step}`}.`
        };
    }

    return {
        success: false,
        previousUrl,
        note: `Ação não suportada: ${action.action || 'desconhecida'}.`
    };
}

function describeBrowserAction(action = {}) {
    if (action.action === 'type') {
        return 'digitar na busca';
    }

    if (action.action === 'click') {
        return 'abrir resultado';
    }

    if (action.action === 'press') {
        return `tecla ${action.key || 'Enter'}`;
    }

    if (action.action === 'scroll') {
        return `rolagem ${action.direction || 'down'}`;
    }

    return action.action || 'acao';
}

function hasVisiblePriceInContext(pageContext = {}) {
    const visibleText = Array.isArray(pageContext?.visibleText) ? pageContext.visibleText : [];
    return visibleText.some((item) => /R\$\s*[\d\.\,]+/i.test(String(item || '')));
}

function hasProductDetailsInContext(pageContext = {}) {
    const visibleText = Array.isArray(pageContext?.visibleText) ? pageContext.visibleText : [];
    const combined = visibleText.join(' ');
    return /R\$\s*[\d\.\,]+/i.test(combined)
        && /(comprar|adicionar ao carrinho|em estoque|parcelado|a vista|pix)/i.test(combined);
}

function mergeTextLines(left = [], right = []) {
    return [...left, ...right]
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index);
}

function buildTaskProfile(task) {
    const normalized = normalizeSearchText(task);

    return {
        normalized,
        searchQuery: extractSiteSearchQuery(task),
        asksPrice: /\b(preco|precos|price|valor|mais barato|loja|lojas|a vista|avista|pix)\b/i.test(normalized),
        asksProducts: /\b(iphone|galaxy|produto|produtos|tenis|notebook|tv|smartphone|celular)\b/i.test(normalized),
        asksModels: /\b(modelo|modelos|models)\b/i.test(normalized)
    };
}

function shouldAttemptInternalSearch(currentUrl, taskProfile = {}) {
    const host = safeAgentHostname(currentUrl);
    if (taskProfile.asksPrice || taskProfile.asksProducts) {
        return true;
    }

    if (taskProfile.asksModels && /amazon|magazineluiza|magalu|mercadolivre|casasbahia|kabum|fastshop/i.test(host)) {
        return false;
    }

    return /\b(pesquise|procure|busque|search)\b/i.test(taskProfile.normalized || '');
}

function extractSiteSearchQuery(task) {
    const source = String(task || '').replace(/https?:\/\/\S+/gi, ' ').replace(/\bwww\.[^\s]+/gi, ' ');
    const quoted = source.match(/["â€œâ€']([^"â€œâ€']{2,80})["â€œâ€']/);
    if (quoted?.[1]) {
        return quoted[1].trim();
    }

    const patterns = [
        /\bpre[cç]o d[oa]\s+(.+?)(?=\s+(?:em|no|na|nas|considerando|com|hoje)\b|$)/i,
        /\bvalor d[oa]\s+(.+?)(?=\s+(?:em|no|na|nas|considerando|com|hoje)\b|$)/i,
        /\bprocurar\s+(.+?)(?=\s+(?:no|na|nas|em|site|loja|e\b|para\b)\b|$)/i,
        /\bbuscar\s+(.+?)(?=\s+(?:no|na|nas|em|site|loja|e\b|para\b)\b|$)/i,
        /\bpesquisar\s+(.+?)(?=\s+(?:no|na|nas|em|site|loja|e\b|para\b)\b|$)/i,
        /\bpesquise(?: por)?\s+(.+?)(?=\s+(?:no|na|nas|em|site|loja)\b|$)/i,
        /\bprocure(?: por)?\s+(.+?)(?=\s+(?:no|na|nas|em|site|loja)\b|$)/i,
        /\bbusque(?: por)?\s+(.+?)(?=\s+(?:no|na|nas|em|site|loja)\b|$)/i,
        /\bencontre\s+(.+?)(?=\s+(?:em|no|na|nas|site|loja)\b|$)/i
    ];

    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match?.[1]) {
            return sanitizeInternalSearchQuery(match[1]);
        }
    }

    const productLike = source.match(/\b(iPhone\s+\d+[^\.,;\n]*|Galaxy\s+[A-Za-z0-9+ -]+|MacBook[^\.,;\n]*|PlayStation\s*\d[^\.,;\n]*|m[aá]quina\s+de\s+lavar[^\.,;\n]*|lava\s+e\s+seca[^\.,;\n]*)/i);
    if (productLike?.[1]) {
        return sanitizeInternalSearchQuery(productLike[1]);
    }

    return '';
}

function sanitizeInternalSearchQuery(value) {
    return String(value || '')
        .replace(/\b(ex:\s*.+)$/i, '')
        .replace(/\b(pre[cç]o(?:s)?|valor)\s+d[oa]s?\s+/gi, ' ')
        .replace(/\b(considerando|hoje|valor|a vista|avista|pix|boleto)\b/gi, ' ')
        .replace(/^(o|a|os|as|um|uma|do|da|dos|das)\s+/i, '')
        .replace(/[()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
}

async function attemptInternalSiteSearch(page, query) {
    const previousUrl = page.url();
    const previousSignature = await page.evaluate(() => `${location.href}\n${document.title}\n${(document.body?.innerText || '').slice(0, 800)}`);
    const expanded = await expandSearchInterface(page);
    if (expanded) {
        await wait(500);
    }

    const searchField = await findBestSearchField(page);
    if (!searchField) {
        return { success: false, previousUrl };
    }

    try {
        await page.focus(searchField.selector);
    } catch {
        // continue with DOM eval fallback
    }

    await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
            element.focus();
            if ('value' in element) {
                element.value = '';
            }
        }
    }, searchField.selector);

    try {
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
    } catch {
        // ignore keyboard selection failures
    }

    await page.type(searchField.selector, query, { delay: 35 });

    try {
        await page.keyboard.press('Enter');
    } catch {
        // ignore
    }

    await waitForPossibleNavigation(page, previousUrl);

    if (page.url() === previousUrl) {
        const clickedSubmit = await clickSearchSubmit(page, query);
        if (clickedSubmit) {
            await waitForPossibleNavigation(page, previousUrl);
        }
    }

    const nextSignature = await page.evaluate(() => `${location.href}\n${document.title}\n${(document.body?.innerText || '').slice(0, 800)}`);
    const queryTokens = sanitizeInternalSearchQuery(query)
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length > 1);
    const searchEchoFound = await page.evaluate((tokens) => {
        const bodyText = String(document.body?.innerText || '').toLowerCase();
        return tokens.length > 0 && tokens.every((token) => bodyText.includes(token));
    }, queryTokens);

    return {
        success: page.url() !== previousUrl || nextSignature !== previousSignature || searchEchoFound,
        previousUrl,
        inputLabel: searchField.label || 'campo de busca'
    };
}

async function navigateToDirectSiteSearch(page, query) {
    const previousUrl = page.url();
    const directSearchUrl = buildDirectSiteSearchUrl(previousUrl, query);

    if (!directSearchUrl || directSearchUrl === previousUrl) {
        return {
            success: false,
            previousUrl
        };
    }

    try {
        await page.goto(directSearchUrl, {
            waitUntil: 'networkidle2',
            timeout: 45000
        });
        await wait(900);
        await waitForReadableCapture(page);

        return {
            success: true,
            previousUrl,
            inputLabel: 'busca direta no site',
            directUrl: directSearchUrl
        };
    } catch {
        return {
            success: false,
            previousUrl
        };
    }
}

function buildDirectSiteSearchUrl(currentUrl, query) {
    const host = safeAgentHostname(currentUrl);
    const sanitizedQuery = sanitizeInternalSearchQuery(query);
    if (!host || !sanitizedQuery) {
        return '';
    }

    const encodedQuery = encodeURIComponent(sanitizedQuery);
    const slugQuery = slugifySiteSearchTerm(sanitizedQuery);

    if (/magazineluiza|magalu/i.test(host)) {
        return `https://www.magazineluiza.com.br/busca/${slugQuery}/`;
    }

    if (/amazon\.com\.br|amazon/i.test(host)) {
        return `https://www.amazon.com.br/s?k=${encodedQuery}`;
    }

    if (/mercadolivre/i.test(host)) {
        return `https://lista.mercadolivre.com.br/${slugQuery}`;
    }

    return '';
}

function slugifySiteSearchTerm(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

async function expandSearchInterface(page) {
    return page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const candidate = buttons.find((element) => {
            const text = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''}`.toLowerCase();
            const rect = element.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0;
            return visible && /(buscar|busca|search|pesquisar|lupa)/i.test(text);
        });

        if (candidate) {
            candidate.click();
            return true;
        }

        return false;
    });
}

async function findBestSearchField(page) {
    const host = safeAgentHostname(page.url());
    const preferredSelectors = [];

    if (/magazineluiza|magalu/i.test(host)) {
        preferredSelectors.push('input[data-testid="input-search"]', 'input[placeholder*="Busca no Magalu" i]');
    }

    if (/amazon/i.test(host)) {
        preferredSelectors.push('#twotabsearchtextbox', 'input[name="field-keywords"]');
    }

    for (const selector of preferredSelectors) {
        try {
            const candidate = await page.$eval(selector, (element, currentSelector) => {
                const rect = element.getBoundingClientRect();
                const visible = rect.width > 80 && rect.height > 20;
                if (!visible) {
                    return null;
                }

                const label = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('placeholder') || ''} ${element.getAttribute('name') || ''} ${element.getAttribute('id') || ''}`
                    .replace(/\s+/g, ' ')
                    .trim();

                return {
                    selector: currentSelector,
                    label
                };
            }, selector);

            if (candidate?.selector) {
                return candidate;
            }
        } catch {
            // keep generic fallback
        }
    }

    const candidates = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, textarea, [role="searchbox"]'))
            .map((element) => {
                const rect = element.getBoundingClientRect();
                const visible = rect.width > 80 && rect.height > 20;
                const text = `${element.getAttribute('aria-label') || ''} ${element.getAttribute('placeholder') || ''} ${element.getAttribute('name') || ''} ${element.getAttribute('id') || ''} ${element.getAttribute('type') || ''}`;
                let selector = '';

                if (element.id) {
                    selector = `#${CSS.escape(element.id)}`;
                } else if (element.name) {
                    selector = `${element.tagName.toLowerCase()}[name="${element.name}"]`;
                } else {
                    selector = element.tagName.toLowerCase();
                }

                return {
                    selector,
                    label: text.replace(/\s+/g, ' ').trim(),
                    visible,
                    score: /(search|buscar|busca|pesquisar|produto|o que voce procura|o que vocÃª procura)/i.test(text) ? 20 : 0
                        + (/search/i.test(element.getAttribute('type') || '') ? 12 : 0)
                        + (rect.width > 200 ? 4 : 0)
                };
            })
            .filter((item) => item.visible && item.selector);
    });

    return candidates.sort((left, right) => right.score - left.score)[0] || null;
}

async function clickSearchSubmit(page, query) {
    return page.evaluate((searchQuery) => {
        const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]'));
        const candidate = buttons.find((element) => {
            const text = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.getAttribute('value') || ''}`.toLowerCase();
            const rect = element.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0;
            return visible && /(buscar|busca|search|pesquisar|ok|ir)/i.test(text);
        });

        if (candidate) {
            candidate.click();
            return true;
        }

        const forms = Array.from(document.querySelectorAll('form'));
        const form = forms.find((element) => element.innerText.toLowerCase().includes(searchQuery.toLowerCase()) || element.querySelector('input[type="search"], input[name*="search" i], input[placeholder*="buscar" i]'));
        if (form) {
            form.requestSubmit?.();
            return true;
        }

        return false;
    }, query);
}

async function attemptProductResultNavigation(page, query) {
    const previousUrl = page.url();
    const previousSignature = await page.evaluate(() => `${location.href}\n${document.title}\n${(document.body?.innerText || '').slice(0, 1200)}`);
    const queryTokens = sanitizeInternalSearchQuery(query)
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length > 1)
        .slice(0, 8);

    const candidate = await findBestProductResultCandidate(page, queryTokens);

    if (!candidate) {
        return { success: false, previousUrl, label: '' };
    }

    let navigationTriggered = false;
    if (candidate.selector) {
        try {
            await page.click(candidate.selector);
            navigationTriggered = true;
        } catch {
            navigationTriggered = false;
        }
    }

    await waitForPossibleNavigation(page, previousUrl);

    if (page.url() === previousUrl && candidate.href && candidate.href !== previousUrl) {
        try {
            await page.goto(candidate.href, {
                waitUntil: 'networkidle2',
                timeout: 45000
            });
            navigationTriggered = true;
        } catch {
            // keep best-effort flow
        }
    }

    const nextSignature = await page.evaluate(() => `${location.href}\n${document.title}\n${(document.body?.innerText || '').slice(0, 1200)}`);

    return {
        success: page.url() !== previousUrl || nextSignature !== previousSignature,
        previousUrl,
        label: candidate.text || query
    };
}

async function findBestProductResultCandidate(page, queryTokens = []) {
    return page.evaluate((tokens) => {
        const cardSelectors = [
            '[data-testid*="product" i]',
            '[data-component-type="s-search-result"]',
            'article',
            'li',
            '.product-card',
            '.sc-kpOJdX',
            '.sc-dcJsrY'
        ];

        const seenLinks = new Set();
        const candidates = [];

        const collectCandidate = (anchor, container) => {
            if (!anchor) {
                return;
            }

            const href = anchor.href || anchor.getAttribute('href') || '';
            const rect = anchor.getBoundingClientRect();
            const visible = rect.width > 40 && rect.height > 16;
            if (!href || !visible) {
                return;
            }

            const containerText = String(container?.innerText || anchor.textContent || anchor.getAttribute('aria-label') || anchor.getAttribute('title') || '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!containerText || seenLinks.has(href)) {
                return;
            }

            seenLinks.add(href);

            const normalizedText = containerText.toLowerCase();
            const tokenHits = tokens.reduce((score, token) => (
                normalizedText.includes(token) ? score + 3 : score
            ), 0);
            const priceSignals = /r\$\s*[\d\.\,]+/i.test(containerText) ? 10 : 0;
            const productSignals = /(iphone|galaxy|macbook|playstation|smartphone|celular|notebook|lava|lavar|geladeira|tv|console)/i.test(containerText) ? 6 : 0;
            const hrefSignals = /\/(?:p\/|dp\/|produto|product)/i.test(href) ? 5 : 0;
            const detailSignals = /(comprar|ver detalhes|detalhes|saiba mais)/i.test(containerText) ? 2 : 0;
            const penalty = /(categoria|departamento|oferta do dia|cupom|cartao|login|entrar|cadastro|atendimento|ajuda)/i.test(containerText) ? 10 : 0;
            const score = tokenHits + priceSignals + productSignals + hrefSignals + detailSignals - penalty;

            if (score <= 0) {
                return;
            }

            let selector = '';
            if (anchor.id) {
                selector = `#${CSS.escape(anchor.id)}`;
            } else if (anchor.getAttribute('data-testid')) {
                selector = `[data-testid="${CSS.escape(anchor.getAttribute('data-testid'))}"]`;
            } else if (anchor.getAttribute('href')) {
                selector = `a[href="${CSS.escape(anchor.getAttribute('href'))}"]`;
            }

            candidates.push({
                href,
                selector,
                text: containerText.slice(0, 220),
                score
            });
        };

        cardSelectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((container) => {
                const anchor = container.matches?.('a[href]') ? container : container.querySelector('a[href]');
                collectCandidate(anchor, container);
            });
        });

        if (!candidates.length) {
            document.querySelectorAll('main a[href], article a[href], h2 a[href], h3 a[href], a[href]').forEach((anchor) => {
                collectCandidate(anchor, anchor.closest('article, li, div, section') || anchor);
            });
        }

        return candidates.sort((left, right) => right.score - left.score)[0] || null;
    }, queryTokens);
}

async function collectScrollableSnapshots(page, initialContext, initialTitle, task) {
    const scrollMeta = await resolveScrollableViewport(page);

    const maxScrollTop = Math.max(0, scrollMeta.scrollHeight - scrollMeta.viewportHeight);
    const wantsDeepScan = /modelo|modelos|models|lista|todos|catalogo|downloads|release|pricing|planos|produtos|produto|preco|precos|price|busca|search|iphone|galaxy|notebook|lava|lavar/i.test(task || '');
    const minimumScrollThreshold = wantsDeepScan ? 80 : scrollMeta.viewportHeight * 0.35;

    if (maxScrollTop < minimumScrollThreshold) {
        return {
            pageContext: initialContext,
            pageTitle: initialTitle,
            screenshots: []
        };
    }

    const extraSteps = wantsDeepScan
        ? Math.min(4, Math.max(1, Math.ceil(maxScrollTop / Math.max(scrollMeta.viewportHeight * 0.7, 1))))
        : Math.min(2, Math.ceil(maxScrollTop / scrollMeta.viewportHeight));

    let mergedContext = initialContext;
    let pageTitle = initialTitle;
    const screenshots = [];

    for (let step = 1; step <= extraSteps; step += 1) {
        const top = Math.round((maxScrollTop * step) / extraSteps);
        await scrollViewportTo(page, top);
        await waitForReadableCapture(page);

        const stepContext = await collectRichPageContext(page);
        mergedContext = mergePageContexts(mergedContext, stepContext);
        pageTitle = stepContext.title || pageTitle || await page.title();

        screenshots.push(await captureScreenshot(
            page,
            `Rolagem ${step}`,
            `Rolei a pÃ¡gina para capturar mais conteÃºdo visÃ­vel (${step}/${extraSteps}).`
        ));
    }

    return {
        pageContext: mergedContext,
        pageTitle,
        screenshots
    };
}

async function resolveScrollableViewport(page) {
    return page.evaluate(() => {
        document.querySelectorAll('[data-drekee-scroll-target="true"]').forEach((element) => {
            element.removeAttribute('data-drekee-scroll-target');
        });

        const candidates = [document.scrollingElement, ...document.querySelectorAll('main, [role="main"], article, section, div')];
        const rankedCandidates = candidates
            .filter(Boolean)
            .map((element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                const clientHeight = element.clientHeight || rect.height || 0;
                const scrollHeight = element.scrollHeight || 0;
                const maxScroll = Math.max(0, scrollHeight - clientHeight);
                const isDocument = element === document.scrollingElement;
                const scrollable = isDocument || /(auto|scroll)/i.test(style.overflowY || '');
                const matchesMain = element.matches?.('main, [role="main"], article') ? 1 : 0;
                const score = maxScroll + rect.width + (matchesMain * 600);

                return {
                    element,
                    clientHeight,
                    scrollHeight,
                    maxScroll,
                    scrollable,
                    isDocument,
                    score,
                    visible: rect.width > 300 && clientHeight > 200
                };
            })
            .filter((candidate) => candidate.scrollable && candidate.maxScroll > 0 && candidate.visible)
            .sort((left, right) => right.score - left.score);

        const target = rankedCandidates[0];
        if (target && !target.isDocument) {
            target.element.setAttribute('data-drekee-scroll-target', 'true');
        }

        if (target) {
            return {
                viewportHeight: target.clientHeight,
                scrollHeight: target.scrollHeight,
                usesWindow: target.isDocument
            };
        }

        return {
            viewportHeight: window.innerHeight || 1024,
            scrollHeight: Math.max(
                document.body?.scrollHeight || 0,
                document.documentElement?.scrollHeight || 0
            ),
            usesWindow: true
        };
    });
}

async function scrollViewportTo(page, top) {
    await page.evaluate((scrollTop) => {
        const target = document.querySelector('[data-drekee-scroll-target="true"]');
        if (target) {
            target.scrollTo({ top: scrollTop, behavior: 'auto' });
            return;
        }

        window.scrollTo({ top: scrollTop, behavior: 'auto' });
    }, top);
}

async function resetScrollableViewport(page) {
    await page.evaluate(() => {
        const target = document.querySelector('[data-drekee-scroll-target="true"]');
        if (target) {
            target.scrollTo({ top: 0, behavior: 'auto' });
        } else {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }
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
        .replace(/\s+e\s+(?:cite|me|liste|mostre|diga|traga)\b[\s\S]*$/i, '')
        .replace(/\s+para\s+(?:me|listar|citar|mostrar|trazer)\b[\s\S]*$/i, '')
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
        'preÃ§os': ['pricing', 'price', 'plans'],
        'preÃ§o': ['pricing', 'price', 'plans'],
        inicio: ['home'],
        'documentaÃ§Ã£o': ['docs', 'documentation'],
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

function pageAlreadyMatchesHint(currentUrl, pageTitle, pageContext, hint) {
    const haystack = normalizeSearchText([
        currentUrl || '',
        pageTitle || '',
        pageContext?.title || '',
        pageContext?.description || '',
        ...(pageContext?.headings || [])
    ].join(' '));
    const wholeHint = normalizeSearchText(hint);
    const hintTokens = expandNavigationTokens(hint);
    const matchedTokens = hintTokens.filter((token) => haystack.includes(token));

    return Boolean(
        (wholeHint && haystack.includes(wholeHint))
        || matchedTokens.length >= Math.min(2, hintTokens.length)
    );
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
    const htmlVisibleText = extractVisibleTextFromHtml(html, 120);

    return {
        title,
        description,
        headings,
        visibleText: [...headings, description, ...htmlVisibleText].filter(Boolean),
        interactiveElements: [...links, ...buttons].slice(0, 12).map((text) => ({
            tag: 'interactive',
            text
        }))
    };
}

function extractVisibleTextFromHtml(html, limit = 220) {
    const source = String(html || '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<\/(p|div|section|article|main|header|footer|li|ul|ol|h1|h2|h3|h4|h5|h6|tr|td|th|br)>/gi, '\n');

    return source
        .split(/\n+/)
        .flatMap((line) => decodeHtml(stripTags(line)).split(/\s{2,}/))
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line.length > 1)
        .filter((line, index, array) => array.indexOf(line) === index)
        .slice(0, limit);
}

function extractMessageText(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (typeof item === 'string') {
                    return item;
                }

                if (item?.type === 'text') {
                    return item.text || '';
                }

                return '';
            })
            .join('\n')
            .trim();
    }

    return '';
}

function extractJsonObject(rawText) {
    if (typeof rawText !== 'string') {
        return null;
    }

    const trimmed = rawText.trim();
    if (!trimmed) {
        return null;
    }

    const withoutFence = trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const direct = tryParseJson(withoutFence);
    if (direct) {
        return direct;
    }

    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        return tryParseJson(withoutFence.slice(start, end + 1));
    }

    return null;
}

function tryParseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
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

    try {
        await page.waitForFunction(() => {
            const bodyText = String(document.body?.innerText || '').replace(/\s+/g, ' ').trim();
            if (bodyText.length >= 120) {
                return true;
            }

            return Boolean(
                document.querySelector('main h1, main h2, article h1, article h2, h1, h2, p, li')
            );
        }, { timeout: 6000 });
    } catch {
        // Some sites stay sparse; keep the flow moving and rely on HTML fallback extraction.
    }

    await wait(500);
}

const AGENT_SEARCH_STOP_WORDS = new Set([
    'entre',
    'entra',
    'acesse',
    'abra',
    'navegue',
    'pagina',
    'site',
    'cite',
    'diga',
    'mostre',
    'me',
    'para',
    'com',
    'uma',
    'uns',
    'umas',
    'que',
    'dos',
    'das',
    'do',
    'da',
    'de',
    'no',
    'na',
    'os',
    'as',
    'por',
    'ate',
    'vai',
    'va'
]);

const KNOWN_AGENT_DOMAINS = {
    python: 'https://www.python.org',
    groq: 'https://groq.com',
    openai: 'https://openai.com',
    nike: 'https://www.nike.com.br'
};

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}




