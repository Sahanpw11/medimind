'use strict';
// One-time setup: MongoDB in Docker, the Python environment for the AI service, then demo data.
// Safe to run again. Needs: Node 20+, Python 3.9+, Docker Desktop (running).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
const win = process.platform === 'win32';

const step = (n, text) => console.log(`\n[${n}/4] ${text}`);
const fail = (msg) => { console.error(`\nSetup stopped: ${msg}`); process.exit(1); };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: win, ...opts });
const has = (cmd, args = ['--version']) => spawnSync(cmd, args, { stdio: 'ignore', shell: win }).status === 0;

(async () => {
  step(1, 'Checking tools');
  if (Number(process.versions.node.split('.')[0]) < 20) fail(`Node 20 or newer is needed (you have ${process.versions.node}).`);
  if (!has('docker')) fail('Docker is not installed or not on your PATH. Install Docker Desktop, start it, then run this again.');
  if (spawnSync('docker', ['info'], { stdio: 'ignore', shell: win }).status !== 0) fail('Docker is installed but not running. Start Docker Desktop, wait until it says "running", then run this again.');
  const python = ['python3', 'python', 'py'].find((c) => has(c));
  if (!python) fail('Python 3.9 or newer is needed (python3 / python was not found).');
  console.log(`  Node ${process.versions.node}, Docker running, ${python} found`);

  step(2, 'Starting MongoDB (Docker)');
  if (run('docker', ['compose', 'up', '-d']).status !== 0) fail('"docker compose up" failed.');
  const { MongoClient } = require('mongodb');
  const deadline = Date.now() + 120000;
  for (;;) {
    try { const c = await new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 }).connect(); await c.db().command({ ping: 1 }); await c.close(); break; }
    catch { if (Date.now() > deadline) fail('MongoDB did not become ready in 2 minutes. Check Docker Desktop.'); process.stdout.write('.'); await new Promise((r) => setTimeout(r, 2000)); }
  }
  console.log('\n  MongoDB is ready');

  step(3, 'Setting up the AI service (Python)');
  const venv = path.join(root, 'ai-service', '.venv');
  const venvPython = path.join(venv, win ? 'Scripts' : 'bin', win ? 'python.exe' : 'python');
  if (!fs.existsSync(venvPython) && run(python, ['-m', 'venv', venv]).status !== 0) fail('Could not create the Python environment.');
  if (run(venvPython, ['-m', 'pip', 'install', '--quiet', '-r', path.join('ai-service', 'requirements-dev.txt')]).status !== 0) fail('Installing the Python packages failed (check your internet connection).');

  step(4, 'Loading demo data (500 patients, 20 doctors, 2,200 appointments)');
  if (run(process.execPath, [path.join('database', 'setup.js')]).status !== 0) fail('Loading the demo data failed.');

  console.log('\nAll set. Start the app with:   npm start\nThen open:                      http://localhost:5173\n\nDemo logins (password Demo@12345): patient@demo.test, doctor@demo.test, admin@demo.test');
})();
