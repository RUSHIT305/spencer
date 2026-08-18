# Provider configuration

Spencer separates the agent from the model transport. Choose a protocol adapter, point `api_url` at the provider endpoint, set the model ID, and configure authentication headers when required.

## Generic JSON API

Use this for a custom service that accepts a JSON body and returns a JSON object. The default response mapping expects a chat-completions-style response, but dotted paths can map another shape.

```toml
[agent]
protocol = "generic-json"
api_url = "https://api.example.com/v1/generate"
model = "coding-model"
api_key_header = "X-API-Key"
api_key_prefix = ""
request_fields = { "provider_option" = "value" }
content_path = "result.text"
tool_calls_path = "result.actions"
```

## OpenAI-compatible API

Use this for gateways and hosted services that implement the common chat-completions request and tool-call response structure.

```toml
[agent]
protocol = "openai-compatible"
api_url = "https://gateway.example.com/v1/chat/completions"
model = "coding-model"
api_key_header = "Authorization"
api_key_prefix = "Bearer"
content_path = "choices.0.message.content"
tool_calls_path = "choices.0.message.tool_calls"
```

Spencer supports this protocol for compatibility, but it does not require an OpenAI account or SDK.

## Anthropic Messages

Use the Messages adapter for a provider that accepts Anthropic-style content blocks and tool use. Configure the provider’s required headers through `headers`.

```toml
[agent]
protocol = "anthropic-messages"
api_url = "https://api.example.com/v1/messages"
model = "coding-model"
api_key_header = "x-api-key"
api_key_prefix = ""
headers = { "anthropic-version" = "2023-06-01" }
```

## Ollama Chat

Use the Ollama adapter for a local Ollama server. The API key can be omitted.

```toml
[agent]
protocol = "ollama-chat"
api_url = "http://localhost:11434/api/chat"
model = "qwen2.5-coder"
api_key_header = "Authorization"
api_key_prefix = ""
```

## Custom response shapes

For a generic JSON API, `content_path` and `tool_calls_path` are dotted paths. Array indexes are supported. For example, `data.answer.text` reads a nested string, while `data.actions.0` reads the first array element. Tool-call objects should contain a name and arguments, either directly or under a `function` object. Arguments may be a JSON string or an object. Use `request_fields` or `SPENCER_REQUEST_FIELDS` to add provider-specific JSON fields to the request body.

If a provider uses a different request body—not just a different response envelope—add a protocol adapter in `src/spencer/provider.py` and cover it with a transport-level test. The agent, workspace tools, approvals, and CLI do not need to change.
