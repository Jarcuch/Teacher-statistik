'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const sqlite = require('sqlite3');

const databasePath = join(homedir(), 'teacher-data', 'teacher.db');

function findUserByUsername(username) {
  return new Promise((resolve, reject) => {
    const db = new sqlite.Database(databasePath, sqlite.OPEN_READONLY, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      db.get(
        'SELECT id, username, password_hash, role FROM users WHERE username = ?',
        [username],
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

module.exports = { findUserByUsername };
