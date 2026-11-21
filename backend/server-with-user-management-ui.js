'use strict';

const { createServer } = require('node:http');
const { handleFrontend } = require('./frontend-user-management-static');
const { getCurrentUser } = require('./current-user');
const { handleAdminUsers } = require('./admin-users');
const { handleAdminCreateUser } = require('./admin-create-user');
const { handleAdminDeleteUser } = require('./admin-delete-user');
const { handleAdminGetData } = require('./admin-read-data');
const { handleAdminPutData } = require('./admin-put-data');
const { handleAdminDeleteData } = require('./admin-delete-data');
const { handleGetData } = require('./user-data');
const { handlePutData } = require('./put-user-data');
const { handleLogin } = require('./login');
const { loginRetryAfter } = require('./login-limit');
const { handleLogout } = require('./session-http');

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function handleRequest(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && req.url === '/me') {
    const user = await getCurrentUser(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Je nutné se přihlásit.' });
    }
    return sendJson(res, 200, { user });
  }

  if (req.method === 'GET' && req.url === '/admin/users') {
    return handleAdminUsers(req, res);
  }

  if (req.method === 'POST' && req.url === '/admin/users') {
    return handleAdminCreateUser(req, res);
  }

  const passwordPath = /^\/admin\/users\/([1-9][0-9]*)\/password$/.exec(req.url);
  if (req.method === 'PUT' && passwordPath) {
    return handleAdminCreateUser(req, res, passwordPath[1]);
  }

  const adminUserPath = /^\/admin\/users\/([^/?]+)$/.exec(req.url);
  if (req.method === 'DELETE' && adminUserPath) {
    return handleAdminDeleteUser(req, res, adminUserPath[1]);
  }

  const adminDataPath = /^\/admin\/users\/([^/?]+)\/data$/.exec(req.url);
  if (req.method === 'GET' && adminDataPath) {
    return handleAdminGetData(req, res, adminDataPath[1]);
  }

  if (req.method === 'PUT' && adminDataPath) {
    return handleAdminPutData(req, res, adminDataPath[1]);
  }

  if (req.method === 'DELETE' && adminDataPath) {
    return handleAdminDeleteData(req, res, adminDataPath[1]);
  }

  if (req.method === 'GET' && req.url === '/data') {
    return handleGetData(req, res);
  }

  if (req.method === 'PUT' && req.url === '/data') {
    return handlePutData(req, res);
  }

  if (req.method === 'POST' && req.url === '/login') {
    const retryAfter = loginRetryAfter();
    if (retryAfter > 0) {
      req.resume();
      res.setHeader('Retry-After', String(retryAfter));
      return sendJson(res, 429, { error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' });
    }
    return handleLogin(req, res);
  }

  if (req.method === 'POST' && req.url === '/logout') {
    req.resume();
    return handleLogout(req, res);
  }

  if (await handleFrontend(req, res)) return;

  sendJson(res, 404, { error: 'Stránka nebyla nalezena.' });
}

const server = createServer(
  { headersTimeout: 10000, requestTimeout: 15000, connectionsCheckingInterval: 1000 },
  (req, res) => {
    handleRequest(req, res).catch(error => {
      if (res.destroyed) return;

      console.error('Chyba při zpracování požadavku:', error.message);
      if (res.headersSent) {
        res.destroy();
        return;
      }

      sendJson(res, 500, { error: 'Požadavek se nepodařilo zpracovat.' });
    });
  }
);

const port = Number(process.env.TEACHER_STATISTIC_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Neplatný port Teacher Statistic.');
}

server.listen(port, '127.0.0.1', () => {
  console.log(`Teacher Statistic se správou uživatelů poslouchá na http://127.0.0.1:${port}`);
});
