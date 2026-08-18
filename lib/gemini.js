'use strict';

const { setTimeout: sleep } = require('node:timers/promises');
const { MANAGED_ENDPOINT, MANAGED_MODEL } = require('./config.js');

class ManagedGeminiError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ManagedGeminiError';
  }
}

class RetryableManagedGeminiError extends ManagedGeminiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'RetryableManagedGeminiError';
  }
}

function toJson(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function requestJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new ManagedGeminiError(`Managed Gemini service returned non-JSON HTTP ${response.status}`); }
    if (!response.ok) {
      const ErrorType = response.status === 429 || response.status >= 500 ? RetryableManagedGeminiError : ManagedGeminiError;
      throw new ErrorType(`Managed Gemini service HTTP ${response.status}: ${JSON.stringify(body).slice(0, 1000)}`);
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new RetryableManagedGeminiError(`Managed Gemini request timed out after ${timeoutMs}ms`);
    if (error instanceof ManagedGeminiError) throw error;
    throw new RetryableManagedGeminiError(`Managed Gemini network error: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function complete(request, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const retries = options.retries ?? 2;
  const transport = options.transport ?? requestJson;
  const payload = { model: MANAGED_MODEL, messages: request.messages, tools: request.tools };
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await transport(MANAGED_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-spencer-client': 'spencer-agent',
        },
        body: JSON.stringify(payload),
      }, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!(error instanceof RetryableManagedGeminiError) || attempt >= retries) break;
      await sleep(2 ** attempt * 150);
    }
  }
  throw new ManagedGeminiError(`Managed Gemini request failed after ${retries + 1} attempts: ${lastError?.message ?? lastError}`);
}

module.exports = { MANAGED_MODEL, ManagedGeminiError, RetryableManagedGeminiError, complete, requestJson, toJson };
