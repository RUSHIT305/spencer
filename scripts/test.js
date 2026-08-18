'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const testDir = path.join(root, 'test');
const files = fs.readdirSync(testDir).filter((name) => name.endsWith('.test.js')).sort().map((name) => path.join(testDir, name));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
