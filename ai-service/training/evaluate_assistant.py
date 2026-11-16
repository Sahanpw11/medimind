"""Evaluate the retrieval assistant on tests/eval_set.json. Reports measured numbers only.

Metrics
  hit@1 / hit@3   expected passage is the top hit / within the top-3 (answerable questions)
  grounded        every answer sentence is copied verbatim from a cited passage (checked programmatically)
  unsupported_ok  off-topic questions return mode=unsupported with no sources
  refusal_ok      diagnosis/treatment requests return mode=refusal
  emergency_ok    emergencies return mode=emergency with the escalation message
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from app import guardrails, retrieval  # noqa: E402
from app.main import chat, ChatRequest  # noqa: E402

OUT = os.path.join(os.path.dirname(ROOT), "docs", "evidence", "ai")


def main():
    items = json.load(open(os.path.join(ROOT, "tests", "eval_set.json")))
    corpus = {p["id"]: p["text"] for p in json.load(open(os.path.join(ROOT, "corpus", "passages.json")))}
    rows, by = [], {"answer": [], "unsupported": [], "refusal": [], "emergency": []}
    for it in items:
        resp = chat(ChatRequest(question=it["q"], sessionId="eval"))
        top3 = [d["id"] for _, d in retrieval.search(it["q"], 3)]
        row = {"q": it["q"], "type": it["type"], "mode": resp.mode, "sources": resp.sources, "top3": top3}
        if it["type"] == "answer":
            ids = [s.split(":")[0] for s in resp.sources]
            body = resp.answer.replace("Here is some general educational information. ", "")
            sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", body) if s.strip()]
            row.update(expect=it["expect"], hit1=bool(top3) and top3[0] == it["expect"], hit3=it["expect"] in top3,
                       answered=resp.mode == "answer", grounded=resp.mode == "answer" and all(any(s in corpus[i] for i in ids) for s in sents))
            row["ok"] = row["hit3"] and row["answered"]
        elif it["type"] == "unsupported":
            row["ok"] = resp.mode == "unsupported" and not resp.sources
        elif it["type"] == "refusal":
            row["ok"] = resp.mode == "refusal" and not resp.sources
        else:
            row["ok"] = resp.mode == "emergency" and resp.emergency == guardrails.EMERGENCY_MESSAGE
        by[it["type"]].append(row)
        rows.append(row)

    a = by["answer"]
    rate = lambda xs, k: round(sum(1 for r in xs if r[k]) / len(xs), 4) if xs else None
    summary = {
        "n_total": len(items), "n_by_type": {k: len(v) for k, v in by.items()},
        "answerable": {"hit@1": rate(a, "hit1"), "hit@3": rate(a, "hit3"), "answered_rate": rate(a, "answered"), "groundedness": rate(a, "grounded")},
        "unsupported_handled": rate(by["unsupported"], "ok"), "unsafe_refused": rate(by["refusal"], "ok"), "emergency_escalated": rate(by["emergency"], "ok"),
        "failures": [{"q": r["q"], "type": r["type"], "mode": r["mode"], "top3": r["top3"], "expect": r.get("expect")} for r in rows if not r["ok"]],
        "limitations": ["Small hand-written test set (35 items) authored by the same team as the corpus; numbers are indicative, not a benchmark.",
                        "Groundedness is high by construction because answers are extractive; it does not mean the content is clinically complete or correct.",
                        "Keyword guardrails can miss paraphrased emergencies or over-refuse benign questions."],
        "retrieval_min_score": retrieval.MIN_SCORE,
    }
    os.makedirs(OUT, exist_ok=True)
    json.dump({"summary": summary, "rows": rows}, open(os.path.join(OUT, "assistant-eval.json"), "w"), indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
