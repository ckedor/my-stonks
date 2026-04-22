class AppError(Exception):
    default_message = 'Application error'

    def __init__(self, message: str | None = None, *, context: dict | None = None):
        super().__init__(message or self.default_message)
        self.context = context or {}


class NotFoundError(AppError):
    default_message = 'Resource not found'


class AlreadyExistsError(AppError):
    default_message = 'Resource already exists'


class ValidationError(AppError):
    default_message = 'Invalid input'


class PermissionDeniedError(AppError):
    default_message = 'Permission denied'


class BusinessRuleError(AppError):
    default_message = 'Business rule violation'
