'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const sqlite = require('sqlite3');
const { getSession } = require('./sessions');
const { getSessionToken } = require('./session-http');

const databasePath = join(homedir(), 'teacher-data', 'teacher.db');

function findUserById(userId, verifiedHash) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READONLY, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      db.get(
        'SELECT id, username, role FROM users WHERE id = ? AND password_hash = ?',
        [userId, verifiedHash],
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
  const session = getSession(token);
  return session ? findUserById(session.userId, session.verifiedHash) : null;
}

module.exports = { getCurrentUser };
