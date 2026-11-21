'use strict';

const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const deriveKey = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const keyLength = 64;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, keyLength, options);
  return `scrypt-v1$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const match = /^scrypt-v1\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(storedHash);
  if (!match) return false;

  const salt = Buffer.from(match[1], 'hex');
  const expectedKey = Buffer.from(match[2], 'hex');
  const actualKey = await deriveKey(password, salt, keyLength, options);
  return timingSafeEqual(actualKey, expectedKey);
}

module.exports = { hashPassword, verifyPassword };
