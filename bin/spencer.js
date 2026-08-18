#!/usr/bin/env node

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MIN_PYTHON = [3, 10];

function parseVersion(output) {
  const match = String(output || '').match(/Python (\d+)\.(\d+)(?:\.(\d+))?/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)] : null;
}

function isSupported(version) {
  return version && (version[0] > MIN_PYTHON[0] || (version[0] === MIN_PYTHON[0] && version[1] >= MIN_PYTHON[1]));
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return result.status === 0 && isSupported(parseVersion(output));
}

function candidateCommands() {
  const candidates = [];
  if (process.env.SPENCER_PYTHON) candidates.push(process.env.SPENCER_PYTHON);
  if (process.env.VIRTUAL_ENV) {
    candidates.push(path.join(process.env.VIRTUAL_ENV, process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python'));
  }
  if (process.platform === 'win32') candidates.push('py', 'python');
  else candidates.push('python3', 'python');
  return [...new Set(candidates)];
}

function findPython() {
  for (const command of candidateCommands()) {
    if (path.isAbsolute(command) && !fs.existsSync(command)) continue;
    if (commandExists(command)) return command;
  }
  return null;
}

function run() {
  const python = findPython();
  if (!python) {
    console.error('Spencer requires Python 3.10 or newer.');
    console.error('Install Python from https://www.python.org/downloads/ and run this command again.');
    console.error('Alternatively set SPENCER_PYTHON to the path of a supported Python executable.');
    return 1;
  }

  const args = ["-m", "spencer.cli", ...process.argv.slice(2)];
  const packageRoot = path.resolve(__dirname, '..');
  const pythonPath = [path.join(packageRoot, 'src'), process.env.PYTHONPATH]
    .filter(Boolean)
    .join(path.delimiter);
  const result = spawnSync(python, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8',
      PYTHONPATH: pythonPath,
    },
    stdio: 'inherit',
    windowsHide: false,
  });
  if (result.error) {
    console.error(`Unable to start Spencer with ${python}: ${result.error.message}`);
    return 1;
  }
  if (typeof result.status === 'number') return result.status;
  return 1;
}

if (require.main === module) process.exitCode = run();

module.exports = { candidateCommands, findPython, isSupported, parseVersion, run };
