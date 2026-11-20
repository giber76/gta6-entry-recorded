// serve.ts — tiny static dev server for Solara Bay.
// Serves the game/ directory at http://localhost:8080/ so the play-test
// (and a human) can load it. Run with:
//   npx tsx serve.ts [port]
// or, if tsx is unavailable, with plain node after stripping types:
//   node --experimental-strip-types serve.ts [port]
// Plain `node serve.ts` also works on Node >= 22 because this file uses
// no TypeScript-only syntax beyond type annotations on locals.

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'game');
const port = Number(process.argv[2] || 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ts': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
    let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found: ' + urlPath);
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  }
});

server.listen(port, () => {
  console.log('Solara Bay serving ' + root + ' at http://localhost:' + port + '/');
});
