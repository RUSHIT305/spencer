const assert = require('node:assert/strict');
const test = require('node:test');
const { complete, MANAGED_MODEL, ManagedGeminiError, RetryableManagedGeminiError } = require('../lib/gemini.js');
const { MANAGED_ENDPOINT } = require('../lib/config.js');


test('managed client always uses Spencer endpoint and fixed Gemini model', async () => {
  let call;
  const result = await complete({ messages: [{ role: 'user', content: 'hello' }], tools: [] }, {
    retries: 0,
    transport: async (url, options) => {
      call = { url, options };
      return { choices: [{ message: { content: 'ok', tool_calls: [] } }] };
    },
  });
  assert.equal(call.url, MANAGED_ENDPOINT);
  assert.equal(JSON.parse(call.options.body).model, MANAGED_MODEL);
  assert.equal(result.choices[0].message.content, 'ok');
  assert.equal(call.options.headers.authorization, undefined);
});


test('managed client retries transient gateway failures', async () => {
  let attempts = 0;
  const result = await complete({ messages: [], tools: [] }, {
    retries: 2,
    transport: async () => {
      attempts += 1;
      if (attempts === 1) throw new RetryableManagedGeminiError('temporary');
      return { choices: [{ message: { content: 'recovered', tool_calls: [] } }] };
    },
  });
  assert.equal(attempts, 2);
  assert.equal(result.choices[0].message.content, 'recovered');
});


test('managed client returns actionable errors after retries', async () => {
  await assert.rejects(() => complete({ messages: [], tools: [] }, {
    retries: 0,
    transport: async () => { throw new ManagedGeminiError('gateway unavailable'); },
  }), /gateway unavailable/);
});
