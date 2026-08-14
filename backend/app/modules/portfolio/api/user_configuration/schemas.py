from pydantic import BaseModel


class UserConfigurationUpdateRequest(BaseModel):
    configuration: str
    enabled: bool
