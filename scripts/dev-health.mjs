import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env.local');
const REQUIRED_ENV_KEYS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'DDB_TABLE_NAME',
  'JWT_SECRET',
];

const TARGET_PORTS = [5173, 5174, 5175, 5176, 5177, 5178, 5179];

function parseEnvFile(filePath) {
  const map = new Map();
  const file = readFileSync(filePath, 'utf8');

  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    map.set(key, value);
  }

  return map;
}

function getListeningPortsWindows() {
  const output = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
  const used = new Map();

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const localAddress = parts[1] ?? '';
    const pid = parts[4] ?? '';
    const port = Number(localAddress.split(':').pop());

    if (!Number.isInteger(port) || !TARGET_PORTS.includes(port)) continue;
    if (!/^\d+$/.test(pid)) continue;

    if (!used.has(port)) used.set(port, new Set());
    used.get(port).add(pid);
  }

  return used;
}

function getListeningPortsUnix() {
  const used = new Map();

  for (const port of TARGET_PORTS) {
    try {
      const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
      if (!output) continue;

      const pids = output
        .split(/\r?\n/)
        .filter((value) => /^\d+$/.test(value));

      if (pids.length > 0) used.set(port, new Set(pids));
    } catch {
      // Ignore missing listeners per port.
    }
  }

  return used;
}

async function checkAuthEndpoint() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch('http://localhost:5173/api/auth?action=session', {
      method: 'GET',
      signal: controller.signal,
    });
    return { ok: true, status: response.status };
  } catch {
    return { ok: false, status: null };
  } finally {
    clearTimeout(timeout);
  }
}

let hasIssues = false;

console.log('[dev:health] Checking local environment...');

if (!existsSync(ENV_PATH)) {
  hasIssues = true;
  console.log('[dev:health] Missing .env.local file.');
} else {
  const envMap = parseEnvFile(ENV_PATH);
  const missing = REQUIRED_ENV_KEYS.filter((key) => {
    const value = envMap.get(key);
    return !value || value.length === 0;
  });

  if (missing.length > 0) {
    hasIssues = true;
    console.log(`[dev:health] Missing env keys: ${missing.join(', ')}`);
  } else {
    console.log('[dev:health] .env.local has required keys.');
  }
}

const usedPorts = process.platform === 'win32'
  ? getListeningPortsWindows()
  : getListeningPortsUnix();

if (usedPorts.size === 0) {
  console.log('[dev:health] No listeners found on tracked dev ports.');
} else {
  hasIssues = true;
  console.log('[dev:health] Port usage detected:');
  for (const [port, pidSet] of usedPorts.entries()) {
    console.log(`  - ${port}: ${[...pidSet].join(', ')}`);
  }
  console.log('[dev:health] Run npm run dev:clean to clear stale listeners.');
}

const authCheck = await checkAuthEndpoint();
if (authCheck.ok) {
  console.log(`[dev:health] Auth endpoint reachable on :5173 (HTTP ${authCheck.status}).`);
} else {
  hasIssues = true;
  console.log('[dev:health] Auth endpoint not reachable on :5173. Start full stack with npm run dev:full.');
}

if (hasIssues) {
  process.exit(1);
}

console.log('[dev:health] All checks passed.');
