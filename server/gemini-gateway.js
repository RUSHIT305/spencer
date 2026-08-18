'use strict';

const http = require('node:http');

const PORT = Number(process.env.PORT || 8787);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_BODY_BYTES = 2_000_000;
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);
const requestWindows = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function geminiContents(messages) {
  return messages.filter((message) => message.role !== 'system').map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'user',
        parts: [{ functionResponse: { name: message.name || message.tool_call_id || 'tool', response: { result: String(message.content ?? '') } } }],
      };
    }
    const parts = [];
    if (message.content) parts.push({ text: String(message.content) });
    for (const call of message.tool_calls || []) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* malformed model arguments remain empty */ }
      parts.push({ functionCall: { name: call.function?.name || '', args } });
    }
    return { role: message.role === 'assistant' ? 'model' : 'user', parts: parts.length ? parts : [{ text: '' }] };
  });
}

function systemInstruction(messages) {
  const text = messages.filter((message) => message.role === 'system').map((message) => String(message.content || '')).join('\n\n');
  return text ? { parts: [{ text }] } : undefined;
}

function geminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return { type: 'OBJECT', properties: {} };
  const result = { ...schema };
  if (typeof result.type === 'string') result.type = result.type.toUpperCase();
  if (result.properties && typeof result.properties === 'object') {
    result.properties = Object.fromEntries(Object.entries(result.properties).map(([key, value]) => [key, geminiSchema(value)]));
  }
  if (result.items) result.items = geminiSchema(result.items);
  return result;
}

function geminiTools(tools) {
  const declarations = (tools || []).map((tool) => ({
    name: tool.function.name,
    description: tool.function.description || '',
    parameters: geminiSchema(tool.function.parameters),
  }));
  return declarations.length ? [{ functionDeclarations: declarations }] : undefined;
}

function normalizeGemini(body) {
  const candidate = body?.candidates?.[0];
  if (!candidate) throw new Error(body?.promptFeedback?.blockReason ? `Gemini blocked the request: ${body.promptFeedback.blockReason}` : 'Gemini returned no candidate');
  const parts = candidate.content?.parts || [];
  const text = parts.filter((part) => typeof part.text === 'string').map((part) => part.text).join('\n');
  const toolCalls = parts.filter((part) => part.functionCall).map((part, index) => ({
    id: `gemini-call-${index + 1}`,
    function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args || {}) },
  }));
  return { choices: [{ message: { content: text || null, tool_calls: toolCalls } }] };
}

async function callGemini(request) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const payload = {
    contents: geminiContents(request.messages || []),
    systemInstruction: systemInstruction(request.messages || []),
    tools: geminiTools(request.tools),
    generationConfig: { temperature: 0.2 },
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${JSON.stringify(body).slice(0, 1200)}`);
  return normalizeGemini(body);
}

function clientAddress(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function allowedRequest(req) {
  const now = Date.now();
  const key = clientAddress(req);
  const current = requestWindows.get(key) || { startedAt: now, count: 0 };
  if (now - current.startedAt >= 60_000) { current.startedAt = now; current.count = 0; }
  current.count += 1;
  requestWindows.set(key, current);
  if (requestWindows.size > 10_000) {
    for (const [address, window] of requestWindows) if (now - window.startedAt >= 60_000) requestWindows.delete(address);
  }
  return current.count <= RATE_LIMIT_PER_MINUTE;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) { reject(new Error('Request body is too large')); req.destroy(); return; }
      text += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(text || '{}')); } catch { reject(new Error('Request body must be valid JSON')); }
    });
    req.on('error', reject);
  });
}

function createServer(options = {}) {
  const call = options.callGemini || callGemini;
  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { status: 'ok', service: 'spencer-managed-gemini' });
    if (req.method !== 'POST' || req.url !== '/v1/generate') return json(res, 404, { error: 'not_found' });
    if (!allowedRequest(req)) return json(res, 429, { error: 'rate_limited', retry_after_seconds: 60 });
    if (!GEMINI_API_KEY && !options.callGemini) return json(res, 503, { error: 'managed_backend_unavailable' });
    try {
      const request = await readBody(req);
      if (!Array.isArray(request.messages)) return json(res, 400, { error: 'messages_required' });
      return json(res, 200, await call(request));
    } catch (error) {
      return json(res, 502, { error: 'managed_backend_error', message: error.message });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, '0.0.0.0', () => console.log(`Spencer managed Gemini gateway listening on ${PORT}`));
}

module.exports = { GEMINI_MODEL, RATE_LIMIT_PER_MINUTE, allowedRequest, clientAddress, createServer, geminiContents, geminiSchema, geminiTools, normalizeGemini, systemInstruction };
