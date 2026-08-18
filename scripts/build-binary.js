'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const outputArgIndex = process.argv.indexOf('--output');
const requestedOutput = outputArgIndex >= 0 ? process.argv[outputArgIndex + 1] : null;
const defaultName = process.platform === 'win32' ? 'spencer.exe' : 'spencer';
const requestedPath = requestedOutput || path.join(root, 'dist', defaultName);
const output = path.resolve(process.platform === 'win32' && !requestedPath.toLowerCase().endsWith('.exe') ? `${requestedPath}.exe` : requestedPath);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'spencer-sea-'));
const bundled = path.join(temp, 'spencer-entry.js');
const seaConfig = path.join(temp, 'sea-config.json');
const blob = path.join(temp, 'sea-prep.blob');
const nodeCopy = output;
const postject = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'postject.cmd' : 'postject');
const sentinel = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

function run(command, args, options = {}) {
  try {
    execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  } catch (error) {
    throw new Error(`${command} failed: ${error.message}`, { cause: error });
  }
}

try {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  run(process.execPath, [path.join(root, 'scripts', 'bundle.js'), bundled]);
  fs.writeFileSync(seaConfig, JSON.stringify({
    main: bundled,
    output: blob,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
  }, null, 2));
  run(process.execPath, ['--experimental-sea-config', seaConfig]);
  fs.copyFileSync(process.execPath, nodeCopy);
  if (process.platform === 'darwin') {
    const codesign = spawnSync('codesign', ['--remove-signature', nodeCopy], { cwd: root, stdio: 'inherit' });
    if (codesign.error) throw codesign.error;
    if (codesign.status !== 0) throw new Error(`codesign exited with status ${codesign.status}`);
  }
  const postjectArgs = [nodeCopy, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', sentinel];
  if (process.platform === 'darwin') postjectArgs.push('--macho-segment-name', 'NODE_SEA');
  run(postject, postjectArgs);
  if (process.platform !== 'win32') fs.chmodSync(nodeCopy, 0o755);
  console.log(`Built ${nodeCopy}`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
