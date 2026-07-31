import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("blueteamers_arena")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Enterprise Celery Beat Periodic Task Schedules
app.conf.beat_schedule = {
    "scheduled-event-publish-every-minute": {
        "task": "apps.common.tasks.scheduled_event_publish_task",
        "schedule": crontab(minute="*"),
    },
    "scheduled-event-close-every-minute": {
        "task": "apps.common.tasks.scheduled_event_close_task",
        "schedule": crontab(minute="*"),
    },
    "refresh-live-leaderboards-every-minute": {
        "task": "apps.common.tasks.refresh_live_leaderboards_task",
        "schedule": crontab(minute="*"),
    },
    "send-event-reminders-daily": {
        "task": "apps.common.tasks.send_reminder_emails_task",
        "schedule": crontab(hour=8, minute=0),
    },
    "cleanup-expired-tokens-daily": {
        "task": "apps.common.tasks.cleanup_expired_tokens_task",
        "schedule": crontab(hour=0, minute=0),
    },
    "generate-daily-analytics-report": {
        "task": "apps.common.tasks.generate_analytics_report_task",
        "schedule": crontab(hour=1, minute=0),
        "args": ("daily",),
    },
    "generate-weekly-analytics-report": {
        "task": "apps.common.tasks.generate_analytics_report_task",
        "schedule": crontab(hour=2, minute=0, day_of_week="monday"),
        "args": ("weekly",),
    },
    "generate-monthly-analytics-report": {
        "task": "apps.common.tasks.generate_analytics_report_task",
        "schedule": crontab(hour=3, minute=0, day_of_month="1"),
        "args": ("monthly",),
    },
}
