const assert = require('node:assert/strict');
const test = require('node:test');
const { complete, ProviderError, RetryableProviderError } = require('../lib/provider.js');

function settings(overrides = {}) {
  return {
    protocol: 'generic-json',
    model: 'test-model',
    apiUrl: 'https://provider.example/chat',
    apiKey: 'secret',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer',
    headers: {},
    requestFields: {},
    apiTimeoutMs: 1_000,
    contentPath: 'choices.0.message.content',
    toolCallsPath: 'choices.0.message.tool_calls',
    ...overrides,
  };
}


test('generic provider normalizes response and sends auth', async () => {
  let request;
  const response = await complete(settings({ requestFields: { temperature: 0 } }), {
    model: 'test-model',
    messages: [{ role: 'user', content: 'List files.' }],
    tools: [],
  }, {
    retries: 0,
    transport: async (url, options) => {
      request = { url, options };
      return { choices: [{ message: { content: 'done', tool_calls: [] } }] };
    },
  });
  assert.equal(response.choices[0].message.content, 'done');
  assert.equal(request.url, 'https://provider.example/chat');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.equal(JSON.parse(request.options.body).temperature, 0);
});


test('provider retries transient failures and stops on success', async () => {
  let attempts = 0;
  const response = await complete(settings(), { model: 'test-model', messages: [], tools: [] }, {
    retries: 2,
    transport: async () => {
      attempts += 1;
      if (attempts < 2) throw new RetryableProviderError('temporary');
      return { choices: [{ message: { content: 'recovered', tool_calls: [] } }] };
    },
  });
  assert.equal(attempts, 2);
  assert.equal(response.choices[0].message.content, 'recovered');
});


test('Anthropic and Ollama responses normalize through the same contract', async () => {
  const anthropic = await complete(settings({ protocol: 'anthropic-messages' }), { model: 'm', messages: [], tools: [] }, {
    retries: 0,
    transport: async () => ({ content: [{ type: 'text', text: 'anthropic' }, { type: 'tool_use', id: 't1', name: 'list_files', input: { depth: 1 } }] }),
  });
  assert.equal(anthropic.choices[0].message.content, 'anthropic');
  assert.equal(anthropic.choices[0].message.tool_calls[0].function.name, 'list_files');

  const ollama = await complete(settings({ protocol: 'ollama-chat', apiUrl: 'http://localhost:11434/api/chat' }), { model: 'm', messages: [], tools: [] }, {
    retries: 0,
    transport: async () => ({ message: { content: 'local', tool_calls: [] } }),
  });
  assert.equal(ollama.choices[0].message.content, 'local');
});


test('provider reports missing endpoint clearly', async () => {
  await assert.rejects(() => complete(settings({ apiUrl: null }), { model: 'm', messages: [], tools: [] }), ProviderError);
});
