const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const wrapper = path.resolve(__dirname, '..', 'bin', 'spencer.js');
const cli = require('../lib/cli.js');
const provider = require('../lib/provider.js');


test('parses Node-native CLI options without Python runtime flags', () => {
  const parsed = cli.parseArgs(['--protocol', 'ollama-chat', '--headers', '{"X-Test":"yes"}', 'Fix', 'tests']);
  assert.deepEqual(parsed.positionals, ['Fix', 'tests']);
  assert.equal(parsed.options.protocol, 'ollama-chat');
  assert.equal(parsed.options.headers, '{"X-Test":"yes"}');
});


test('runs the npm-installed executable directly', () => {
  const output = execFileSync(process.execPath, [wrapper, '--version'], { encoding: 'utf8' });
  assert.match(output, /spencer 0\.4\.0/);
});


test('shows help without external runtime prerequisites', () => {
  const output = execFileSync(process.execPath, [wrapper, '--help'], { encoding: 'utf8' });
  assert.match(output, /npm/);
  assert.doesNotMatch(output, /Python/);
});


test('doctor reports Node platform and built-in backends without calling a provider', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'spencer-node-'));
  const output = execFileSync(process.execPath, [wrapper, '--doctor', '--cwd', workspace], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.node.startsWith('v'), true);
  assert.equal(result.apiKey, 'missing');
  assert.ok(result.availableBackends.includes('anthropic-messages'));
  assert.ok(result.availableBackends.includes('ollama-chat'));
});


test('supports a registered custom provider backend', () => {
  provider.registerBackend('test-node-backend', () => ({
    buildPayload: () => ({}),
    normalizeResponse: () => ({ choices: [{ message: { content: 'ok', tool_calls: [] } }] }),
  }));
  assert.ok(provider.availableBackends().includes('test-node-backend'));
});
