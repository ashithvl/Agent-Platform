"""Placeholder for Guardrails AI integration."""


def validate_output(text: str) -> str:
    # MVP: pass-through; extend with schema / policy checks.
    if len(text) > 32000:
        return text[:32000] + "\n[truncated]"
    return text
