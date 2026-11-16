"""Tokenisation shared by the offline index builder and the runtime retriever."""
import re

STOP = frozenset("""a an and are as at be by can do does for from has have how i if in is it its me my of on or should so that the their them there these they this to was were what when where which who why will with you your about into than then also not no yes explain tell describe give show help know let say mean""".split())
_TOKEN = re.compile(r"[a-z0-9]+")


def stem(w):
    for suf in ("ings", "ing", "edly", "ed", "ies", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def tokenize(text):
    return [stem(t) for t in _TOKEN.findall(text.lower()) if t not in STOP and len(t) > 1]
