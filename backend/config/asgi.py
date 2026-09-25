"""
ASGI entrypoint — serves HTTP AND WebSockets from one process.

Import order matters: `get_asgi_application()` must run BEFORE importing any
consumer modules. It triggers django.setup(), and the consumers' imports
(models, ORM-bound helpers) require the app registry to be ready. Importing
`apps.competition.routing` first crashes a cold server boot with
AppRegistryNotReady (latent bug — masked whenever Django was already set up,
e.g. by the test runner, but fatal for `uvicorn config.asgi:application`).
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter

import apps.competition.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # Lifespan: uvicorn/daphne send a lifespan protocol message at startup;
    # without this key ASGI servers may warn or fail the handshake.
    "lifespan": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(apps.competition.routing.websocket_urlpatterns)
    ),
})
