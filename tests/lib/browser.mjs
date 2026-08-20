// Launches Chromium and serves the CDN modules from node_modules so the suite
// runs offline and always tests the exact pinned versions.
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function fulfillFromNodeModules(route, url) {
    // https://cdn.jsdelivr.net/npm/<pkg>[@<version>]/<rest>  ->  node_modules/<pkg>/<rest>
    const m = /\/npm\/((?:@[^/]+\/)?[^/@]+)(?:@[^/]+)?\/(.+)$/.exec(new URL(url).pathname);
    if (!m) return route.abort();
    try {
        const body = await readFile(path.join(ROOT, 'node_modules', m[1], m[2]));
        await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
    } catch (err) {
        await route.abort();
    }
}

// The image ships a pre-installed Chromium that may not match the browser
// revision this Playwright build expects, so fall back to whatever is there.
async function launchOptions() {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (!base || !existsSync(base)) return {};
    const dirs = (await readdir(base)).filter(d => d.startsWith('chromium-')).sort();
    for (const dir of dirs.reverse()) {
        const exe = path.join(base, dir, 'chrome-linux', 'chrome');
        if (existsSync(exe)) return { executablePath: exe };
    }
    return {};
}

export async function openApp(baseUrl) {
    let browser;
    try {
        browser = await chromium.launch();
    } catch {
        browser = await chromium.launch(await launchOptions());
    }
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await context.route('https://cdn.jsdelivr.net/**', (route) => fulfillFromNodeModules(route, route.request().url()));

    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__app !== undefined, null, { timeout: 15000 });

    return { browser, page, consoleErrors };
}
