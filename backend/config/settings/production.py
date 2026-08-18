from .base import *

DEBUG = env.bool("DEBUG", default=False)

# Secret Key from Environment Variable
SECRET_KEY = env.str("DJANGO_SECRET_KEY", default=env.str("SECRET_KEY", default=SECRET_KEY))

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[
    "blueteamers-arena.onrender.com",
    "*.onrender.com",
    "*.vercel.app",
    "localhost",
    "127.0.0.1",
    "*",
])

# CSRF Trusted Origins
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[
    "https://*.vercel.app",
    "https://*.onrender.com",
    "https://*.railway.app",
    "https://*.up.railway.app",
    "http://localhost:5173",
    "http://localhost:3000",
])

# CORS Configuration - Restricted Origins (F-18)
CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=False)
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[
    "https://blueteamers-arena.vercel.app",
    "https://blueteamers-arena.onrender.com",
    "http://localhost:5173",
    "http://localhost:3000",
])
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
    r"^https://.*\.onrender\.com$",
]
CORS_ALLOW_CREDENTIALS = True

# Database Configuration (supports DATABASE_URL on Render/Railway/Heroku)
if env.str("DATABASE_URL", default=""):
    DATABASES = {
        "default": env.db("DATABASE_URL")
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": env("DATABASE_ENGINE", default="django.db.backends.postgresql"),
            "NAME": env("DATABASE_NAME", default="blueteamers_db"),
            "USER": env("DATABASE_USER", default="postgres"),
            "PASSWORD": env("DATABASE_PASSWORD", default="postgres"),
            "HOST": env("DATABASE_HOST", default="localhost"),
            "PORT": env("DATABASE_PORT", default="5432"),
        }
    }

# Channels & Redis Configuration
if env.str("REDIS_URL", default=""):
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [env("REDIS_URL")],
            },
        },
    }

# Static File Storage (WhiteNoise Compression)
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Production Security Controls (F-19)
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=False)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=False)

# Email Configuration
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@blueteamers.io")
