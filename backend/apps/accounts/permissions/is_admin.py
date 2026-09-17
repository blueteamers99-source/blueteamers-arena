from rest_framework.permissions import BasePermission
from apps.accounts.models.user import User


class IsAdmin(BasePermission):
    """
    Custom permission allowing access only to users with ADMIN or SUPER_ADMIN role.
    is_staff alone is not sufficient — the role field is authoritative.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in [User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN]
        )
