import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const allowed = new Set(['/index.html', '/src/app.js', '/src/tasks.js', '/src/styles.css']);
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/' ? '/index.html' : pathname;
  if (!allowed.has(file) || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  try {
    const data = await readFile(path.join(root, file));
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end('Unable to load file'); }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log(`Little Day running on port ${server.address().port}`));
