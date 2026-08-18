const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');


test('Unix and Windows installers use versioned checksummed release assets', () => {
  const unix = fs.readFileSync(path.join(root, 'install.sh'), 'utf8');
  const windows = fs.readFileSync(path.join(root, 'install.ps1'), 'utf8');
  for (const source of [unix, windows]) {
    assert.match(source, /SHA256SUMS/);
    assert.match(source, /spencer-\$\{?Version|spencer-\$\{?version|spencer-\$Version/);
    assert.doesNotMatch(source, /NPM_TOKEN|npm install --global/);
  }
  if (process.platform !== 'win32') execFileSync('bash', ['-n', path.join(root, 'install.sh')]);
});


test('bundler emits a runnable standalone entry script', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spencer-bundle-'));
  const output = path.join(directory, 'entry.js');
  execFileSync(process.execPath, [path.join(root, 'scripts', 'bundle.js'), output], { stdio: 'pipe' });
  const version = execFileSync(process.execPath, [output, '--version'], { encoding: 'utf8' });
  assert.match(version, /spencer 0\.6\.0/);
  fs.rmSync(directory, { recursive: true, force: true });
});
