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
    const normalizedUrl = normalizeUrl(rawUrl);

    if (!normalizedUrl) {
        return res.status(400).json({ error: 'Invalid or missing URL' });
    }

    let browser;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);
        await page.goto(normalizedUrl, {
            waitUntil: 'networkidle2',
            timeout: 45000
        });

        await wait(1200);

        const pageContext = await collectPageContext(page);
        const screenshots = [];

        screenshots.push(await captureScreenshot(page, 'Homepage carregada', 'Acabei de abrir o site.'));

        if (pageContext.scrollHeight > VIEWPORT.height * 1.4) {
            await page.evaluate(() => {
                window.scrollTo({
                    top: Math.max(window.innerHeight * 0.9, 700),
                    behavior: 'instant'
                });
            });
            await wait(900);
            screenshots.push(await captureScreenshot(page, 'Trecho abaixo da dobra', 'Rolei a pagina para inspecionar mais conteudo.'));
        }

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

        return res.status(200).json({
            requestedUrl: normalizedUrl,
            currentUrl: page.url(),
            title: await page.title(),
            page: pageContext,
            screenshots
        });
    } catch (error) {
        console.error('Agent browser error:', error);
        return res.status(500).json({ error: error.message || 'Failed to browse URL' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
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

        return {
            title: document.title || '',
            description: metaDescription,
            headings,
            interactiveElements,
            scrollHeight: Math.max(
                document.body?.scrollHeight || 0,
                document.documentElement?.scrollHeight || 0
            )
        };
    });
}

async function captureScreenshot(page, label, note) {
    const base64 = await page.screenshot({
        type: 'jpeg',
        quality: 72,
        encoding: 'base64',
        fullPage: false
    });

    return {
        label,
        note,
        dataUrl: `data:image/jpeg;base64,${base64}`
    };
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
