'use strict';

const { findUserByUsername } = require('./users');
const { verifyPassword } = require('./passwords');

// I pro neznámý účet provedeme výpočet scrypt.
const dummyHash = `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;

async function authenticate(username, password) {
  if (
    typeof username !== 'string' ||
    username.length === 0 ||
    Buffer.byteLength(username, 'utf8') > 256 ||
    typeof password !== 'string' ||
    password.length === 0 ||
    Buffer.byteLength(password, 'utf8') > 1024
  ) {
    return null;
  }

  const user = await findUserByUsername(username);
  const passwordMatches = await verifyPassword(
    password,
    user?.password_hash ?? dummyHash
  );

  if (!user || !passwordMatches) {
    return null;
  }

  return { id: user.id, username: user.username, role: user.role };
}

module.exports = { authenticate };
