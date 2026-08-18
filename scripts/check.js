'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  path.join(root, 'bin', 'spencer.js'),
  ...['lib', 'server', 'scripts'].flatMap((directory) => fs.readdirSync(path.join(root, directory)).filter((name) => name.endsWith('.js')).map((name) => path.join(root, directory, name))),
];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}
if (process.platform !== 'win32') {
  const shellCheck = spawnSync('bash', ['-n', path.join(root, 'install.sh')], { encoding: 'utf8' });
  if (shellCheck.status !== 0) {
    process.stderr.write(shellCheck.stderr || 'Bash installer syntax check failed.\n');
    process.exit(shellCheck.status || 1);
  }
}
for (const installer of ['install.sh', 'install.ps1']) {
  if (!fs.existsSync(path.join(root, installer))) {
    throw new Error(`Missing installer: ${installer}`);
  }
}
console.log(`Checked ${files.length} Node files and both installers.`);
