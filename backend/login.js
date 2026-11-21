'use strict';

const { authenticate } = require('./auth');
const { createSession, lifetimeSeconds } = require('./sessions');

const maxBodyBytes = 8192;
const maxConcurrentChecks = 2;
let activeChecks = 0;

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;

    req.on('data', chunk => {
      if (bytes > maxBodyBytes) return;

      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        chunks.length = 0;
        resolve(null);
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (bytes <= maxBodyBytes) {
        resolve(Buffer.concat(chunks, bytes).toString('utf8'));
      }
    });

    req.on('error', reject);
    req.on('close', () => {
      if (!req.complete) reject(new Error('Požadavek byl přerušen.'));
    });
  });
}

async function handleLogin(req, res) {
  const contentType = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    req.resume();
    return sendJson(res, 415, { error: 'Očekává se application/json.' });
  }

  const body = await readBody(req);
  if (body === null) {
    return sendJson(res, 413, { error: 'Požadavek je příliš velký.' });
  }

  let credentials;
  try {
    credentials = JSON.parse(body);
  } catch {
    return sendJson(res, 400, { error: 'Neplatný JSON.' });
  }

  if (activeChecks >= maxConcurrentChecks) {
    res.setHeader('Retry-After', '2');
    return sendJson(res, 429, { error: 'Zkus to za chvíli znovu.' });
  }

  activeChecks += 1;
  let verified;
  try {
    verified = await authenticate(credentials?.username, credentials?.password);
  } finally {
    activeChecks -= 1;
  }

  if (!verified) {
    return sendJson(res, 401, { error: 'Nesprávné jméno nebo heslo.' });
  }

  const { user, verifiedHash } = verified;
  const token = createSession(user.id, verifiedHash);
  if (!token) {
    return sendJson(res, 503, { error: 'Přihlášení je dočasně nedostupné.' });
  }

  res.setHeader(
    'Set-Cookie',
    `__Host-teacher_session=${token}; Path=/; Max-Age=${lifetimeSeconds}; HttpOnly; Secure; SameSite=Strict`
  );
  return sendJson(res, 200, { user });
}

module.exports = { handleLogin };
