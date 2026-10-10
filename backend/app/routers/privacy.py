"""PII masking for the agent (r4-07): call before sending any text to an LLM provider."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import privacy
from ..security import require_agent

router = APIRouter(prefix="/privacy", tags=["privacy"])


class MaskIn(BaseModel):
    text: str = Field(max_length=200_000)


class MaskOut(BaseModel):
    text: str
    mapping: dict[str, str] = Field(description="Keep it in the backend; never send it to the LLM")


@router.post("/mask", response_model=MaskOut, summary="Replace personal data with placeholders before an LLM call")
def mask(body: MaskIn, _: str = Depends(require_agent)):
    text, mapping = privacy.mask(body.text)
    return {"text": text, "mapping": mapping}
