"""
LLM provider abstraction for Nova. Keys live server-side only (environment variables).
Add a provider by implementing `generate` and registering it in `get_provider`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from django.conf import settings

logger = logging.getLogger("codeverse.tutor")


class ProviderUnavailable(RuntimeError):
    pass


class ProviderError(RuntimeError):
    pass


@dataclass
class Completion:
    text: str
    model: str
    input_tokens: int
    output_tokens: int
    refused: bool = False


class NoProvider:
    name = "none"
    available = False

    def generate(self, system: str, messages: list[dict]) -> Completion:
        raise ProviderUnavailable("No AI provider is configured on this server.")


class AnthropicProvider:
    name = "anthropic"

    def __init__(self):
        import anthropic

        if not settings.ANTHROPIC_API_KEY:
            raise ProviderUnavailable("ANTHROPIC_API_KEY is not set.")
        self._anthropic = anthropic
        # SDK retries 408/409/429/5xx and connection errors with backoff.
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, max_retries=2, timeout=60.0)
        self.available = True

    def generate(self, system: str, messages: list[dict]) -> Completion:
        a = self._anthropic
        kwargs = dict(
            model=settings.NOVA_MODEL,
            max_tokens=settings.NOVA_MAX_OUTPUT_TOKENS,
            system=system,
            messages=messages,
            output_config={"effort": settings.NOVA_EFFORT},
        )
        try:
            if settings.NOVA_REFUSAL_FALLBACK:
                # Server-side refusal fallback: a declined request is re-run on a fallback model.
                response = self.client.beta.messages.create(
                    betas=["server-side-fallback-2026-07-01"], extra_body={"fallbacks": "default"}, **kwargs
                )
            else:
                response = self.client.messages.create(**kwargs)
        except a.AuthenticationError as exc:
            logger.error("nova auth error: %s", exc)
            raise ProviderUnavailable("The AI provider rejected the server credentials.") from exc
        except a.RateLimitError as exc:
            raise ProviderError("Nova is busy right now. Try again in a minute.") from exc
        except a.BadRequestError as exc:
            logger.error("nova bad request: %s", exc)
            raise ProviderError("Nova could not process this request.") from exc
        except a.APIStatusError as exc:
            logger.warning("nova api status %s", exc.status_code)
            raise ProviderError("Nova's AI service returned an error. Try again later.") from exc
        except a.APIConnectionError as exc:
            raise ProviderError("Nova could not reach its AI service.") from exc

        if response.stop_reason == "refusal":
            return Completion("", response.model, response.usage.input_tokens, response.usage.output_tokens, refused=True)
        text = "".join(b.text for b in response.content if b.type == "text").strip()
        return Completion(text, response.model, response.usage.input_tokens, response.usage.output_tokens)


def get_provider():
    if settings.NOVA_PROVIDER == "anthropic":
        try:
            return AnthropicProvider()
        except ProviderUnavailable as exc:
            logger.warning("Nova provider unavailable: %s", exc)
            return NoProvider()
    return NoProvider()
