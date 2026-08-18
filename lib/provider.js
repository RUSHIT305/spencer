'use strict';

const { setTimeout: sleep } = require('node:timers/promises');

const BUILTIN_PROTOCOLS = ['generic-json', 'openai-compatible', 'anthropic-messages', 'ollama-chat'];
const backends = new Map();

class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ProviderError';
  }
}

class RetryableProviderError extends ProviderError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'RetryableProviderError';
  }
}

function registerBackend(name, factory) {
  if (!name || typeof name !== 'string') throw new TypeError('Backend name must be a non-empty string');
  if (typeof factory !== 'function') throw new TypeError('Backend factory must be a function');
  backends.set(name, factory);
}

function availableBackends() {
  return [...new Set([...BUILTIN_PROTOCOLS, ...backends.keys()])].sort();
}

function valueAtPath(data, dottedPath, fallback = undefined) {
  let current = data;
  for (const component of String(dottedPath).split('.')) {
    if (Array.isArray(current) && /^\d+$/.test(component)) {
      current = current[Number(component)];
    } else if (current && typeof current === 'object' && component in current) {
      current = current[component];
    } else {
      return fallback;
    }
  }
  return current;
}

function toolCallFromMapping(item, index) {
  if (!item || typeof item !== 'object') return { id: `tool-${index}`, function: { name: '', arguments: '{}' } };
  const fn = item.function && typeof item.function === 'object' ? item.function : item;
  let argumentsValue = fn.arguments ?? fn.input ?? {};
  if (typeof argumentsValue !== 'string') argumentsValue = JSON.stringify(argumentsValue);
  return {
    id: String(item.id ?? `tool-${index}`),
    function: { name: String(fn.name ?? item.name ?? ''), arguments: argumentsValue },
  };
}

function normalizeGeneric(data, settings) {
  const contentValue = valueAtPath(data, settings.contentPath);
  const content = contentValue == null ? null : String(contentValue);
  const rawCalls = valueAtPath(data, settings.toolCallsPath, []);
  const toolCalls = Array.isArray(rawCalls) ? rawCalls.map(toolCallFromMapping) : [];
  if (!content && !toolCalls.length && data && data.error) throw new ProviderError(`Provider returned an error: ${JSON.stringify(data.error)}`);
  return { choices: [{ message: { content, tool_calls: toolCalls } }] };
}

function toAnthropicMessages(messages) {
  const system = messages.filter((message) => message.role === 'system').map((message) => String(message.content ?? '')).join('\n\n');
  const converted = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    if (message.role === 'tool') {
      converted.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: message.tool_call_id ?? 'unknown', content: String(message.content ?? '') }] });
    } else if (message.role === 'assistant' && message.tool_calls?.length) {
      const blocks = [];
      if (message.content) blocks.push({ type: 'text', text: message.content });
      for (const call of message.tool_calls) {
        let input = {};
        try { input = JSON.parse(call.function?.arguments ?? '{}'); } catch { /* leave empty */ }
        blocks.push({ type: 'tool_use', id: call.id ?? 'unknown', name: call.function?.name ?? '', input });
      }
      converted.push({ role: 'assistant', content: blocks });
    } else {
      converted.push({ role: message.role === 'user' ? 'user' : 'assistant', content: message.content ?? '' });
    }
  }
  return { system, messages: converted };
}

function anthropicPayload(model, messages, tools, settings) {
  const converted = toAnthropicMessages(messages);
  return {
    ...settings.requestFields,
    model,
    system: converted.system,
    messages: converted.messages,
    max_tokens: 4500,
    tools: tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description ?? '',
      input_schema: tool.function.parameters ?? {},
    })),
  };
}

function normalizeAnthropic(data) {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n');
  const toolCalls = blocks.filter((block) => block.type === 'tool_use').map((block, index) => ({
    id: String(block.id ?? `tool-${index}`),
    function: { name: String(block.name ?? ''), arguments: JSON.stringify(block.input ?? {}) },
  }));
  return { choices: [{ message: { content: text || null, tool_calls: toolCalls } }] };
}

function createBuiltinBackend(protocol, settings) {
  if (protocol === 'anthropic-messages') {
    return {
      buildPayload: (model, messages, tools) => anthropicPayload(model, messages, tools, settings),
      normalizeResponse: normalizeAnthropic,
    };
  }
  if (protocol === 'ollama-chat') {
    return {
      buildPayload: (model, messages, tools) => ({ ...settings.requestFields, model, messages, tools, stream: false }),
      normalizeResponse: (data) => ({ choices: [{ message: { content: data?.message?.content ?? null, tool_calls: (data?.message?.tool_calls ?? []).map(toolCallFromMapping) } }] }),
    };
  }
  return {
    buildPayload: (model, messages, tools) => ({ ...settings.requestFields, model, messages, tools, tool_choice: 'auto' }),
    normalizeResponse: (data) => normalizeGeneric(data, settings),
  };
}

function backendFor(settings) {
  const customFactory = backends.get(settings.protocol);
  if (customFactory) return customFactory(settings);
  if (BUILTIN_PROTOCOLS.includes(settings.protocol)) return createBuiltinBackend(settings.protocol, settings);
  throw new ProviderError(`Unknown provider protocol '${settings.protocol}'. Available backends: ${availableBackends().join(', ')}`);
}

function authHeaders(settings) {
  const headers = { 'content-type': 'application/json', ...(settings.headers ?? {}) };
  if (settings.apiKey && !headers[settings.apiKeyHeader]) {
    headers[settings.apiKeyHeader] = `${settings.apiKeyPrefix ?? 'Bearer'}${settings.apiKeyPrefix ? ' ' : ''}${settings.apiKey}`;
  }
  return headers;
}

async function requestJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new ProviderError(`Provider returned non-JSON HTTP ${response.status}`); }
    if (!response.ok) {
      const ErrorType = response.status === 429 || response.status >= 500 ? RetryableProviderError : ProviderError;
      throw new ErrorType(`Provider HTTP ${response.status}: ${JSON.stringify(body).slice(0, 1000)}`);
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new RetryableProviderError(`Provider request timed out after ${timeoutMs}ms`);
    if (error instanceof ProviderError) throw error;
    throw new RetryableProviderError(`Provider network error: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function complete(settings, { model, messages, tools }, options = {}) {
  if (!settings.apiUrl) throw new ProviderError('No API URL configured. Set SPENCER_API_URL or configure apiUrl.');
  const backend = options.backend ?? backendFor(settings);
  const transport = options.transport ?? requestJson;
  const payload = backend.buildPayload(model, messages, tools);
  let lastError;
  for (let attempt = 0; attempt <= (options.retries ?? 2); attempt += 1) {
    try {
      const raw = await transport(settings.apiUrl, { method: 'POST', headers: authHeaders(settings), body: JSON.stringify(payload) }, settings.apiTimeoutMs);
      return backend.normalizeResponse(raw);
    } catch (error) {
      lastError = error;
      if (!(error instanceof RetryableProviderError) || attempt >= (options.retries ?? 2)) break;
      await sleep(2 ** attempt * 100);
    }
  }
  throw new ProviderError(`Provider request failed after ${(options.retries ?? 2) + 1} attempts: ${lastError?.message ?? lastError}`);
}

module.exports = {
  BUILTIN_PROTOCOLS,
  ProviderError,
  RetryableProviderError,
  availableBackends,
  backendFor,
  complete,
  registerBackend,
  valueAtPath,
};
