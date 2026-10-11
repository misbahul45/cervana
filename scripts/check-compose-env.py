import re
import sys
from pathlib import Path

AI_FORBIDDEN = (
    r"DATABASE_URL",
    r"JWT_[A-Z_]+",
    r"COOKIE_SECRET",
    r"STRIPE_[A-Z_]+",
    r"SUPABASE_[A-Z_]+",
    r"RESEND_API_KEY",
    r"CLOUDINARY_[A-Z_]+",
    r"GOOGLE_CLIENT_SECRET",
)
API_TO_AI_SECRET = r"INTERNAL_API_SECRET"
FORBIDDEN = {
    "ai-api": AI_FORBIDDEN,
    "celery-worker": AI_FORBIDDEN + (API_TO_AI_SECRET,),
    "x-ai-runtime-environment": AI_FORBIDDEN + (API_TO_AI_SECRET,),
    "api": (
        r"OPENAI_[A-Z_]+",
        r"ANTHROPIC_API_KEY",
        r"MISTRAL_[A-Z_]+",
        r"HF_TOKEN",
        r"TAVILY_API_KEY",
        r"QDRANT_API_KEY",
    ),
    "web": (
        r"DATABASE_URL",
        r"JWT_[A-Z_]+",
        r"COOKIE_SECRET",
        r"STRIPE_[A-Z_]+",
        r"INTERNAL_AI_API_SECRET",
        API_TO_AI_SECRET,
        r"OPENAI_[A-Z_]+",
        r"HF_TOKEN",
    ),
}

ANCHOR_HEADER = re.compile(r"^x-ai-runtime-environment:")
SERVICES_HEADER = re.compile(r"^services:\s*$")
SERVICE_HEADER = re.compile(r"^  ([a-z][a-z0-9-]*):\s*$")
SERVICE_KEY = re.compile(r"^      ([A-Z][A-Z0-9_]*):")
ANCHOR_KEY = re.compile(r"^  ([A-Z][A-Z0-9_]*):")
ENV_FILE = re.compile(r"^    env_file:")


def violations(path: Path) -> list[str]:
    found = []
    current = None
    in_services = False
    for number, line in enumerate(path.read_text().splitlines(), start=1):
        if ANCHOR_HEADER.match(line):
            current, in_services = "x-ai-runtime-environment", False
            continue
        if SERVICES_HEADER.match(line):
            current, in_services = None, True
            continue
        if re.match(r"^\S", line):
            current = None
            in_services = in_services and False
            continue
        header = SERVICE_HEADER.match(line) if in_services else None
        if header:
            current = header.group(1)
            continue
        if current is None:
            continue
        if in_services and ENV_FILE.match(line):
            found.append(f"{path}:{number}: {current}: env_file gives the container every variable of .env")
            continue
        key = (ANCHOR_KEY if current == "x-ai-runtime-environment" else SERVICE_KEY).match(line)
        if not key:
            continue
        for pattern in FORBIDDEN.get(current, ()):
            if re.fullmatch(pattern, key.group(1)):
                found.append(f"{path}:{number}: {current}: {key.group(1)} does not belong to this service")
    return found


def main(arguments: list[str]) -> int:
    root = Path(__file__).resolve().parents[1]
    targets = [Path(a) for a in arguments] or [root / "docker-compose.yml", root / "docker-compose.prod.yml"]
    problems = [problem for target in targets for problem in violations(target)]
    print("\n".join(problems))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
