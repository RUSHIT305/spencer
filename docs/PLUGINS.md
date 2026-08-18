# Spencer backend plugins

Spencer ships with built-in `generic-json`, `openai-compatible`, `anthropic-messages`, and `ollama-chat` backends. It is also extensible through Node package plugins. Spencer itself is installed only with npm; a plugin is an optional runtime package for organizations with a custom API contract.

## Plugin package

Create a normal Node package and export a backend factory through the `spencer.backends` field in `package.json`:

```json
{
  "name": "my-spencer-backend",
  "exports": {
    ".": "./index.js"
  },
  "spencer": {
    "backend": "my-provider"
  }
}
```

A backend implements `buildPayload(model, messages, tools)` and `normalizeResponse(data)`:

```js
export function createBackend(settings) {
  return {
    buildPayload(model, messages, tools) {
      return { model, prompt: messages, functions: tools };
    },
    normalizeResponse(data) {
      return {
        choices: [{
          message: {
            content: data.answer,
            tool_calls: data.actions ?? [],
          },
        }],
      };
    },
  };
}
```

Keep authentication, retries, and workspace safety in Spencer. The plugin should focus on translating request and response shapes.

## Runtime use

The built-in CLI supports the standard backends directly. Custom plugin loading can be registered by a Node integration before creating an `Agent`:

```js
const { registerBackend } = require('spencer-agent/lib/provider.js');
registerBackend('my-provider', require('my-spencer-backend').createBackend);
```

Then configure the endpoint at runtime:

```bash
export SPENCER_API_PROTOCOL="my-provider"
export SPENCER_API_URL="https://provider.example/generate"
export SPENCER_MODEL="coding-model"
spencer "Fix the failing test"
```

A plugin should include Node tests for request serialization, response normalization, tool calls, and provider errors. It should not require users to install Python, a Python package manager, or a vendor SDK.
