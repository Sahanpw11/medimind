"""Offline: simulate a labelled no-show dataset, train logistic regression (pure Python), evaluate, export.

IMPORTANT: the data is SIMULATED from a documented rule (see TRUE_COEF). Metrics describe how well the
model recovers that simulated rule, NOT real-world predictive performance or clinical validity.

Run from ai-service/:  python training/train_noshow.py
"""
import json
import math
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from app.noshow import featurize, FEATURES  # noqa: E402

SEED, N = 42, 6000
# Documented data-generating process: logit = b + w . [lead, prior, online, midweekEdge]
TRUE_BIAS, TRUE_COEF = -3.2, [0.045, 0.55, 0.35, 0.20]
EVIDENCE = os.path.join(os.path.dirname(ROOT), "docs", "evidence", "ai")


def sigmoid(z):
    return 1.0 / (1.0 + math.exp(-max(min(z, 30), -30)))


def simulate(rng):
    rows = []
    for _ in range(N):
        lead = min(90, int(rng.expovariate(1 / 12)))
        prior = rng.choices([0, 1, 2, 3, 4], weights=[68, 18, 8, 4, 2])[0]
        weekday = rng.randint(1, 5)
        online = rng.random() < 0.4
        x = featurize(lead, prior, weekday, online)
        y = 1 if rng.random() < sigmoid(TRUE_BIAS + sum(w * v for w, v in zip(TRUE_COEF, x))) else 0
        rows.append((x, y))
    return rows


def split(rows, rng):
    rows = rows[:]
    rng.shuffle(rows)
    a, b = int(0.70 * len(rows)), int(0.85 * len(rows))
    return rows[:a], rows[a:b], rows[b:]


def fit(train, mean, std, epochs=3000, lr=0.2, l2=1e-3):
    k = len(mean)
    w, b = [0.0] * k, 0.0
    pos = sum(y for _, y in train)
    cw = {1: len(train) / (2.0 * pos), 0: len(train) / (2.0 * (len(train) - pos))}  # balanced class weights
    Z = [([(v - m) / s for v, m, s in zip(x, mean, std)], y) for x, y in train]
    for _ in range(epochs):
        gw, gb = [0.0] * k, 0.0
        for z, y in Z:
            e = (sigmoid(b + sum(wi * zi for wi, zi in zip(w, z))) - y) * cw[y]
            for i in range(k):
                gw[i] += e * z[i]
            gb += e
        n = len(Z)
        w = [wi - lr * (g / n + l2 * wi) for wi, g in zip(w, gw)]
        b -= lr * gb / n
    return w, b


def predict(rows, w, b, mean, std):
    return [sigmoid(b + sum(wi * (v - m) / s for wi, v, m, s in zip(w, x, mean, std))) for x, _ in rows]


def metrics(ys, ps, thr):
    tp = sum(1 for y, p in zip(ys, ps) if y and p >= thr)
    fp = sum(1 for y, p in zip(ys, ps) if not y and p >= thr)
    fn = sum(1 for y, p in zip(ys, ps) if y and p < thr)
    tn = len(ys) - tp - fp - fn
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return {"threshold": round(thr, 3), "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
            "precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4), "accuracy": round((tp + tn) / len(ys), 4)}


def auc(ys, ps):
    pairs = sorted(zip(ps, ys))
    rank_sum, i = 0.0, 0
    while i < len(pairs):
        j = i
        while j < len(pairs) and pairs[j][0] == pairs[i][0]:
            j += 1
        avg = (i + 1 + j) / 2.0
        rank_sum += avg * sum(y for _, y in pairs[i:j])
        i = j
    pos = sum(ys)
    neg = len(ys) - pos
    return round((rank_sum - pos * (pos + 1) / 2.0) / (pos * neg), 4)


def main():
    rng = random.Random(SEED)
    train, val, test = split(simulate(rng), rng)
    k = len(FEATURES)
    mean = [sum(x[i] for x, _ in train) / len(train) for i in range(k)]
    std = [math.sqrt(sum((x[i] - mean[i]) ** 2 for x, _ in train) / len(train)) or 1.0 for i in range(k)]
    w, b = fit(train, mean, std)

    yv, pv = [y for _, y in val], predict(val, w, b, mean, std)
    thr = max((t / 100.0 for t in range(5, 96, 1)), key=lambda t: metrics(yv, pv, t)["f1"])  # threshold chosen on VALIDATION only
    yt, pt = [y for _, y in test], predict(test, w, b, mean, std)
    balance = lambda rows: {"n": len(rows), "positives": sum(y for _, y in rows), "positive_rate": round(sum(y for _, y in rows) / len(rows), 4)}
    report = {
        "disclaimer": "Simulated data. Metrics reflect recovery of a documented synthetic rule, not real-world or clinical performance.",
        "seed": SEED, "features": FEATURES, "method": "Logistic regression, standardised features, balanced class weights, L2=1e-3, batch gradient descent",
        "data_generating_process": {"bias": TRUE_BIAS, "coefficients": dict(zip(FEATURES, TRUE_COEF))},
        "class_balance": {"train": balance(train), "validation": balance(val), "test": balance(test)},
        "threshold_selected_on_validation": round(thr, 3),
        "validation": metrics(yv, pv, thr), "test": metrics(yt, pt, thr), "test_roc_auc": auc(yt, pt),
        "baseline_always_negative_test_accuracy": round(1 - sum(yt) / len(yt), 4),
    }
    os.makedirs(EVIDENCE, exist_ok=True)
    json.dump(report, open(os.path.join(EVIDENCE, "noshow-eval.json"), "w"), indent=2)
    json.dump({"version": "demo-v1", "features": FEATURES, "mean": mean, "std": std, "weights": w, "bias": b, "threshold": round(thr, 3)},
              open(os.path.join(ROOT, "model", "noshow_model.json"), "w"), indent=2)
    print(json.dumps({k: report[k] for k in ("class_balance", "threshold_selected_on_validation", "test", "test_roc_auc", "baseline_always_negative_test_accuracy")}, indent=2))


if __name__ == "__main__":
    main()
