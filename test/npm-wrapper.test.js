const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const wrapper = path.resolve(__dirname, '..', 'bin', 'spencer.js');
const runtime = require(wrapper);


test('parses Python versions from stdout and stderr', () => {
  assert.deepEqual(runtime.parseVersion('Python 3.12.3'), [3, 12, 3]);
  assert.deepEqual(runtime.parseVersion('Python 3.10.0\n'), [3, 10, 0]);
  assert.equal(runtime.parseVersion('not python'), null);
});


test('accepts Python 3.10+ and rejects older versions', () => {
  assert.equal(runtime.isSupported([3, 10, 0]), true);
  assert.equal(runtime.isSupported([3, 13, 1]), true);
  assert.equal(runtime.isSupported([3, 9, 18]), false);
  assert.equal(runtime.isSupported(null), null);
});


test('discovers a supported Python runtime', () => {
  const python = runtime.findPython();
  assert.ok(python, 'a supported Python executable should be available in the test environment');
});


test('forwards CLI arguments to the Python Spencer command', () => {
  const output = execFileSync(process.execPath, [wrapper, '--version'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });
  assert.match(output, /spencer 0\.4\.0/);
});
