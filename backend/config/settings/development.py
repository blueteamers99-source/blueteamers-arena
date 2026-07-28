from .base import *

DEBUG = env.bool("DEBUG", default=True)

# Database Configuration with SQLite fallback for instant local development
if env.str("DATABASE_URL", default=""):
    DATABASES = {
        "default": env.db("DATABASE_URL")
    }
else:
    db_engine = env("DATABASE_ENGINE", default="django.db.backends.sqlite3")
    if db_engine == "django.db.backends.sqlite3":
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": BASE_DIR / "db.sqlite3",
            }
        }
    else:
        DATABASES = {
            "default": {
                "ENGINE": db_engine,
                "NAME": env("DATABASE_NAME", default="blueteamers_db"),
                "USER": env("DATABASE_USER", default="postgres"),
                "PASSWORD": env("DATABASE_PASSWORD", default="postgres"),
                "HOST": env("DATABASE_HOST", default="localhost"),
                "PORT": env("DATABASE_PORT", default="5432"),
            }
        }

# Email Backend (Console for Development)
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
