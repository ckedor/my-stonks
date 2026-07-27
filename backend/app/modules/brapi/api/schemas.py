"""Shared schemas for the brapi API."""

from pydantic import BaseModel, ConfigDict


class BrapiQuery(BaseModel):
    """Base validation rules shared by brapi query models."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra='forbid',
    )
