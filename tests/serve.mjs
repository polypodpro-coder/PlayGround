// Local dev server: `npm run serve`, then open the printed URL.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './lib/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { url } = await startServer(root);
console.log(`Serving ${root} at ${url}`);
