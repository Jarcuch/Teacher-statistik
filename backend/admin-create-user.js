'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const sqlite = require('sqlite3');
const { getCurrentUser } = require('./current-user');
const { hashPassword } = require('./passwords');

const databasePath = join(homedir(), 'teacher-data', 'teacher.db');
const maxBodyBytes = 8192;

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let bytes = 0;

  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= maxBodyBytes) chunks.push(chunk);
  }

  return bytes <= maxBodyBytes ? Buffer.concat(chunks, bytes).toString('utf8') : null;
}

function insertUser(adminId, username, hash) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READWRITE, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      db.run(
        `INSERT INTO users (username, password_hash, role)
         SELECT ?, ?, 'user'
         WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'admin')
         ON CONFLICT(username) DO NOTHING`,
        [username, hash, adminId],
        function (insertError) {
          const created = !insertError && this.changes === 1;
          db.close(closeError => {
            if (insertError || closeError) reject(insertError || closeError);
            else resolve(created);
          });
        }
      );
    });
  });
}

function resetPassword(adminId, targetId, hash) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READWRITE, error => {
      if (error) return reject(error);
      db.run(
        `UPDATE users SET password_hash = ? WHERE id = ? AND role = 'user'
         AND EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'admin')`,
        [hash, targetId, adminId],
        function (updateError) {
          const changed = this?.changes === 1;
          db.close(closeError => {
            if (updateError || closeError) reject(updateError || closeError);
            else resolve(changed);
          });
        }
      );
    });
  });
}

async function handleAdminCreateUser(req, res, resetTargetId = null) {
  const admin = await getCurrentUser(req);
  if (admin?.role !== 'admin') {
    req.resume();
    return admin
      ? sendJson(res, 403, { error: 'Tato akce vyžaduje roli správce.' })
      : sendJson(res, 401, { error: 'Je nutné se přihlásit.' });
  }

  const contentType = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    req.resume();
    return sendJson(res, 415, { error: 'Očekává se application/json.' });
  }

  const body = await readBody(req);
  if (body === null) return sendJson(res, 413, { error: 'Požadavek je příliš velký.' });

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return sendJson(res, 400, { error: 'Neplatný JSON.' });
  }

  const { username, password } = payload ?? {};
  if (resetTargetId === null && (typeof username !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(username))) {
    return sendJson(res, 400, { error: 'Neplatné uživatelské jméno.' });
  }
  if (
    typeof password !== 'string' ||
    [...password].length < 15 ||
    Buffer.byteLength(password, 'utf8') > 1024
  ) {
    return sendJson(res, 400, { error: 'Heslo musí mít alespoň 15 znaků a nejvýše 1024 bajtů.' });
  }

  const hash = await hashPassword(password);
  if (resetTargetId !== null) {
    if (!await resetPassword(admin.id, resetTargetId, hash)) return sendJson(res, 404, { error: 'Běžný účet nebyl nalezen.' });
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (!await insertUser(admin.id, username, hash)) {
    return sendJson(res, 409, { error: 'Účet s tímto jménem už existuje nebo chybí oprávnění.' });
  }

  return sendJson(res, 201, { user: { username, role: 'user' } });
}

module.exports = { handleAdminCreateUser };
