'use strict';

const { complete, ProviderError } = require('./provider.js');
const { TOOL_SCHEMAS } = require('./tools.js');

const SYSTEM_PROMPT = `You are Spencer, a careful coding agent operating inside one repository.

Your job is to complete the user's coding task, not merely describe a solution. Work in small, verifiable steps:
1. Inspect the repository before making assumptions.
2. Read relevant files and understand existing conventions.
3. Make the smallest coherent change that satisfies the task.
4. Run focused tests, linters, or checks after changes.
5. Report what changed and any remaining uncertainty.

Rules:
- All paths are relative to the workspace root. Never attempt to escape it.
- Do not modify unrelated files.
- Prefer existing dependencies and patterns over introducing new ones.
- Never claim a command ran or a test passed unless tool output confirms it.
- Use write_file only for intentional changes, with complete intended file content.
- You may inspect freely, but file writes and shell commands may require user approval.
- Do not run destructive commands, access secrets, or expose credentials.`;

class Agent {
  constructor(settings, registry, options = {}) {
    this.settings = settings;
    this.registry = registry;
    this.provider = options.provider ?? { complete: (request) => complete(settings, request) };
    this.approve = options.approve ?? (() => false);
    this.onEvent = options.onEvent ?? (() => {});
  }

  async run(task) {
    if (!String(task || '').trim()) throw new Error('Task cannot be empty.');
    const snapshot = this.registry.workspace.snapshot();
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Workspace snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nUser task:\n${task.trim()}` },
    ];

    for (let step = 1; step <= this.settings.maxSteps; step += 1) {
      this.onEvent('step', { step, maxSteps: this.settings.maxSteps });
      const response = await this.provider.complete({ model: this.settings.model, messages, tools: TOOL_SCHEMAS });
      if (!response?.choices?.length) throw new ProviderError('Provider returned no choices.');
      const message = response.choices[0].message ?? {};
      const toolCalls = message.tool_calls ?? [];
      const assistantMessage = { role: 'assistant', content: message.content ?? '' };
      if (toolCalls.length) assistantMessage.tool_calls = toolCalls;
      messages.push(assistantMessage);
      if (!toolCalls.length) return message.content || 'Spencer finished without a final text response.';

      for (const call of toolCalls) {
        const name = call.function?.name ?? '';
        let args;
        try { args = JSON.parse(call.function?.arguments ?? '{}'); } catch (error) { args = {}; }
        let result;
        try {
          if (['write_file', 'run_command'].includes(name) && !await this.approve(name, args)) {
            result = 'Action denied by user. Do not retry the same action without a meaningful change in plan.';
            this.onEvent('denied', { name, arguments: args });
          } else {
            this.onEvent('tool', { name, arguments: args });
            result = this.registry.execute(name, args);
            this.onEvent('tool_result', { name, result });
          }
        } catch (error) {
          result = `Tool error: ${error.message}`;
          this.onEvent('tool_error', { name, error: error.message });
        }
        messages.push({ role: 'tool', tool_call_id: call.id ?? `tool-${step}`, content: String(result) });
      }
    }
    return `Reached the maximum of ${this.settings.maxSteps} agent steps. Review the repository and rerun with a narrower task if needed.`;
  }
}

module.exports = { Agent, SYSTEM_PROMPT };
