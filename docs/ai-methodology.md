# AI service methodology and evaluation

**MediMind's AI features are educational demonstrations on synthetic data. They are not clinically validated, do not diagnose, and do not give medical advice.**

The FastAPI service (`ai-service/`) is internal. Node calls it with a shared secret (`X-Internal-Secret`, constant-time compare, fails closed when unset in production), a 5 s timeout and a safe fallback. Runtime dependencies are only `fastapi` and `pydantic`; training is pure Python.

## Feature A: retrieval-based educational assistant

### Contract
```
POST /ai/chat   {"question": "What is a routine checkup?", "sessionId": "<opaque id>"}
→ {"answer": "...", "sources": ["EDU-01: Routine checkups"], "disclaimer": "...", "emergency": null, "mode": "answer|unsupported|refusal|emergency"}
```
`question`: 2-500 chars. `sessionId`: `[\w-]{1,64}`. Node sends an opaque conversation id, never a patient id.

### Method
1. **Safety guardrails first** (`app/guardrails.py`, regular expressions): emergency phrases (chest pain, cannot breathe, suicide, overdose, ...) return an escalation message and no retrieval; requests to diagnose, prescribe, dose or change treatment return a refusal and no retrieval.
2. **Retrieval**: a fixed corpus of 35 hand-written, synthetic health-education passages (`ai-service/corpus/passages.json`). TF-IDF vectors (smoothed idf, log tf, title weighted ×2, L2-normalised) are built offline (`training/build_index.py`) and queried by cosine similarity in pure Python.
3. **Abstention**: if the best score is below 0.18 the service answers that it has no reliable information (`unsupported`).
4. **Extractive answer**: the answer is the top passage (plus a second only if nearly as relevant), copied verbatim, so it cannot invent content. Sources are the passage ids used.
5. **Disclaimer on every response**; the UI always shows it, plus the emergency number.

### Evaluation protocol
`ai-service/tests/eval_set.json`: 35 questions written by the team: 20 answerable (each with the expected passage), 5 off-topic, 6 diagnosis/treatment requests, 4 emergencies. `training/evaluate_assistant.py` reproduces every number below (`docs/evidence/ai/assistant-eval.json`).

| Metric | Result |
|---|---|
| Retrieval hit@1 (answerable) | 95% |
| Retrieval hit@3 (answerable) | 100% |
| Answered rather than abstained (answerable) | 90% |
| Groundedness (every answer sentence found verbatim in a cited passage) | 90% |
| Off-topic questions correctly declined | 100% |
| Diagnosis/treatment requests correctly refused | 100% |
| Emergencies correctly escalated | 100% |

### Failures (measured, not hidden)
- *"How should I get ready for my doctor visit?"* → mode `unsupported` although the right passage (EDU-04) was in the top-3 ['EDU-04', 'EDU-01', 'EDU-05']: the abstention threshold was too conservative.
- *"How can I remember to take my medicines every day?"* → mode `unsupported` although the right passage (EDU-22) was in the top-3 ['EDU-21', 'EDU-22', 'EDU-04']: the abstention threshold was too conservative.

### Limitations and failure modes
- **Small, self-authored test set** (35 items written by the same team as the corpus). Numbers are indicative, not a benchmark.
- **The abstention threshold trades recall for safety.** In this domain a wrong answer is worse than no answer, so the threshold was left conservative even though it costs the answerable misses above.
- **A generic-word failure was found and fixed after evaluation.** "Explain quantum computing" matched the asthma passage on the word *explain*. Instruction verbs (explain, tell, describe, ...) were added to the stopword list. Because this was changed after seeing the evaluation set, the set is **no longer fully held-out**.
- **Groundedness is high by construction** (extractive answers). It does not mean the content is complete or clinically correct; passages are generic education, not guidance.
- **Keyword guardrails can miss paraphrases** of emergencies and may over-refuse benign questions. They are a safety net, not a classifier.
- Vocabulary is limited to the 35 passages; the service cannot answer anything outside them, by design.
- English only.

## Feature B: simulated no-show classifier (analytical feature)

```
POST /predict/no-show   {"leadTimeDays": 7, "priorMissedVisits": 1, "weekday": 3, "online": false}
→ {"riskScore": 0.31, "riskBand": "low|medium|high", "modelVersion": "demo-v1"}
```

### Data: **simulated**
There is no real no-show history, and the seeded appointment statuses are random, so training on them would learn nothing. `training/train_noshow.py` therefore **simulates** 6000 labelled appointments from a documented rule: logit = -3.2 + 0.045·leadTimeDays + 0.55·priorMissedVisits + 0.35·online + 0.20·midweekEdge, with a Bernoulli outcome. **The metrics below measure how well the model recovers this invented rule. They say nothing about real-world no-show behaviour.**

### Method and protocol
Logistic regression (standardised features, balanced class weights, L2 = 1e-3, batch gradient descent, pure Python). Random 70 / 15 / 15 train / validation / test split (seed 42). The decision threshold (0.59) was chosen on the validation set only; the test set was used once.

| Split | n | Positives (no-shows) | Positive rate |
|---|---:|---:|---:|
| Train | 4200 | 550 | 13.1% |
| Validation | 900 | 121 | 13.4% |
| Test | 900 | 111 | 12.3% |

**Test results** (threshold 0.59):

| | Predicted no-show | Predicted attend |
|---|---:|---:|
| **Actual no-show** | TP 41 | FN 70 |
| **Actual attend** | FP 145 | TN 644 |

Precision **0.220**, recall **0.369**, F1 **0.276**, ROC-AUC **0.641**, accuracy 0.761.

### Honest interpretation
- The model is **weak**. ROC-AUC 0.64 is only modestly above chance, because the simulated rule is noisy and its effects are small.
- **Accuracy is misleading here.** Always predicting "attend" would score 87.7% accuracy, higher than the model's 76.1%, because only about 13% of cases are no-shows. Precision, recall, F1 and the confusion matrix are the meaningful measures, and they are poor.
- The feature exists to demonstrate the integration (Node → FastAPI → UI, with a graceful 503 fallback), not to be accurate. The doctor UI labels it "a simulated educational model, not a clinical tool".
- No fairness, calibration or drift analysis was done.

## Privacy and safety constraints implemented
- Synthetic corpus and data only; no external LLM provider is called.
- Node forwards only the question text and an opaque id; no identifiers or clinical records.
- The service logs only the response mode and score, never question text.
- Service-to-service calls require the shared secret; direct calls without it return 401 (tested).
- Responses never claim to diagnose or prescribe (tested); every response carries the disclaimer and the emergency message is shown prominently for emergencies.
