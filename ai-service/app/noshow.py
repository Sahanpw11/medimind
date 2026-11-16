"""Logistic-regression scoring from exported coefficients (trained offline by training/train_noshow.py)."""
import json
import math
import os
from functools import lru_cache

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model", "noshow_model.json")
FEATURES = ["leadTimeDays", "priorMissedVisits", "online", "midweekEdge"]


@lru_cache(maxsize=1)
def load_model():
    return json.load(open(MODEL_PATH))


def featurize(lead_time_days, prior_missed, weekday, online):
    return [float(lead_time_days), float(prior_missed), 1.0 if online else 0.0, 1.0 if weekday in (1, 5) else 0.0]


def score(lead_time_days, prior_missed, weekday=3, online=False):
    m = load_model()
    x = featurize(lead_time_days, prior_missed, weekday, online)
    z = m["bias"] + sum(w * (v - mu) / sd for w, v, mu, sd in zip(m["weights"], x, m["mean"], m["std"]))
    p = 1.0 / (1.0 + math.exp(-max(min(z, 30), -30)))
    return p, m["version"], m["threshold"]
