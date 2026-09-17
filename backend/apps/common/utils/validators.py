import re
from rest_framework import serializers


def validate_name(value):
    """
    Reject names with HTML tags, script injection, or special characters.
    Only allows letters, spaces, hyphens, apostrophes, and periods.
    """
    if not value:
        return value

    value = value.strip()

    # Reject HTML tags (e.g., <script>, <img>, <div>)
    if re.search(r'<[^>]+>', value):
        raise serializers.ValidationError("Name cannot contain HTML tags.")

    # Reject JavaScript event handlers (e.g., onerror=, onclick=)
    if re.search(r'on\w+\s*=', value.lower()):
        raise serializers.ValidationError("Name contains invalid characters.")

    # Reject common injection patterns
    if re.search(r'javascript:', value.lower()):
        raise serializers.ValidationError("Name contains invalid characters.")

    # Only allow letters, spaces, hyphens, apostrophes, and periods
    if not re.match(r"^[a-zA-Z\s\-'.]+$", value):
        raise serializers.ValidationError(
            "Name can only contain letters, spaces, hyphens, apostrophes, and periods."
        )

    return value
