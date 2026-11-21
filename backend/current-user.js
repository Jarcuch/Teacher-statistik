'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const sqlite = require('sqlite3');
const { getSessionUserId } = require('./sessions');
const { getSessionToken } = require('./session-http');

const databasePath = join(homedir(), 'teacher-data', 'teacher.db');

function findUserById(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READONLY, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      db.get(
        'SELECT id, username, role FROM users WHERE id = ?',
        [userId],
        (queryError, user) => {
          db.close(closeError => {
            const error = queryError || closeError;
            if (error) {
              reject(error);
              return;
            }
            resolve(user ?? null);
          });
        }
      );
    });
  });
}

async function getCurrentUser(req) {
  const token = getSessionToken(req);
  const userId = getSessionUserId(token);
  return userId === null ? null : findUserById(userId);
}

module.exports = { getCurrentUser };
