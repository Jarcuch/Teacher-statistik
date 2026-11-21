'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const sqlite = require('sqlite3');
const { getCurrentUser } = require('./current-user');

const databasePath = join(homedir(), 'teacher-data', 'teacher.db');

function sendError(res, status, message) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ error: message }));
}

function deleteAccountData(targetId, adminId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READWRITE, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      db.run(
        `DELETE FROM user_data
         WHERE user_id = ?
           AND EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'admin')`,
        [targetId, adminId],
        deleteError => {
          db.close(closeError => {
            const error = deleteError || closeError;
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }
      );
    });
  });
}

async function handleAdminDeleteData(req, res, targetId) {
  req.resume();

  const user = await getCurrentUser(req);
  if (!user) {
    return sendError(res, 401, 'Je nutné se přihlásit.');
  }
  if (user.role !== 'admin') {
    return sendError(res, 403, 'Tato akce vyžaduje roli správce.');
  }

  const userId = Number(targetId);
  if (!/^[1-9][0-9]*$/.test(targetId) || !Number.isSafeInteger(userId)) {
    return sendError(res, 400, 'Neplatné ID účtu.');
  }

  await deleteAccountData(userId, user.id);
  res.writeHead(204, { 'Cache-Control': 'no-store' });
  res.end();
}

module.exports = { handleAdminDeleteData };
