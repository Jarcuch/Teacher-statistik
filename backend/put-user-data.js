'use strict';

const { getCurrentUser } = require('./current-user');
const { saveUserData } = require('./save-user-data');

const maxBodyBytes = 5 * 1024 * 1024;

function sendError(res, status, message) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ error: message }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let tooLarge = false;

    req.on('data', chunk => {
      if (tooLarge) return;

      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        tooLarge = true;
        chunks.length = 0;
        resolve(null);
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks, bytes).toString('utf8'));
    });
    req.on('error', reject);
    req.on('close', () => {
      if (!req.complete) reject(new Error('Požadavek byl přerušen.'));
    });
  });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function handlePutData(req, res) {
  const user = await getCurrentUser(req);
  if (!user) {
    req.resume();
    return sendError(res, 401, 'Je nutné se přihlásit.');
  }

  const contentType = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    req.resume();
    return sendError(res, 415, 'Očekává se application/json.');
  }

  const body = await readBody(req);
  if (body === null) {
    return sendError(res, 413, 'Požadavek přesahuje 5 MiB.');
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return sendError(res, 400, 'Neplatný JSON.');
  }

  const data = payload?.data;
  if (
    !isObject(data) ||
    !Array.isArray(data.partners) ||
    !Array.isArray(data.records) ||
    !Array.isArray(data.controls) ||
    !isObject(data.criteria)
  ) {
    return sendError(res, 400, 'Data nemají očekávanou strukturu.');
  }

  await saveUserData(user.id, data);
  res.writeHead(204, { 'Cache-Control': 'no-store' });
  res.end();
}

module.exports = { handlePutData };
