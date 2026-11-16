"""Offline: build the TF-IDF index (vocabulary idf + L2-normalised passage vectors) as JSON.

Run from ai-service/:  python training/build_index.py
No third-party dependencies: the same pure-Python tokenizer is used at runtime.
"""
import json
import math
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from app.textproc import tokenize  # noqa: E402


def main():
    passages = json.load(open(os.path.join(ROOT, "corpus", "passages.json")))
    docs_tokens = [tokenize(p["title"] + " " + p["title"] + " " + p["text"]) for p in passages]  # title weighted x2
    n = len(passages)
    df = Counter(t for toks in docs_tokens for t in set(toks))
    idf = {t: math.log((1 + n) / (1 + c)) + 1.0 for t, c in df.items()}  # smoothed idf (sklearn-style)
    docs = []
    for p, toks in zip(passages, docs_tokens):
        tf = Counter(toks)
        vec = {t: (1 + math.log(c)) * idf[t] for t, c in tf.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        docs.append({"id": p["id"], "title": p["title"], "text": p["text"], "vec": {t: round(v / norm, 6) for t, v in vec.items()}})
    out = os.path.join(ROOT, "model", "index.json")
    json.dump({"version": "tfidf-v1", "idf": {t: round(v, 6) for t, v in idf.items()}, "docs": docs}, open(out, "w"), separators=(",", ":"))
    print("indexed %d passages, %d terms -> %s" % (n, len(idf), out))


if __name__ == "__main__":
    main()
