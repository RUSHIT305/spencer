from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from .config import Settings
from .provider import HTTPProvider, ProviderResponse
from .tools import TOOL_SCHEMAS, ToolRegistry
from .workspace import WorkspaceError

SYSTEM_PROMPT = """You are Spencer, a careful coding agent operating inside one repository.

Your job is to complete the user's coding task, not merely describe a solution. Work in small,
verifiable steps:
1. Inspect the repository before making assumptions.
2. Read the relevant files and understand existing conventions.
3. Make the smallest coherent change that satisfies the task.
4. Run focused tests, linters, or checks after changes.
5. Report what changed and any remaining uncertainty.

Rules:
- All paths are relative to the workspace root. Never attempt to escape it.
- Do not modify unrelated files.
- Prefer existing dependencies and patterns over introducing new ones.
- Never claim a command ran or a test passed unless tool output confirms it.
- Use write_file only for intentional changes, and include the complete intended file content.
- You may inspect freely, but file writes and shell commands may require user approval.
- Do not run destructive commands, access secrets, or expose credentials.
"""


EventCallback = Callable[[str, dict[str, Any]], None]
ApprovalCallback = Callable[[str, dict[str, Any]], bool]


class Agent:
    """Orchestrates model responses and repository tools."""

    def __init__(
        self,
        settings: Settings,
        registry: ToolRegistry,
        *,
        provider: HTTPProvider | Any | None = None,
        approve: ApprovalCallback | None = None,
        on_event: EventCallback | None = None,
    ):
        self.settings = settings
        self.registry = registry
        self.provider = provider or HTTPProvider(settings)
        self.approve = approve or (lambda _name, _args: False)
        self.on_event = on_event or (lambda _kind, _payload: None)

    def run(self, task: str) -> str:
        if not task.strip():
            raise ValueError("Task cannot be empty.")
        snapshot = self.registry.workspace.snapshot()
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Workspace snapshot:\n{json.dumps(snapshot, indent=2)}\n\n"
                    f"User task:\n{task.strip()}"
                ),
            },
        ]

        for step in range(1, self.settings.max_steps + 1):
            self.on_event("step", {"step": step, "max_steps": self.settings.max_steps})
            response = self._complete(messages)
            if not getattr(response, "choices", None):
                raise RuntimeError("Provider returned no choices.")
            message = response.choices[0].message
            tool_calls = message.tool_calls or []
            assistant_message: dict[str, Any] = {
                "role": "assistant",
                "content": message.content or "",
            }
            if tool_calls:
                assistant_message["tool_calls"] = [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.function.name,
                            "arguments": call.function.arguments,
                        },
                    }
                    for call in tool_calls
                ]
            messages.append(assistant_message)

            if not tool_calls:
                return message.content or "Spencer finished without a final text response."

            for call in tool_calls:
                name = call.function.name
                try:
                    arguments = self.registry.arguments(call.function.arguments)
                    if name in {"write_file", "run_command"} and not self.approve(name, arguments):
                        result = (
                            "Action denied by user. Do not retry the same action "
                            "without a meaningful change in plan."
                        )
                        self.on_event("denied", {"name": name, "arguments": arguments})
                    else:
                        self.on_event("tool", {"name": name, "arguments": arguments})
                        result = self.registry.execute(name, arguments)
                        self.on_event("tool_result", {"name": name, "result": result})
                except (WorkspaceError, ValueError, json.JSONDecodeError) as exc:
                    result = f"Tool error: {exc}"
                    self.on_event("tool_error", {"name": name, "error": str(exc)})
                except Exception as exc:  # Keep the loop alive for provider/tool edge cases.
                    result = f"Unexpected tool error: {type(exc).__name__}: {exc}"
                    self.on_event("tool_error", {"name": name, "error": result})
                messages.append({"role": "tool", "tool_call_id": call.id, "content": result})

        return (
            f"Reached the maximum of {self.settings.max_steps} agent steps. "
            "Review the repository state and run Spencer again with a narrower task if needed."
        )

    def _complete(self, messages: list[dict[str, Any]]) -> ProviderResponse:
        return self.provider.complete(
            model=self.settings.model, messages=messages, tools=TOOL_SCHEMAS
        )
