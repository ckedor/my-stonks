# app/infra/openai/openai_client.py
import json
from typing import Any, Optional

from app.config.settings import settings
from app.infra.exceptions import (
    IntegrationBadResponse,
    IntegrationError,
    IntegrationRateLimited,
    IntegrationTimeout,
    IntegrationUnavailable,
)
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    OpenAIError,
    RateLimitError,
)

PROVIDER = 'openai'
DEFAULT_TEMPERATURE = 0.2


class OpenAIClient:
    def __init__(self, model: str = 'gpt-4o-mini'):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = model

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: Optional[str] = None,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: Optional[int] = None,
        response_format: Optional[Any] = None,
    ) -> str:
        kwargs: dict[str, Any] = {
            'model': model or self.model,
            'messages': messages,
            'temperature': temperature,
        }

        if max_tokens is not None:
            kwargs['max_tokens'] = max_tokens

        if response_format is not None:
            kwargs['response_format'] = response_format

        try:
            response = await self.client.chat.completions.create(**kwargs)
        except APITimeoutError as e:
            raise IntegrationTimeout(provider=PROVIDER) from e
        except RateLimitError as e:
            raise IntegrationRateLimited(provider=PROVIDER, status_code=429) from e
        except APIConnectionError as e:
            raise IntegrationUnavailable(provider=PROVIDER) from e
        except APIStatusError as e:
            raise IntegrationError(
                provider=PROVIDER,
                status_code=e.status_code,
                retryable=e.status_code >= 500,
            ) from e
        except OpenAIError as e:
            raise IntegrationError(provider=PROVIDER) from e

        content = response.choices[0].message.content
        if content is None:
            raise IntegrationBadResponse(
                provider=PROVIDER, context={'reason': 'empty response'}
            )
        return content

    async def ask(
        self,
        prompt: str,
        *,
        system: str = '',
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        Uso: respostas naturais (chat, explicação, UX)
        """
        messages = []

        if system:
            messages.append({'role': 'system', 'content': system})

        messages.append({'role': 'user', 'content': prompt})

        return await self.chat(
            messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    async def extract(
        self,
        prompt: str,
        *,
        system: str = '',
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> dict:
        """
        Uso: extrair dados estruturados (JSON)
        """
        base_system = "Return ONLY valid JSON. No explanation."

        system_message = f"{base_system}\n{system}" if system else base_system

        messages = [
            {'role': 'system', 'content': system_message},
            {'role': 'user', 'content': prompt},
        ]

        response = await self.chat(
            messages,
            model=model,
            temperature=0.0,
            max_tokens=max_tokens,
            response_format={'type': 'json_object'},
        )

        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            raise IntegrationBadResponse(
                provider=PROVIDER,
                context={'sample': response[:200]},
            ) from e

    async def analyze(
        self,
        prompt: str,
        *,
        system: str = '',
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        Uso: lógica, finanças, decisões → determinístico
        """
        base_system = "Be precise, deterministic, and avoid speculation."

        system_message = f"{base_system}\n{system}" if system else base_system

        messages = [
            {'role': 'system', 'content': system_message},
            {'role': 'user', 'content': prompt},
        ]

        return await self.chat(
            messages,
            model=model,
            temperature=0.0,
            max_tokens=max_tokens,
        )