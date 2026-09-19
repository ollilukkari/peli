import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const publicFiles = new Set([
  'index.html', 'style.css', 'manifest.webmanifest', 'sw.js',
  'src/main.js', 'src/game.js', 'src/render.js', 'src/audio.js', 'src/kvlt-music.js', 'src/pwa.js',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/audio/frozen-minor.mp3', 'assets/audio/summer-platformer.mp3',
  'assets/audio/kalm-mjork.mp3', 'assets/audio/zab-petting.mp3',
]);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
};

let host = '127.0.0.1';
let port = 4173;
for (let index = 2; index < process.argv.length; index += 2) {
  const option = process.argv[index];
  const value = process.argv[index + 1];
  if (option === '--host' && value) host = value;
  else if (option === '--port' && /^\d+$/.test(value ?? '')) port = Number(value);
  else throw new Error('Käyttö: npm start -- [--host 127.0.0.1] [--port 4173]');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Portin on oltava kokonaisluku väliltä 1–65535.');
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  const finish = (code, body) => {
    response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : body);
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    finish(405, 'Menetelmä ei ole sallittu.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent((request.url ?? '').split('?')[0]);
  } catch {
    finish(400, 'Virheellinen osoite.');
    return;
  }
  // Validate before URL or filesystem normalization can erase traversal segments.
  if (!pathname.startsWith('/') || /[\\\x00-\x1f\x7f%]/.test(pathname)
    || pathname.split('/').some((segment) => segment === '..' || segment === '.')) {
    finish(400, 'Virheellinen polku.');
    return;
  }
  const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!publicFiles.has(filename)) {
    finish(404, 'Tiedostoa ei löydy.');
    return;
  }

  try {
    const actualPath = await realpath(resolve(root, filename));
    const withinRoot = relative(root, actualPath);
    if (!withinRoot || withinRoot === '..' || withinRoot.startsWith(`..${sep}`)
      || resolve(root, withinRoot) !== actualPath) {
      finish(403, 'Polku ei ole sallittu.');
      return;
    }
    const content = await readFile(actualPath);
    if (extname(filename) === '.mp3') response.setHeader('Accept-Ranges', 'bytes');
    if (extname(filename) === '.mp3' && request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      const size = content.length;
      const start = match?.[1] ? Number(match[1]) : match?.[2] ? Math.max(0, size - Number(match[2])) : NaN;
      const end = match?.[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
        response.setHeader('Content-Range', `bytes */${size}`);
        finish(416, 'Virheellinen tavuväli.');
        return;
      }
      const part = content.subarray(start, end + 1);
      response.writeHead(206, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': part.length,
        'Content-Range': `bytes ${start}-${end}/${size}`,
      });
      response.end(request.method === 'HEAD' ? undefined : part);
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filename)],
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      finish(404, 'Tiedostoa ei löydy.');
      return;
    }
    console.error('Tiedoston lukeminen epäonnistui:', error.code ?? error.message);
    finish(500, 'Tiedoston lukeminen epäonnistui.');
  }
});

server.on('error', (error) => {
  console.error('Palvelinta ei voitu käynnistää:', error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Pikku Pupun Pomputtelu Peli: http://${host.includes(':') ? `[${host}]` : host}:${port}`);
  console.log('Sulje palvelin painamalla Ctrl+C.');
});
