"""Consistent error envelope: {"error": {"code": str, "message": str, "details": any}}."""

from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    code = getattr(exc, "default_code", "error")
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        message, details = str(data["detail"]), None
    else:
        message, details = "Some fields need attention.", data
    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
