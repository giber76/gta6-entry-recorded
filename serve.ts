// serve.ts — tiny static dev server for Solara Bay.
// Serves a directory (default: game/) at the root so the play-test can
// open the game at http://localhost:8080/ and play it.
import { createServer } from 'node:http';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), 'game');
const PORT = Number(process.argv[3] || 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let path = join(ROOT, url === '/' ? 'index.html' : url);
  if (!path.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  try {
    if (existsSync(path) && lstatSync(path).isDirectory()) path = join(path, 'index.html');
    const body = readFileSync(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Solara Bay dev server: http://localhost:${PORT}/ (root ${ROOT})`);
});
