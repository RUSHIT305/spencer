const assert = require('node:assert/strict');
const test = require('node:test');
const { createServer } = require('../server/gemini-gateway.js');


test('managed gateway serves health and normalized generation responses', async (t) => {
  const server = createServer({ callGemini: async (request) => ({ choices: [{ message: { content: `received ${request.messages.length}`, tool_calls: [] } }] }) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const health = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }], tools: [] }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).choices[0].message.content, 'received 1');
});
