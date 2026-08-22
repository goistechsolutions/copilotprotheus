import contextvars
import logging
import re
import uuid

from pythonjsonlogger import jsonlogger

from app.core.config import settings


_CORRELATION_ID = contextvars.ContextVar("correlation_id", default="-")
_CORRELATION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def get_correlation_id() -> str:
    return _CORRELATION_ID.get()


def normalize_correlation_id(value: str | None) -> str:
    candidate = str(value or "").strip()
    if _CORRELATION_ID_PATTERN.fullmatch(candidate):
        return candidate
    return uuid.uuid4().hex


def set_correlation_id(value: str | None = None):
    return _CORRELATION_ID.set(normalize_correlation_id(value))


def reset_correlation_id(token) -> None:
    _CORRELATION_ID.reset(token)


class CorrelationIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = get_correlation_id()
        return True


def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(settings.log_level)
    handler = logging.StreamHandler()
    handler.addFilter(CorrelationIdFilter())
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(correlation_id)s %(message)s"
    )
    handler.setFormatter(formatter)
    if not logger.handlers:
        logger.addHandler(handler)
    return logger
