"""NanFeng agent (R2 · Renato): the brain that reads documents, plans with the quant tools, proposes
actions through the backend's policy engine and talks to people over WhatsApp, SMS, email and voice.

Every provider (OpenRouter, Mistral OCR, Zavu, ElevenLabs) is optional: without its key the agent runs
in offline mode with deterministic stand-ins, so the demo and CI never depend on a paid API.
"""

__version__ = "0.1.0"
