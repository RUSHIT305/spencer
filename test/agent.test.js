const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { Agent } = require('../lib/agent.js');
const { ToolRegistry } = require('../lib/tools.js');
const { Workspace } = require('../lib/workspace.js');


test('agent executes an approved tool and returns the provider final response', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spencer-agent-'));
  const workspace = new Workspace(root);
  const registry = new ToolRegistry(workspace);
  const responses = [
    { choices: [{ message: { content: '', tool_calls: [{ id: 'call-1', function: { name: 'write_file', arguments: JSON.stringify({ path: 'note.txt', content: 'hello\n' }) } }] } }] },
    { choices: [{ message: { content: 'Done.', tool_calls: [] } }] },
  ];
  const events = [];
  const agent = new Agent({ workspace: root, model: 'test', maxSteps: 3 }, registry, {
    provider: { complete: async () => responses.shift() },
    approve: async (name) => name === 'write_file',
    onEvent: (kind) => events.push(kind),
  });
  const result = await agent.run('Create note.txt');
  assert.equal(result, 'Done.');
  assert.equal(fs.readFileSync(path.join(root, 'note.txt'), 'utf8'), 'hello\n');
  assert.ok(events.includes('tool_result'));
});


test('agent denies mutations when approval is not granted', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spencer-agent-'));
  const registry = new ToolRegistry(new Workspace(root));
  const messages = [];
  const agent = new Agent({ workspace: root, model: 'test', maxSteps: 2 }, registry, {
    provider: { complete: async ({ messages: current }) => {
      messages.push(current);
      return messages.length === 1
        ? { choices: [{ message: { content: '', tool_calls: [{ id: 'call-1', function: { name: 'write_file', arguments: JSON.stringify({ path: 'denied.txt', content: 'no' }) } }] } }] }
        : { choices: [{ message: { content: 'Stopped safely.', tool_calls: [] } }] };
    } },
    approve: async () => false,
  });
  assert.equal(await agent.run('Write a file'), 'Stopped safely.');
  assert.equal(fs.existsSync(path.join(root, 'denied.txt')), false);
});
