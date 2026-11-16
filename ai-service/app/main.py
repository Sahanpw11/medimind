"""MediMind AI service (internal). Called only by the Node API with a shared secret.

Contract:
  POST /ai/chat           {question, sessionId}            -> {answer, sources[], disclaimer, emergency, mode}
  POST /predict/no-show   {leadTimeDays, priorMissedVisits, weekday?, online?} -> {riskScore, riskBand, modelVersion}
  GET  /health
Logging is limited to non-sensitive operational data (mode, score). Question text is never logged.
"""
import hmac
import logging
import os
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import guardrails, noshow, retrieval

log = logging.getLogger("medimind.ai")
app = FastAPI(title="MediMind AI Service", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)


def _secret():
    s = os.environ.get("AI_SERVICE_SECRET")
    if s:
        return s
    # Fail closed in production if the secret is missing; allow a dev default locally only.
    return None if os.environ.get("AI_ENV") == "production" else "dev-internal-secret"


def require_internal(x_internal_secret: Optional[str] = Header(default=None)):
    expected = _secret()
    if not expected or not x_internal_secret or not hmac.compare_digest(x_internal_secret.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    sessionId: str = Field(default="default", pattern=r"^[\w-]{1,64}$")


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]
    disclaimer: str
    emergency: Optional[str] = None
    mode: str  # answer | unsupported | refusal | emergency


class NoShowRequest(BaseModel):
    leadTimeDays: int = Field(ge=0, le=365)
    priorMissedVisits: int = Field(ge=0, le=50)
    weekday: int = Field(default=3, ge=0, le=6)
    online: bool = False


class NoShowResponse(BaseModel):
    riskScore: float
    riskBand: str
    modelVersion: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ai/chat", response_model=ChatResponse, dependencies=[Depends(require_internal)])
def chat(req: ChatRequest):
    verdict = guardrails.classify(req.question)
    if verdict == "emergency":
        log.info("chat mode=emergency")
        return ChatResponse(answer=guardrails.EMERGENCY_MESSAGE, sources=[], disclaimer=guardrails.DISCLAIMER,
                            emergency=guardrails.EMERGENCY_MESSAGE, mode="emergency")
    if verdict == "refusal":
        log.info("chat mode=refusal")
        return ChatResponse(answer=guardrails.REFUSAL_MESSAGE, sources=[], disclaimer=guardrails.DISCLAIMER, mode="refusal")
    used, top = retrieval.answer(req.question)
    if not used:
        log.info("chat mode=unsupported top=%.3f", top)
        return ChatResponse(answer=guardrails.UNSUPPORTED_MESSAGE, sources=[], disclaimer=guardrails.DISCLAIMER, mode="unsupported")
    log.info("chat mode=answer top=%.3f docs=%d", top, len(used))
    text = "Here is some general educational information. " + " ".join(d["text"] for d in used)
    return ChatResponse(answer=text, sources=["%s: %s" % (d["id"], d["title"]) for d in used],
                        disclaimer=guardrails.DISCLAIMER, mode="answer")


@app.post("/predict/no-show", response_model=NoShowResponse, dependencies=[Depends(require_internal)])
def predict_no_show(req: NoShowRequest):
    p, version, threshold = noshow.score(req.leadTimeDays, req.priorMissedVisits, req.weekday, req.online)
    band = "high" if p >= max(threshold, 0.5) else "medium" if p >= 0.5 * threshold else "low"
    return NoShowResponse(riskScore=round(p, 4), riskBand=band, modelVersion=version)
