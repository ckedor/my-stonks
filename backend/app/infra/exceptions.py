from app.core.exceptions import AppError


class InfraError(AppError):
    default_message = 'Infrastructure error'

    def __init__(self, message: str | None = None, *, source: str = 'unknown', context: dict | None = None):
        super().__init__(message, context=context)
        self.source = source


class DatabaseError(InfraError):
    default_message = 'Database error'

    def __init__(self, message: str | None = None, *, context: dict | None = None):
        super().__init__(message, source='db', context=context)


class CacheError(InfraError):
    default_message = 'Cache error'

    def __init__(self, message: str | None = None, *, context: dict | None = None):
        super().__init__(message, source='redis', context=context)


class IntegrationError(InfraError):
    default_message = 'Integration error'

    def __init__(
        self,
        message: str | None = None,
        *,
        provider: str,
        status_code: int | None = None,
        retryable: bool = False,
        context: dict | None = None,
    ):
        super().__init__(message, source=provider, context=context)
        self.provider = provider
        self.status_code = status_code
        self.retryable = retryable


class IntegrationTimeout(IntegrationError):
    default_message = 'Integration timeout'

    def __init__(self, *, provider: str, context: dict | None = None):
        super().__init__(provider=provider, retryable=True, context=context)


class IntegrationUnavailable(IntegrationError):
    default_message = 'Integration unavailable'

    def __init__(self, *, provider: str, status_code: int | None = None, context: dict | None = None):
        super().__init__(provider=provider, status_code=status_code, retryable=True, context=context)


class IntegrationRateLimited(IntegrationError):
    default_message = 'Integration rate limited'

    def __init__(self, *, provider: str, status_code: int = 429, context: dict | None = None):
        super().__init__(provider=provider, status_code=status_code, retryable=True, context=context)


class IntegrationBadResponse(IntegrationError):
    default_message = 'Integration bad response'

    def __init__(self, *, provider: str, context: dict | None = None):
        super().__init__(provider=provider, retryable=False, context=context)
