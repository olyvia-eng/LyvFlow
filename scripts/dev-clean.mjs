import { execSync, spawnSync } from 'node:child_process';

const TARGET_PORTS = [5173, 5174, 5175, 5176, 5177, 5178, 5179];

function getListeningPidsWindows(ports) {
  const output = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const localAddress = parts[1] ?? '';
    const pidText = parts[4] ?? '';
    const localPort = Number(localAddress.split(':').pop());

    if (!Number.isInteger(localPort) || !ports.includes(localPort)) continue;
    if (!/^\d+$/.test(pidText)) continue;

    pids.add(Number(pidText));
  }

  return [...pids];
}

function getListeningPidsUnix(ports) {
  const pids = new Set();

  for (const port of ports) {
    try {
      const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
      if (!output) continue;

      for (const pidText of output.split(/\r?\n/)) {
        if (/^\d+$/.test(pidText)) pids.add(Number(pidText));
      }
    } catch {
      // Ignore per-port lookup errors when nothing is listening.
    }
  }

  return [...pids];
}

function killPidWindows(pid) {
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
}

function killPidUnix(pid) {
  spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
}

const isWindows = process.platform === 'win32';
const pids = isWindows
  ? getListeningPidsWindows(TARGET_PORTS)
  : getListeningPidsUnix(TARGET_PORTS);

if (pids.length === 0) {
  console.log(`[dev:clean] No listeners found on ports ${TARGET_PORTS.join(', ')}.`);
  process.exit(0);
}

for (const pid of pids) {
  if (isWindows) killPidWindows(pid);
  else killPidUnix(pid);
}

console.log(`[dev:clean] Cleared ${pids.length} process(es): ${pids.join(', ')}`);
