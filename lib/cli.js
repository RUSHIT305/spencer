'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { Agent } = require('./agent.js');
const { ManagedGeminiError } = require('./gemini.js');
const { MANAGED_BACKEND, MANAGED_MODEL, settings } = require('./config.js');
const { TOOL_SCHEMAS, ToolRegistry } = require('./tools.js');
const { Workspace, WorkspaceError } = require('./workspace.js');

const VERSION = '0.5.1';

function parseArgs(argv) {
  const options = {};
  const positionals = [];
  const expectsValue = new Set(['cwd', 'max-steps', 'timeout']);
  const flags = new Set(['yes', 'json', 'quiet', 'init', 'doctor', 'version', 'help']);
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
    } else throw new Error(`Unknown option: --${rawKey}. Spencer manages the AI backend automatically.`);
  }
  return { options, positionals };
}

function help() {
  return `Spencer ${VERSION} — your coding partner in the terminal.

Usage:
  spencer
  spencer "your coding task"

When run without a task in an interactive terminal, Spencer prompts for the task and uses the current directory as the workspace.

Installation:
  npm install --global spencer-agent

Workspace options:
  --cwd PATH                 Workspace directory.
  --max-steps N              Maximum agent turns.
  --timeout SECONDS          Shell command timeout.

Modes:
  --yes                      Approve writes and commands automatically.
  --json                     Emit one JSON result.
  --quiet                    Suppress progress events.
  --doctor                   Show Spencer and managed-backend diagnostics.
  --version                 Print the version.
  --help                    Show this help.

Spencer includes a company-managed Gemini backend. API credentials and provider configuration are never required from users.
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

function doctor(runtimeSettings) {
  console.log(JSON.stringify({
    version: VERSION,
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    workspace: runtimeSettings.workspace,
    backend: MANAGED_BACKEND,
    model: MANAGED_MODEL,
    credentials: 'managed by Spencer',
    userApiConfiguration: false,
  }, null, 2));
  return 0;
}

async function readTask(positionals, {
  input = stdin,
  output = stdout,
  createInterface = readline.createInterface,
} = {}) {
  const task = positionals.join(' ').trim();
  if (task || !input.isTTY) return task;
  const rl = createInterface({ input, output });
  try {
    return (await rl.question('What would you like Spencer to work on? ')).trim();
  } finally {
    rl.close();
  }
}

async function main(argv = process.argv.slice(2)) {
  try {
    const { options, positionals } = parseArgs(argv);
    if (options.help) { console.log(help()); return 0; }
    if (options.version) { console.log(`spencer ${VERSION}`); return 0; }
    const workspace = options.cwd ?? process.cwd();
    const runtimeSettings = settings(workspace, {
      maxSteps: options['max-steps'] ? Number(options['max-steps']) : undefined,
      commandTimeoutMs: options.timeout ? Number(options.timeout) * 1000 : undefined,
      autoApprove: options.yes === true,
    });
    if (options.doctor) return doctor(runtimeSettings);
    if (options.init) { console.log('Spencer does not require an API configuration file. The managed Gemini backend is ready automatically.'); return 0; }
    const task = await readTask(positionals);
    if (!task) {
      console.error('A coding task is required. Run `spencer --help` for usage.');
      return 2;
    }
    const workspaceTools = new Workspace(runtimeSettings.workspace, { maxOutputChars: runtimeSettings.maxOutputChars, commandTimeoutMs: runtimeSettings.commandTimeoutMs });
    const registry = new ToolRegistry(workspaceTools);
    const quiet = options.quiet || options.json;
    const agent = new Agent(runtimeSettings, registry, {
      approve: runtimeSettings.autoApprove ? () => true : approveAction,
      onEvent: (kind, payload) => eventPrinter(kind, payload, quiet),
    });
    if (!quiet) { console.log(`Spencer workspace: ${runtimeSettings.workspace}`); console.log(`Spencer backend: ${MANAGED_BACKEND}`); }
    const message = await agent.run(task);
    if (options.json) console.log(JSON.stringify({ status: 'ok', message }));
    else console.log(`\nSpencer: ${message}`);
    return 0;
  } catch (error) {
    const prefix = error instanceof ManagedGeminiError || error instanceof WorkspaceError ? 'Spencer error' : 'Spencer configuration error';
    console.error(`${prefix}: ${error.message}`);
    return 1;
  }
}

module.exports = { MANAGED_BACKEND, MANAGED_MODEL, VERSION, doctor, help, main, parseArgs, readTask };
