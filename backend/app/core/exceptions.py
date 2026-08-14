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


class TaskDispatchError(AppError):
    """Work was accepted but could not be handed to a worker.

    Lives here rather than under the integration errors because the queue is not
    a provider the way Brapi is: nothing was fetched and nothing answered badly,
    the job simply never got enqueued. Naming it for what happened also keeps
    entrypoints from having to reach into `infra` for a type.
    """

    default_message = 'Could not dispatch the background task'
