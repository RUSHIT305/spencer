'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { Agent } = require('./agent.js');
const { availableBackends, ProviderError } = require('./provider.js');
const { configDir, defaultConfigText, settings } = require('./config.js');
const { TOOL_SCHEMAS, ToolRegistry } = require('./tools.js');
const { Workspace, WorkspaceError } = require('./workspace.js');

const VERSION = '0.4.0';

function parseArgs(argv) {
  const options = {};
  const positionals = [];
  const expectsValue = new Set(['cwd', 'config', 'protocol', 'model', 'api-url', 'api-key-header', 'api-key-prefix', 'headers', 'request-fields', 'api-timeout', 'max-steps', 'timeout']);
  const flags = new Set(['yes', 'json', 'quiet', 'verbose', 'init', 'doctor', 'version', 'help']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('-')) { positionals.push(token); continue; }
    const withoutDashes = token.replace(/^--?/, '');
    const [rawKey, inlineValue] = withoutDashes.split('=', 2);
    if (flags.has(rawKey)) options[rawKey] = true;
    else if (expectsValue.has(rawKey)) {
      const value = inlineValue ?? argv[++index];
      if (value == null) throw new Error(`Missing value for --${rawKey}`);
      options[rawKey] = value;
    } else throw new Error(`Unknown option: --${rawKey}`);
  }
  return { options, positionals };
}

function help() {
  return `Spencer ${VERSION} — your coding partner in the terminal.

Usage:
  spencer "your coding task"

Core options:
  --cwd PATH                 Workspace directory.
  --protocol NAME            Provider backend name.
  --model NAME               Provider model ID.
  --api-url URL              Provider HTTP endpoint.
  --api-key-header NAME      API-key header name.
  --api-key-prefix VALUE     API-key prefix; use an empty value for raw keys.
  --headers JSON             Extra request headers.
  --request-fields JSON      Extra JSON request fields.
  --api-timeout MS           Provider request timeout.
  --max-steps N              Maximum agent turns.
  --timeout SECONDS          Shell command timeout.

Modes:
  --yes                      Approve writes and commands automatically.
  --json                     Emit one JSON result.
  --quiet                    Suppress progress events.
  --doctor                   Show installation and provider diagnostics.
  --init                     Create a user configuration template.
  --version                 Print the version.
  --help                    Show this help.

Spencer is installed with npm and runs on Node.js 18+ across macOS, Linux, and Windows.
`;
}

function eventPrinter(kind, payload, quiet) {
  if (quiet) return;
  if (kind === 'step') console.log(`\n[step ${payload.step}/${payload.maxSteps}]`);
  else if (kind === 'tool') console.log(`[tool] ${payload.name}(${JSON.stringify(payload.arguments)})`);
  else if (kind === 'tool_result') console.log(`[result]\n${payload.result}`);
  else if (kind === 'denied') console.log(`[denied] ${payload.name}`);
  else if (kind === 'tool_error') console.error(`[tool error] ${payload.error}`);
}

async function approveAction(name, args) {
  if (!stdin.isTTY) return false;
  if (name === 'write_file') {
    const preview = String(args.content ?? '').slice(0, 600).replace(/\n/g, '\\n');
    console.log(`\nSpencer wants to replace ${args.path ?? '<unknown>'}.`);
    console.log(`Preview: ${preview}${String(args.content ?? '').length > 600 ? '…' : ''}`);
  } else if (name === 'run_command') console.log(`\nSpencer wants to run: ${args.command ?? '<unknown>'}`);
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try { return ['y', 'yes'].includes((await rl.question('Approve? [y/N] ')).trim().toLowerCase()); } finally { rl.close(); }
}

function initConfig() {
  const file = path.join(configDir(), 'config.toml');
  if (fs.existsSync(file)) { console.log(`Config already exists at ${file}; leaving it unchanged.`); return 0; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, defaultConfigText(), 'utf8');
  console.log(`Created ${file}`);
  return 0;
}

function doctor(settingsValue) {
  console.log(JSON.stringify({
    version: VERSION,
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    workspace: settingsValue.workspace,
    configFile: settingsValue.configFile ?? 'none',
    protocol: settingsValue.protocol,
    model: settingsValue.model,
    apiUrl: settingsValue.apiUrl ?? 'missing',
    apiKey: settingsValue.apiKey ? 'configured' : 'missing',
    apiKeyHeader: settingsValue.apiKeyHeader,
    availableBackends: availableBackends(),
  }, null, 2));
  return 0;
}

async function main(argv = process.argv.slice(2)) {
  try {
    const { options, positionals } = parseArgs(argv);
    if (options.help) { console.log(help()); return 0; }
    if (options.version) { console.log(`spencer ${VERSION}`); return 0; }
    const workspace = options.cwd ?? process.cwd();
    const overrides = {
      configFile: options.config,
      protocol: options.protocol,
      model: options.model,
      apiUrl: options['api-url'],
      apiKeyHeader: options['api-key-header'],
      apiKeyPrefix: options['api-key-prefix'],
      headers: options.headers ? JSON.parse(options.headers) : undefined,
      requestFields: options['request-fields'] ? JSON.parse(options['request-fields']) : undefined,
      apiTimeoutMs: options['api-timeout'] ? Number(options['api-timeout']) : undefined,
      maxSteps: options['max-steps'] ? Number(options['max-steps']) : undefined,
      commandTimeoutMs: options.timeout ? Number(options.timeout) * 1000 : undefined,
      autoApprove: options.yes === true ? true : undefined,
    };
    const runtimeSettings = settings(workspace, overrides);
    if (options.init) return initConfig();
    if (options.doctor) return doctor(runtimeSettings);
    const task = positionals.join(' ').trim();
    if (!task) { console.error('A coding task is required.'); return 2; }
    const workspaceTools = new Workspace(runtimeSettings.workspace, { maxOutputChars: runtimeSettings.maxOutputChars, commandTimeoutMs: runtimeSettings.commandTimeoutMs });
    const registry = new ToolRegistry(workspaceTools);
    const quiet = options.quiet || options.json;
    const agent = new Agent(runtimeSettings, registry, {
      approve: runtimeSettings.autoApprove ? () => true : approveAction,
      onEvent: (kind, payload) => eventPrinter(kind, payload, quiet),
    });
    if (!quiet) { console.log(`Spencer workspace: ${runtimeSettings.workspace}`); console.log(`Spencer protocol: ${runtimeSettings.protocol}`); }
    const message = await agent.run(task);
    if (options.json) console.log(JSON.stringify({ status: 'ok', message }));
    else console.log(`\nSpencer: ${message}`);
    return 0;
  } catch (error) {
    const prefix = error instanceof ProviderError || error instanceof WorkspaceError ? 'Spencer error' : 'Spencer configuration error';
    console.error(`${prefix}: ${error.message}`);
    return 1;
  }
}

module.exports = { VERSION, doctor, help, main, parseArgs };
