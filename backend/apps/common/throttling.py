from rest_framework.throttling import SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    scope = "login"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return self.cache_format % {"scope": self.scope, "ident": request.user.id}
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class AdminLoginRateThrottle(SimpleRateThrottle):
    """Stricter per-IP throttle for the high-value admin login endpoint."""
    scope = "admin_login"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return self.cache_format % {"scope": self.scope, "ident": request.user.id}
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class FailedLoginThrottle(SimpleRateThrottle):
    """Per-account throttle keyed by the submitted username/email, so an
    account cannot be brute-forced across many IPs. Only counts attempts
    against that identifier."""
    scope = "failed_login"

    def get_cache_key(self, request, view):
        identifier = (request.data.get("username_or_email") or request.data.get("identifier") or request.data.get("email") or "").strip().lower()
        if not identifier:
            return None
        return self.cache_format % {"scope": self.scope, "ident": identifier}


class VerifyCodeRateThrottle(SimpleRateThrottle):
    scope = "verify_code"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class SubmissionRateThrottle(SimpleRateThrottle):
    """Throttle for the submissions endpoint. Identifies users by their
    authenticated participant id, falling back to IP for anonymous requests."""
    scope = "submission"

    def get_cache_key(self, request, view):
        participant = getattr(request, "participant", None)
        if participant:
            ident = participant.id
        elif request.user and request.user.is_authenticated:
            ident = request.user.id
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
