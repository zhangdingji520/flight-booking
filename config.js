const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnv();

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET in .env for production.');
  return 'dev-only-secret-key';
})();

const PORT = parseInt(process.env.PORT, 10) || 3000;

const VALID_ORDER_STATUSES = ['paid', 'completed', 'cancelled', 'refunded'];
const VALID_FLIGHT_STATUSES = ['on-time', 'delayed', 'cancelled'];

module.exports = { JWT_SECRET, PORT, VALID_ORDER_STATUSES, VALID_FLIGHT_STATUSES };
