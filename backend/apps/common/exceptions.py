import logging
import uuid
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException, ValidationError as DRFValidationError
from apps.common.utils.response import error_response

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Global Exception Handler mapping DRF, Django, and System exceptions to standard JSON structure:
    {
        "success": False,
        "message": "...",
        "errors": ...
    }
    """
    # Convert Django ValidationError to DRF ValidationError
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            exc = DRFValidationError(detail=exc.message_dict)
        else:
            exc = DRFValidationError(detail=exc.messages)

    # Convert Http404 to DRF NotFound
    if isinstance(exc, Http404):
        return error_response(
            message="The requested resource was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Standard DRF exception handler
    response = exception_handler(exc, context)

    if response is not None:
        errors = response.data
        msg = "An error occurred while processing your request."

        if isinstance(errors, dict):
            if "detail" in errors:
                msg = str(errors["detail"])
                errors = None
            elif "non_field_errors" in errors:
                msg = str(errors["non_field_errors"][0])
            else:
                msg = "Validation error."
        elif isinstance(errors, list):
            msg = str(errors[0])

        return error_response(
            message=msg,
            errors=errors,
            status_code=response.status_code,
        )

    # Unhandled 500 Internal Server Errors.
    # The exception detail is logged server-side for debugging but is never
    # returned to the client, which would leak internal paths/SQL/stack info.
    # A correlation ID lets support link a user report to the server logs.
    error_id = str(uuid.uuid4())
    logger.error(f"[{error_id}] Unhandled exception in API request: {exc}", exc_info=True)
    return error_response(
        message="Internal server error. Please contact system support.",
        errors={"error_id": error_id},
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
