'use strict';

const { deleteSession } = require('./sessions');

const cookieName = '__Host-teacher_session';

function getSessionToken(req) {
  const cookies = (req.headers.cookie ?? '').split(';');
  const prefix = `${cookieName}=`;
  const matches = cookies.map(cookie => cookie.trim())
    .filter(cookie => cookie.startsWith(prefix));

  if (matches.length !== 1) return null;

  const token = matches[0].slice(prefix.length);
  return /^[0-9a-f]{64}$/.test(token) ? token : null;
}

function handleLogout(req, res) {
  const token = getSessionToken(req);
  if (token) deleteSession(token);

  res.writeHead(204, {
    'Cache-Control': 'no-store',
    'Set-Cookie': `${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
  });
  res.end();
}

module.exports = { getSessionToken, handleLogout };
