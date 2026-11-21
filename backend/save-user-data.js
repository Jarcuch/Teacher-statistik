'use strict';

const { homedir } = require('node:os');
const { join } = require('node:path');
const sqlite = require('sqlite3');

const databasePath = join(homedir(), 'teacher-data', 'teacher.db');

function saveUserData(userId, data) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(data);

    const db = new sqlite.Database(databasePath, sqlite.OPEN_READWRITE, openError => {
      if (openError) {
        reject(openError);
        return;
      }

      function finish(operationError) {
        db.close(closeError => {
          const error = operationError || closeError;
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }

      db.run('PRAGMA foreign_keys = ON', pragmaError => {
        if (pragmaError) {
          finish(pragmaError);
          return;
        }

        db.run(
          `INSERT INTO user_data (user_id, data) VALUES (?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             data = excluded.data,
             updated_at = CURRENT_TIMESTAMP`,
          [userId, json],
          finish
        );
      });
    });
  });
}

module.exports = { saveUserData };
