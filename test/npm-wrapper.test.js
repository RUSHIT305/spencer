const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const wrapper = path.resolve(__dirname, '..', 'bin', 'spencer.js');
const cli = require('../lib/cli.js');


test('parses only workspace and safety options', () => {
  const parsed = cli.parseArgs(['--max-steps', '8', '--timeout', '45', 'Fix', 'tests']);
  assert.deepEqual(parsed.positionals, ['Fix', 'tests']);
  assert.equal(parsed.options['max-steps'], '8');
  assert.equal(parsed.options.timeout, '45');
  assert.throws(() => cli.parseArgs(['--api-key', 'secret', 'Fix']), /manages the AI backend automatically/);
});


test('runs the npm-installed executable directly', () => {
  const output = execFileSync(process.execPath, [wrapper, '--version'], { encoding: 'utf8' });
  assert.match(output, /spencer 0\.5\.0/);
});


test('help explains that the managed backend needs no user API setup', () => {
  const output = execFileSync(process.execPath, [wrapper, '--help'], { encoding: 'utf8' });
  assert.match(output, /npm/);
  assert.match(output, /managed Gemini backend/);
  assert.doesNotMatch(output, /SPENCER_API_KEY/);
});


test('doctor reports managed credentials without exposing a key', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'spencer-node-'));
  const output = execFileSync(process.execPath, [wrapper, '--doctor', '--cwd', workspace], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.node.startsWith('v'), true);
  assert.equal(result.backend, 'Spencer Managed Gemini');
  assert.equal(result.credentials, 'managed by Spencer');
  assert.equal(result.userApiConfiguration, false);
  assert.equal('apiKey' in result, false);
});


test('--init explicitly confirms that no API configuration file is needed', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'spencer-node-'));
  const output = execFileSync(process.execPath, [wrapper, '--init', '--cwd', workspace], { encoding: 'utf8' });
  assert.match(output, /does not require an API configuration file/);
});
