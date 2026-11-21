'use strict';

const { randomBytes } = require('node:crypto');

const sessions = new Map();
const lifetimeSeconds = 60 * 60;
const maxSessions = 1000;

function createSession(userId) {
  const now = Date.now();

  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }

  if (sessions.size >= maxSessions) {
    return null;
  }

  const token = randomBytes(32).toString('hex');
  sessions.set(token, { userId, expiresAt: now + lifetimeSeconds * 1000 });
  return token;
}

function getSessionUserId(token) {
  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session.userId;
}

function deleteSession(token) {
  sessions.delete(token);
}

module.exports = { createSession, getSessionUserId, deleteSession, lifetimeSeconds };
