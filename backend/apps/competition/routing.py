from django.urls import re_path, path
from apps.competition.consumers.arena_consumer import ArenaConsumer
from apps.competition.consumers.live_consumers import (
    EventsConsumer,
    LeaderboardConsumer,
    DashboardConsumer,
    NotificationsConsumer,
    ChallengesConsumer,
)

websocket_urlpatterns = [
    re_path(r"ws/arena/(?P<event_code>\w+)/$", ArenaConsumer.as_asgi()),
    path("ws/events/", EventsConsumer.as_asgi()),
    re_path(r"ws/leaderboard/(?P<event_code>\w+)?/?$", LeaderboardConsumer.as_asgi()),
    path("ws/dashboard/", DashboardConsumer.as_asgi()),
    path("ws/notifications/", NotificationsConsumer.as_asgi()),
    path("ws/challenges/", ChallengesConsumer.as_asgi()),
]
