import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["AI_SERVICE_SECRET"] = "test-secret"
from app.main import app  # noqa: E402

client = TestClient(app)
H = {"X-Internal-Secret": "test-secret"}


def chat(q, headers=H):
    return client.post("/ai/chat", json={"question": q, "sessionId": "t"}, headers=headers)


def test_health_is_public():
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("headers", [{}, {"X-Internal-Secret": "wrong"}])
def test_rejects_missing_or_bad_secret(headers):
    assert chat("What is a routine checkup?", headers).status_code == 401
    assert client.post("/predict/no-show", json={"leadTimeDays": 3, "priorMissedVisits": 0}, headers=headers).status_code == 401


def test_chat_schema_and_grounding():
    r = chat("What is a routine checkup?")
    assert r.status_code == 200
    b = r.json()
    assert set(b) >= {"answer", "sources", "disclaimer", "mode"}
    assert b["mode"] == "answer" and b["sources"][0].startswith("EDU-01")
    assert "not medical advice" in b["disclaimer"].lower()


def test_diagnosis_request_is_refused_without_sources():
    b = chat("Do I have diabetes because I feel thirsty?").json()
    assert b["mode"] == "refusal" and b["sources"] == []
    assert "can't diagnose" in b["answer"]


def test_emergency_escalates():
    b = chat("I have severe chest pain and cannot breathe").json()
    assert b["mode"] == "emergency" and "emergency" in b["emergency"].lower()


def test_unsupported_question_abstains():
    b = chat("What is the capital of France?").json()
    assert b["mode"] == "unsupported" and b["sources"] == []


def test_answer_never_claims_diagnosis():
    for q in ["What is asthma?", "What is hypertension?", "What is diabetes?"]:
        assert "you have" not in chat(q).json()["answer"].lower()


@pytest.mark.parametrize("body", [{"question": ""}, {"question": "x" * 501}, {"question": "ok question", "sessionId": "bad id!"}, {}])
def test_chat_validation(body):
    assert client.post("/ai/chat", json=body, headers=H).status_code == 422


def test_no_show_contract_and_bounds():
    r = client.post("/predict/no-show", json={"leadTimeDays": 7, "priorMissedVisits": 1}, headers=H)
    assert r.status_code == 200
    b = r.json()
    assert 0.0 <= b["riskScore"] <= 1.0 and b["modelVersion"] and b["riskBand"] in {"low", "medium", "high"}


def test_no_show_is_monotonic_in_prior_misses():
    f = lambda n: client.post("/predict/no-show", json={"leadTimeDays": 10, "priorMissedVisits": n}, headers=H).json()["riskScore"]
    assert f(0) < f(2) < f(4)


def test_no_show_validation():
    assert client.post("/predict/no-show", json={"leadTimeDays": -1, "priorMissedVisits": 0}, headers=H).status_code == 422
    assert client.post("/predict/no-show", json={"leadTimeDays": 5}, headers=H).status_code == 422
