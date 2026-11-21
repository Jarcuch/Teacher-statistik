'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const sqlite = require('sqlite3');
const { getCurrentUser } = require('./current-user');

const databasePath = join(homedir(), 'teacher-data', 'teacher.db');

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function listUsers() {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READONLY, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      db.all('SELECT id, username, role FROM users ORDER BY id', (queryError, users) => {
        db.close(closeError => {
          const error = queryError || closeError;
          if (error) {
            reject(error);
            return;
          }
          resolve(users);
        });
      });
    });
  });
}

async function handleAdminUsers(req, res) {
  const user = await getCurrentUser(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Je nutné se přihlásit.' });
  }
  if (user.role !== 'admin') {
    return sendJson(res, 403, { error: 'Tato akce vyžaduje roli správce.' });
  }

  return sendJson(res, 200, { users: await listUsers() });
}

module.exports = { handleAdminUsers };
