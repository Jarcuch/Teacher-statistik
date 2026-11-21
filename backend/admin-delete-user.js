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

function deleteEmptyUser(targetId, adminId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READWRITE, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      function finish(error, deleted = false) {
        db.close(closeError => {
          if (error || closeError) {
            reject(error || closeError);
            return;
          }
          resolve(deleted);
        });
      }

      db.run('PRAGMA foreign_keys = ON', pragmaError => {
        if (pragmaError) {
          finish(pragmaError);
          return;
        }

        db.run(
          `DELETE FROM users
           WHERE id = ? AND role = 'user'
             AND NOT EXISTS (
               SELECT 1 FROM user_data WHERE user_id = users.id
             )
             AND EXISTS (
               SELECT 1 FROM users AS actor
               WHERE actor.id = ? AND actor.role = 'admin'
             )`,
          [targetId, adminId],
          function (deleteError) {
            finish(deleteError, !deleteError && this.changes === 1);
          }
        );
      });
    });
  });
}

async function handleAdminDeleteUser(req, res, targetId) {
  req.resume();
  const admin = await getCurrentUser(req);

  if (!admin) return sendError(res, 401, 'Je nutné se přihlásit.');
  if (admin.role !== 'admin') {
    return sendError(res, 403, 'Tato akce vyžaduje roli správce.');
  }

  const userId = Number(targetId);
  if (!/^[1-9][0-9]*$/.test(targetId) || !Number.isSafeInteger(userId)) {
    return sendError(res, 400, 'Neplatné ID účtu.');
  }

  if (!await deleteEmptyUser(userId, admin.id)) {
    return sendError(res, 409, 'Lze smazat jen existující běžný účet bez uložených dat.');
  }

  res.writeHead(204, { 'Cache-Control': 'no-store' });
  res.end();
}

module.exports = { handleAdminDeleteUser };
