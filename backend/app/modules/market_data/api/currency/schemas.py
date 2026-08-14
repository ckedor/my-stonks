from pydantic import BaseModel, ConfigDict


class Currency(BaseModel):
    id: int
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)
