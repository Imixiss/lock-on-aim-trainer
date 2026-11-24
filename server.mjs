import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(root, 'public');
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '127.0.0.1';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const vendorFiles = {
      '/vendor/three.module.js': resolve(root, 'node_modules/three/build/three.module.js'),
      '/vendor/three.core.js': resolve(root, 'node_modules/three/build/three.core.js'),
    };
    const vendorPath = vendorFiles[pathname] || null;
    const filePath = vendorPath || (pathname === '/'
      ? resolve(publicDir, 'index.html')
      : resolve(publicDir, `.${pathname}`));

    if (!vendorPath && filePath !== publicDir && !filePath.startsWith(`${publicDir}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 400;
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(status === 404 ? 'Not found' : 'Bad request');
  }
}).listen(port, host, () => {
  console.log(`LOCK/ON is ready at http://${host}:${port}`);
});
