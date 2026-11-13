import logging

logger = logging.getLogger("codeverse.audit")


def audit(event: str, request=None, user=None, **fields):
    """Structured audit log for sensitive operations (auth, grading, admin content)."""
    actor = user or (getattr(request, "user", None) if request else None)
    ip = request.META.get("REMOTE_ADDR") if request else None
    payload = " ".join(f"{k}={v!r}" for k, v in fields.items())
    logger.info("event=%s user=%s ip=%s %s", event, getattr(actor, "pk", None), ip, payload)
