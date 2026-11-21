'use strict';

const { performance } = require('node:perf_hooks');

const burst = 6;
const refillIntervalMs = 5000;
let available = burst;
let lastCheck = performance.now();

function loginRetryAfter() {
  const now = performance.now();
  available = Math.min(burst, available + (now - lastCheck) / refillIntervalMs);
  lastCheck = now;

  if (available < 1) {
    return Math.ceil((1 - available) * refillIntervalMs / 1000);
  }

  available -= 1;
  return 0;
}

module.exports = { loginRetryAfter };
