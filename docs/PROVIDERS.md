# Provider configuration

Spencer is provider-neutral and npm-only. It uses Node’s built-in `fetch` implementation to send JSON over HTTP. No provider SDK, Python package, local runtime, or provider-specific installation is required.

Choose a protocol adapter, set the endpoint and model, then provide credentials through environment variables or `.spencer.toml`.

## Generic JSON API

Use this for a custom HTTP service. Response paths can map a provider-specific JSON envelope into Spencer’s normalized response.

```bash
export SPENCER_API_PROTOCOL="generic-json"
export SPENCER_API_URL="https://api.example.com/v1/generate"
export SPENCER_API_KEY="your-key"
export SPENCER_MODEL="coding-model"
export SPENCER_API_KEY_HEADER="X-API-Key"
export SPENCER_API_KEY_PREFIX=""
export SPENCER_CONTENT_PATH="result.text"
export SPENCER_TOOL_CALLS_PATH="result.actions"
```

## OpenAI-compatible API

Use this for an API gateway that follows the common chat-completions request and tool-call response shape. Spencer supports this protocol for compatibility; it does not require an OpenAI account or SDK.

```bash
export SPENCER_API_PROTOCOL="openai-compatible"
export SPENCER_API_URL="https://gateway.example.com/v1/chat/completions"
export SPENCER_API_KEY="your-key"
export SPENCER_MODEL="coding-model"
```

## Anthropic Messages

Use the built-in Messages adapter for content blocks and tool-use blocks. Configure any required version or organization headers through `SPENCER_API_HEADERS`.

```bash
export SPENCER_API_PROTOCOL="anthropic-messages"
export SPENCER_API_URL="https://api.example.com/v1/messages"
export SPENCER_API_KEY="your-key"
export SPENCER_API_KEY_HEADER="x-api-key"
export SPENCER_API_KEY_PREFIX=""
export SPENCER_API_HEADERS='{"anthropic-version":"2023-06-01"}'
export SPENCER_MODEL="coding-model"
```

## Ollama Chat

Use the built-in Ollama adapter for a local model server. Installing Ollama itself is optional and separate from installing Spencer; Spencer only needs the HTTP endpoint at runtime.

```bash
export SPENCER_API_PROTOCOL="ollama-chat"
export SPENCER_API_URL="http://localhost:11434/api/chat"
export SPENCER_MODEL="qwen2.5-coder"
```

## Custom request fields

Add provider-specific JSON request fields without changing Spencer:

```bash
export SPENCER_REQUEST_FIELDS='{"provider_option":"value"}'
export SPENCER_API_HEADERS='{"X-Project":"spencer"}'
```

The same settings can be stored in `.spencer.toml`:

```toml
[agent]
protocol = "generic-json"
api_url = "https://api.example.com/v1/generate"
model = "coding-model"
api_key_header = "X-API-Key"
api_key_prefix = ""
headers = { "X-Project" = "spencer" }
request_fields = { "provider_option" = "value" }
content_path = "result.text"
tool_calls_path = "result.actions"
```

## Backend plugins

Install Spencer only with npm. If your organization needs a different request or response contract, ship a Node backend plugin through the `spencer.backends` package export. The plugin is a runtime extension, not an installation prerequisite for Spencer.
