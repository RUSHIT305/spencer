'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  path.join(root, 'bin', 'spencer.js'),
  ...['lib', 'server'].flatMap((directory) => fs.readdirSync(path.join(root, directory)).filter((name) => name.endsWith('.js')).map((name) => path.join(root, directory, name))),
];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}
console.log(`Checked ${files.length} Node files.`);
