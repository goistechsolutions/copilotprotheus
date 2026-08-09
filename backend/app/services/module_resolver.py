import re

MODULE_ALIAS_MAP = {
    "SIGAFAT": "05",
    "SIGAFIN": "06",
    "SIGACOM": "02",
    "SIGAEST": "04",
    "SIGACTB": "07",
    "SIGAFIS": "12",
    "SIGAPCP": "03",
    "SIGAGPE": "27",
}


def normalize_module_token(raw: str) -> str:
    return re.sub(r"\s", "", raw or "").strip().upper()


def resolve_module_codes(selected_modules: list[str]) -> list[str]:
    resolved: set[str] = set()

    for raw in selected_modules:
        token = normalize_module_token(raw)
        if not token:
            continue

        resolved.add(token)

        code = MODULE_ALIAS_MAP.get(token)
        if code:
            resolved.add(code)

        if token.isdigit():
            resolved.add(token)

    return list(resolved)
