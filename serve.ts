// Tiny static server for the game: serves game/ at http://localhost:8080.
// Standard library only. Run from the repository root: `node serve.ts`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), 'game');
const PORT = 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const target = resolve(join(gameDir, normalize(path).replace(/^(\.\.[/\\])+/, '')));
  if (!target.startsWith(gameDir + sep) && target !== gameDir) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  let file = target;
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(target, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`serving game/ at http://localhost:${PORT}`);
});
