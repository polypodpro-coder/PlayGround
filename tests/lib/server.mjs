// Tiny static file server used to serve the app to the headless browser.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

export function startServer(root) {
    const server = http.createServer(async (req, res) => {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
        const file = path.join(root, rel);
        if (!file.startsWith(root)) {
            res.writeHead(403).end('forbidden');
            return;
        }
        try {
            const body = await readFile(file);
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
            res.end(body);
        } catch {
            res.writeHead(404).end('not found');
        }
    });

    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise(r => server.close(r)) });
        });
    });
}
