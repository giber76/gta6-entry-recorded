// serve.ts — a tiny static file server for local play-testing of Solara Bay.
// Serves the game/ folder at the root on port 8080 (or PORT, or the first
// command-line argument). Dev convenience only; the entry itself is
// served by the make.fun runner. Point the screenshot script at this server.
// static files and makes no network requests.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const docRoot = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const listenPort = Number(process.env.PORT ?? process.argv[2] ?? 8080);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

// Resolve a request path to a file inside the doc root, or null if it
// would escape the root (path traversal).
function resolveFile(requestPath: string): string | null {
  const target = normalize(join(docRoot, decodeURIComponent(requestPath.split('?')[0] ?? '/')));
  if (!target.startsWith(docRoot)) return null;
  if (target.endsWith('/') || target === docRoot) return join(target, 'index.html');
  return target;
}

function mimeFor(file: string): string {
  return MIME_TYPES[extname(file)] ?? 'application/octet-stream';
}

const server = createServer(async (req, res) => {
  const file = resolveFile(req.url ?? '/');
  if (file === null) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  let body: Buffer;
  try {
    body = await readFile(file);
  } catch {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': mimeFor(file) });
  res.end(body);
});

server.listen(listenPort, () => {
  console.log(`Solara Bay at http://localhost:${listenPort}/`);
});
