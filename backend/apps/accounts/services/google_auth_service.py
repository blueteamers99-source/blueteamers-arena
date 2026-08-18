import json
import urllib.request
import urllib.error
from typing import Dict, Any, Tuple, Optional
from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models.user import User


class GoogleAuthService:
    GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

    @classmethod
    def verify_google_id_token(cls, id_token_str: str) -> Dict[str, Any]:
        """
        Securely verifies a Google OAuth ID Token via Google's official TokenInfo endpoint.
        Validates token signature, expiration, issuer, and email verification status.
        """
        if not id_token_str or not isinstance(id_token_str, str):
            raise AuthenticationFailed("Google OAuth token is required.")

        clean_token = id_token_str.strip()
        if not clean_token:
            raise AuthenticationFailed("Google OAuth token cannot be empty.")

        url = f"{cls.GOOGLE_TOKENINFO_URL}?id_token={clean_token}"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "BlueteamersArena-AuthService/1.0"},
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise AuthenticationFailed("Invalid or expired Google OAuth credential.")
        except Exception as e:
            raise AuthenticationFailed("Unable to verify Google credential with authentication provider.")

        # 1. Validate Issuer
        iss = payload.get("iss", "")
        if iss not in ["accounts.google.com", "https://accounts.google.com"]:
            raise AuthenticationFailed("Invalid token issuer.")

        # 2. Validate Audience if configured
        google_client_id = getattr(settings, "GOOGLE_CLIENT_ID", "") or getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "")
        if google_client_id:
            aud = payload.get("aud")
            if aud != google_client_id:
                raise AuthenticationFailed("Google token audience mismatch.")

        # 3. Validate Email and Email Verification Status
        email = payload.get("email")
        if not email:
            raise AuthenticationFailed("Google account does not have an email address.")

        email_verified = payload.get("email_verified")
        if str(email_verified).lower() not in ["true", "1"]:
            raise AuthenticationFailed("Google email address is not verified.")

        return payload

    @classmethod
    def authenticate_google_student(cls, credential: str) -> Tuple[User, Dict[str, str]]:
        """
        Authenticates a student using verified Google OAuth ID token.
        Extracts email strictly from the server-verified payload.
        Never trusts client-supplied email parameters.
        """
        payload = cls.verify_google_id_token(credential)
        verified_email = payload["email"].strip().lower()
        verified_name = payload.get("name", "") or payload.get("given_name", "") or verified_email.split("@")[0]

        try:
            user = User.objects.get(email__iexact=verified_email)
        except User.DoesNotExist:
            # Auto-create Student Account on first valid Google Login
            base_username = verified_email.split("@")[0]
            username = base_username
            counter = 1
            while User.objects.filter(username__iexact=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                email=verified_email,
                username=username,
                full_name=verified_name or base_username.capitalize(),
                role=User.RoleChoices.STUDENT,
                is_email_verified=True,
            )

        if not user.is_active:
            raise AuthenticationFailed("Your account has been suspended.")

        # Generate standard SimpleJWT tokens
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email

        tokens = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        return user, tokens
