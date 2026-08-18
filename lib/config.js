'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BUILTIN_PROTOCOLS = ['generic-json', 'openai-compatible', 'anthropic-messages', 'ollama-chat'];

function configDir() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Spencer');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'spencer');
}

function stateDir() {
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Spencer');
  return path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'spencer');
}

function parseToml(text) {
  const result = {};
  let section = result;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = result[sectionMatch[1]] ?? (result[sectionMatch[1]] = {});
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    section[key] = parseTomlValue(rawValue.trim());
  }
  return result;
}

function parseTomlValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value === 'true' || value === 'false') return value === 'true';
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith('{') && value.endsWith('}')) {
    const object = {};
    for (const item of value.slice(1, -1).split(',')) {
      const match = item.trim().match(/^"?([^"=]+)"?\s*=\s*"?([^"=]+)"?$/);
      if (match) object[match[1].trim()] = match[2].trim();
    }
    return object;
  }
  return value;
}

function readConfig(file) {
  if (!file || !fs.existsSync(file)) return {};
  try { return parseToml(fs.readFileSync(file, 'utf8')); } catch (error) { throw new Error(`Unable to read configuration at ${file}: ${error.message}`); }
}

function fileValue(config, key, fallback) {
  const agent = config.agent && typeof config.agent === 'object' ? config.agent : config;
  return Object.prototype.hasOwnProperty.call(agent, key) ? agent[key] : fallback;
}

function jsonObject(value, label) {
  if (value == null || value === '') return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('must be an object');
    return parsed;
  } catch (error) {
    throw new Error(`${label} must be a JSON object: ${error.message}`);
  }
}

function settings(workspace, overrides = {}) {
  const root = path.resolve(workspace || process.cwd());
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Workspace does not exist: ${root}`);
  const explicit = overrides.configFile ? path.resolve(overrides.configFile) : null;
  if (explicit && !fs.existsSync(explicit)) throw new Error(`Configuration file does not exist: ${explicit}`);
  const candidates = [explicit, path.join(root, '.spencer.toml'), path.join(configDir(), 'config.toml')].filter(Boolean);
  const configFile = candidates.find((file) => fs.existsSync(file)) || null;
  const file = readConfig(configFile);
  const value = (override, envName, fileName, fallback) => override ?? process.env[envName] ?? fileValue(file, fileName, fallback);
  const protocol = value(overrides.protocol, 'SPENCER_API_PROTOCOL', 'protocol', 'generic-json');
  const model = value(overrides.model, 'SPENCER_MODEL', 'model', 'default');
  const apiUrl = value(overrides.apiUrl, 'SPENCER_API_URL', 'api_url', null) ?? process.env.SPENCER_API_BASE ?? fileValue(file, 'api_base', null);
  const apiKey = overrides.apiKey ?? process.env.SPENCER_API_KEY ?? fileValue(file, 'api_key', null);
  const apiKeyHeader = value(overrides.apiKeyHeader, 'SPENCER_API_KEY_HEADER', 'api_key_header', 'Authorization');
  const apiKeyPrefix = overrides.apiKeyPrefix ?? process.env.SPENCER_API_KEY_PREFIX ?? fileValue(file, 'api_key_prefix', 'Bearer');
  const headers = overrides.headers ?? (process.env.SPENCER_API_HEADERS ? jsonObject(process.env.SPENCER_API_HEADERS, 'headers') : fileValue(file, 'headers', {}));
  const requestFields = overrides.requestFields ?? (process.env.SPENCER_REQUEST_FIELDS ? jsonObject(process.env.SPENCER_REQUEST_FIELDS, 'request_fields') : fileValue(file, 'request_fields', {}));
  const maxSteps = Number(value(overrides.maxSteps, 'SPENCER_MAX_STEPS', 'max_steps', 20));
  const commandTimeoutMs = Number(value(overrides.commandTimeoutMs, 'SPENCER_COMMAND_TIMEOUT_MS', 'command_timeout_ms', 30_000));
  const apiTimeoutMs = Number(value(overrides.apiTimeoutMs, 'SPENCER_API_TIMEOUT_MS', 'api_timeout_ms', 120_000));
  const maxOutputChars = Number(value(overrides.maxOutputChars, 'SPENCER_MAX_OUTPUT_CHARS', 'max_output_chars', 12_000));
  const autoApprove = overrides.autoApprove ?? /^(1|true|yes|on)$/i.test(process.env.SPENCER_AUTO_APPROVE ?? String(fileValue(file, 'auto_approve', false)));
  const contentPath = value(undefined, 'SPENCER_CONTENT_PATH', 'content_path', 'choices.0.message.content');
  const toolCallsPath = value(undefined, 'SPENCER_TOOL_CALLS_PATH', 'tool_calls_path', 'choices.0.message.tool_calls');
  if (!String(protocol).trim()) throw new Error('protocol must be a non-empty backend name');
  if (!String(model).trim()) throw new Error('model must be a non-empty string');
  for (const [name, number, min, max] of [['maxSteps', maxSteps, 1, 100], ['commandTimeoutMs', commandTimeoutMs, 100, 900_000], ['apiTimeoutMs', apiTimeoutMs, 100, 900_000], ['maxOutputChars', maxOutputChars, 1_000, 1_000_000]]) {
    if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${name} is outside its supported range`);
  }
  return { workspace: root, protocol: String(protocol), model: String(model), apiUrl, apiKey, apiKeyHeader: String(apiKeyHeader), apiKeyPrefix: String(apiKeyPrefix ?? ''), headers, requestFields, maxSteps, commandTimeoutMs, apiTimeoutMs, maxOutputChars, autoApprove, contentPath: String(contentPath), toolCallsPath: String(toolCallsPath), configFile, stateDirectory: stateDir() };
}

function defaultConfigText() {
  return `# Spencer configuration. CLI flags override environment and file values.\n[agent]\nprotocol = "generic-json"\nmodel = "your-model-id"\napi_url = "https://your-provider.example/v1/chat/completions"\napi_key_header = "Authorization"\napi_key_prefix = "Bearer"\napi_timeout_ms = 120000\nmax_steps = 20\ncommand_timeout_ms = 30000\nauto_approve = false\nmax_output_chars = 12000\n`;
}

module.exports = { BUILTIN_PROTOCOLS, configDir, defaultConfigText, settings, stateDir };
