'use strict';
// Starts the FastAPI service with the virtual environment's Python (Windows or macOS/Linux),
// passing along the settings from .env so the API and the AI service always share the same secret.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dir = path.join(__dirname, '..', 'ai-service');
const win = process.platform === 'win32';
const venvPython = path.join(dir, '.venv', win ? 'Scripts' : 'bin', win ? 'python.exe' : 'python');
if (!fs.existsSync(venvPython)) {
  console.error('The Python environment is missing. Run "npm run setup" first.');
  process.exit(1);
}
const child = spawn(venvPython, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd: dir, stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
