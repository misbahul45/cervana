import re

def text_clean(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^a-zA-Z0-9.,!?;:/()#\- ]", "", text)
    return text
