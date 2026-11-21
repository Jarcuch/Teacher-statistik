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

function readAccountData(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READONLY, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      db.get(
        `SELECT user_data.data
         FROM users
         LEFT JOIN user_data ON user_data.user_id = users.id
         WHERE users.id = ?`,
        [userId],
        (queryError, row) => {
          db.close(closeError => {
            const error = queryError || closeError;
            if (error) {
              reject(error);
              return;
            }
            resolve(row);
          });
        }
      );
    });
  });
}

async function handleAdminGetData(req, res, targetId) {
  const user = await getCurrentUser(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Je nutné se přihlásit.' });
  }
  if (user.role !== 'admin') {
    return sendJson(res, 403, { error: 'Tato akce vyžaduje roli správce.' });
  }

  const userId = Number(targetId);
  if (!/^[1-9][0-9]*$/.test(targetId) || !Number.isSafeInteger(userId)) {
    return sendJson(res, 400, { error: 'Neplatné ID účtu.' });
  }

  const row = await readAccountData(userId);
  if (!row) {
    return sendJson(res, 404, { error: 'Účet nebyl nalezen.' });
  }

  return sendJson(res, 200, { data: JSON.parse(row.data ?? '{}') });
}

module.exports = { handleAdminGetData };
