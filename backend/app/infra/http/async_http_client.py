# app/infra/http/async_http_client.py
"""
Async HTTP client with retry, exponential backoff, and error translation.
"""

import asyncio
from typing import Any, Literal, Optional

import httpx
from app.config.logger import logger
from app.infra.exceptions import (
    IntegrationBadResponse,
    IntegrationError,
    IntegrationRateLimited,
    IntegrationTimeout,
    IntegrationUnavailable,
)


def translate_httpx_error(exc: Exception, *, provider: str) -> IntegrationError:
    """Convert an httpx exception into the appropriate IntegrationError subclass."""
    if isinstance(exc, httpx.TimeoutException):
        return IntegrationTimeout(provider=provider)
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        url = str(exc.request.url).split('?')[0]
        detail = f'{provider} returned {status} for {url}'
        if status == 429:
            return IntegrationRateLimited(provider=provider, status_code=429)
        if status >= 500:
            return IntegrationUnavailable(message=detail, provider=provider, status_code=status)
        return IntegrationError(message=detail, provider=provider, status_code=status)
    if isinstance(exc, (httpx.ConnectError, httpx.RemoteProtocolError)):
        return IntegrationUnavailable(message=f'{provider} connection failed', provider=provider)
    return IntegrationError(message=f'{provider} request failed: {exc}', provider=provider)


def raise_for_provider(exc: Exception, *, provider: str) -> None:
    """Translate and raise an httpx/parsing exception as an IntegrationError."""
    if isinstance(exc, IntegrationError):
        raise exc from exc.__cause__
    raise translate_httpx_error(exc, provider=provider) from exc


def raise_bad_response(exc: Exception, *, provider: str, sample: str = '') -> None:
    """Raise IntegrationBadResponse for parsing/data errors."""
    raise IntegrationBadResponse(
        provider=provider,
        context={'sample': sample[:200]} if sample else {},
    ) from exc


class AsyncHttpClient:
    """
    Async HTTP client with built-in retry logic, exponential backoff,
    and automatic translation of httpx errors into IntegrationError subclasses.

    Args:
        provider: Name identifying the external service (used in error context).
        base_url: Base URL prepended to all requests.
        headers: Default headers sent with every request.
        timeout: Request timeout in seconds.
        max_retries: Maximum number of retries on transient failures.
        backoff_factor: Base multiplier for exponential backoff.
        retry_statuses: HTTP status codes that trigger a retry.
    """

    def __init__(
        self,
        provider: str,
        base_url: str = '',
        *,
        headers: Optional[dict] = None,
        timeout: float = 10.0,
        max_retries: int = 3,
        backoff_factor: float = 1.0,
        retry_statuses: tuple = (429, 500, 502, 503, 504),
    ):
        self.provider = provider
        self.base_url = base_url.rstrip('/')
        self.default_headers = headers or {}
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.retry_statuses = retry_statuses
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazy initialization of the async client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self.default_headers,
                timeout=httpx.Timeout(self.timeout),
            )
        return self._client

    async def aclose(self):
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def set_header(self, key: str, value: str) -> None:
        """Add or update a default header."""
        self.default_headers[key] = value

    def set_bearer_token(self, token: str) -> None:
        """Set Bearer token for Authorization header."""
        self.set_header('Authorization', f'Bearer {token}')

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict] = None,
        json: Optional[dict] = None,
        data: Optional[dict] = None,
        headers: Optional[dict] = None,
        parse: Literal['json', 'text', 'raw'] = 'json',
    ) -> Any:
        """
        Make an HTTP request with retry logic and error translation.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            path: URL path (joined with base_url, or a full URL).
            params: Query parameters.
            json: JSON body data.
            data: Form data.
            headers: Additional headers for this request.
            parse: Response parsing mode — 'json', 'text', or 'raw' (httpx.Response).

        Returns:
            Parsed JSON dict, text string, or raw httpx.Response.

        Raises:
            IntegrationError (or subclass) on transport/HTTP/parse failures.
        """
        client = await self._get_client()
        request_headers = {**self.default_headers, **(headers or {})}
        safe_path = path.split('?')[0]
        log_extra = {'provider': self.provider, 'method': method, 'path': safe_path}

        last_exception: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response = await client.request(
                    method=method,
                    url=path,
                    params=params,
                    json=json,
                    data=data,
                    headers=request_headers,
                )

                if response.status_code in self.retry_statuses and attempt < self.max_retries:
                    wait_time = self.backoff_factor * (2**attempt)
                    logger.warning(
                        'Retryable status %s',
                        response.status_code,
                        extra={**log_extra, 'attempt': attempt + 1, 'wait_time': wait_time},
                    )
                    await asyncio.sleep(wait_time)
                    continue

                response.raise_for_status()

                if parse == 'raw':
                    return response
                if parse == 'text':
                    return response.text
                try:
                    return response.json()
                except (ValueError, UnicodeDecodeError) as exc:
                    raise_bad_response(exc, provider=self.provider, sample=response.text)

            except httpx.HTTPStatusError as exc:
                raise_for_provider(exc, provider=self.provider)

            except httpx.TimeoutException as exc:
                last_exception = exc
                if attempt < self.max_retries:
                    wait_time = self.backoff_factor * (2**attempt)
                    logger.warning(
                        'Request timeout',
                        extra={**log_extra, 'attempt': attempt + 1, 'wait_time': wait_time},
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise_for_provider(exc, provider=self.provider)

            except IntegrationError:
                raise

            except Exception as exc:
                raise_for_provider(exc, provider=self.provider)

        if last_exception:
            raise_for_provider(last_exception, provider=self.provider)

    async def get(self, path: str, **kwargs) -> Any:
        return await self.request('GET', path, **kwargs)

    async def post(self, path: str, **kwargs) -> Any:
        return await self.request('POST', path, **kwargs)

    async def put(self, path: str, **kwargs) -> Any:
        return await self.request('PUT', path, **kwargs)

    async def delete(self, path: str, **kwargs) -> Any:
        return await self.request('DELETE', path, **kwargs)

    async def __aenter__(self):
        await self._get_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.aclose()
