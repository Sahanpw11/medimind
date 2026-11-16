"""Pure-Python TF-IDF cosine retrieval over a fixed, curated passage set (extractive answers)."""
import json
import math
import os
from collections import Counter
from functools import lru_cache

from .textproc import tokenize

INDEX_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model", "index.json")
MIN_SCORE = 0.18        # below this best-score the question is treated as unsupported
SECOND_RATIO = 0.80     # include a second passage only if it is nearly as relevant
MAX_PASSAGES = 2


@lru_cache(maxsize=1)
def load_index():
    return json.load(open(INDEX_PATH))


def search(question, k=3):
    """Return [(score, doc), ...] best first. Cosine similarity between query and passage tf-idf vectors."""
    idx = load_index()
    idf = idx["idf"]
    tf = Counter(t for t in tokenize(question) if t in idf)
    if not tf:
        return []
    q = {t: (1 + math.log(c)) * idf[t] for t, c in tf.items()}
    norm = math.sqrt(sum(v * v for v in q.values())) or 1.0
    scored = []
    for d in idx["docs"]:
        s = sum(w / norm * d["vec"].get(t, 0.0) for t, w in q.items())
        if s > 0:
            scored.append((s, d))
    scored.sort(key=lambda x: -x[0])
    return scored[:k]


def answer(question):
    """Return (passages_used, top_score). Empty list => unsupported."""
    hits = search(question)
    if not hits or hits[0][0] < MIN_SCORE:
        return [], (hits[0][0] if hits else 0.0)
    used = [hits[0][1]]
    for s, d in hits[1:MAX_PASSAGES]:
        if s >= max(MIN_SCORE, SECOND_RATIO * hits[0][0]):
            used.append(d)
    return used, hits[0][0]
