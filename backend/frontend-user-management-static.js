'use strict';

const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

const directory = join(__dirname, '..', 'frontend-next');
const html = ['index-user-management.html', 'text/html; charset=utf-8'];
const javascript = 'text/javascript; charset=utf-8';
const png = 'image/png';

const files = new Map([
  ['/', html],
  ['/index.html', html],
  ['/api-user-management.js', ['api-user-management.js', javascript]],
  ['/workspace-ui.js', ['workspace-ui.js', javascript]],
  ['/admin-users-ui.js', ['admin-users-ui.js', javascript]],
  ['/sw.js', ['sw.js', javascript]],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
  ['/apple-touch-icon.png', ['apple-touch-icon.png', png]],
  ['/icon-180.png', ['icon-180.png', png]],
  ['/icon-192.png', ['icon-192.png', png]],
  ['/icon-512.png', ['icon-512.png', png]],
]);

async function handleFrontend(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const entry = files.get(req.url);
  if (!entry) return false;

  const [filename, contentType] = entry;
  const content = await readFile(join(directory, filename));
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': content.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'",
  });
  res.end(req.method === 'HEAD' ? undefined : content);
  return true;
}

module.exports = { handleFrontend };
