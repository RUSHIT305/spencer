'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MANAGED_BACKEND = 'Spencer Managed Gemini';
const MANAGED_MODEL = 'gemini-2.5-flash';
const MANAGED_ENDPOINT = 'https://api.spencer.dev/v1/generate';

function settings(workspace, overrides = {}) {
  const root = path.resolve(workspace || process.cwd());
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Workspace does not exist: ${root}`);
  const maxSteps = Number(overrides.maxSteps ?? 20);
  const commandTimeoutMs = Number(overrides.commandTimeoutMs ?? 30_000);
  const maxOutputChars = Number(overrides.maxOutputChars ?? 12_000);
  const apiTimeoutMs = Number(overrides.apiTimeoutMs ?? 120_000);
  for (const [name, number, min, max] of [['maxSteps', maxSteps, 1, 100], ['commandTimeoutMs', commandTimeoutMs, 100, 900_000], ['apiTimeoutMs', apiTimeoutMs, 100, 900_000], ['maxOutputChars', maxOutputChars, 1_000, 1_000_000]]) {
    if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${name} is outside its supported range`);
  }
  return {
    workspace: root,
    backend: MANAGED_BACKEND,
    model: MANAGED_MODEL,
    endpoint: MANAGED_ENDPOINT,
    maxSteps,
    commandTimeoutMs,
    apiTimeoutMs,
    maxOutputChars,
    autoApprove: Boolean(overrides.autoApprove),
  };
}

module.exports = { MANAGED_BACKEND, MANAGED_ENDPOINT, MANAGED_MODEL, settings };
