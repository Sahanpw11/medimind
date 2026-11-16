"""Rule-based safety layer, evaluated BEFORE retrieval.

Order: emergency -> diagnosis/treatment request -> (retrieval) -> unsupported.
Patterns are deliberately conservative: when unsure, decline and point to a clinician.
"""
import re

EMERGENCY_MESSAGE = (
    "If you or someone else may be in danger or having a medical emergency, call your local emergency number "
    "(1990 in Sri Lanka) or go to the nearest emergency department now. If you are thinking about harming "
    "yourself, please contact emergency services or a trusted person immediately. This assistant cannot help in an emergency."
)
DISCLAIMER = "Educational information only. This is not medical advice and does not diagnose or treat any condition."

_EMERGENCY = re.compile(
    r"chest pain|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|unconscious|not responding|unresponsive|"
    r"suicid|kill myself|end my life|want to die|overdos|heavy bleeding|severe bleeding|heart attack|having a stroke|seizure|poison",
    re.I,
)
_CLINICAL_ADVICE = re.compile(
    r"\bdo i have\b|\bdiagnos|\bam i (sick|ill|dying|pregnant)\b|\bis (this|it|my|that)\b.{0,40}\b(cancer|tumou?r|serious|infected|infection|contagious)\b|"
    r"\bwhat (dose|dosage)\b|\bhow (much|many)\b.{0,40}\b(should i take|mg)\b|\bprescrib|\bwhat (medicine|medication|drug|pill)s? (should|can|do) i\b|"
    r"\bshould i (stop|start|take|skip|increase|reduce|double)\b|\bcan i (take|stop|mix)\b|\bwhat('s| is) wrong with me\b",
    re.I,
)

REFUSAL_MESSAGE = (
    "I can't diagnose conditions, recommend medicines or doses, or advise on changing treatment. "
    "Please speak with a doctor or pharmacist about this. I'm happy to share general educational information instead."
)
UNSUPPORTED_MESSAGE = (
    "I don't have reliable information about that in my approved health-education material. "
    "Try rephrasing, or ask your doctor. I can help with general topics such as checkups, vital signs, allergies, sleep, nutrition and preparing for appointments."
)


def classify(question):
    """Return 'emergency', 'refusal' or None."""
    if _EMERGENCY.search(question):
        return "emergency"
    if _CLINICAL_ADVICE.search(question):
        return "refusal"
    return None
