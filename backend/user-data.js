'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const sqlite = require('sqlite3');
const { getCurrentUser } = require('./current-user');

const databasePath = join(homedir(), 'teacher-data', 'teacher.db');

function readUserData(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READONLY, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      db.get(
        'SELECT data FROM user_data WHERE user_id = ?',
        [userId],
        (queryError, row) => {
          db.close(closeError => {
            const error = queryError || closeError;
            if (error) {
              reject(error);
              return;
            }
            resolve(row?.data ?? '{}');
          });
        }
      );
    });
  });
}

async function handleGetData(req, res) {
  const user = await getCurrentUser(req);
  const data = user ? JSON.parse(await readUserData(user.id)) : null;

  res.writeHead(user ? 200 : 401, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(user ? { data } : { error: 'Je nutné se přihlásit.' }));
}

module.exports = { handleGetData };
