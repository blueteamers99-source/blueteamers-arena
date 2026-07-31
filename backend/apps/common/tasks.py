import logging
from datetime import date
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from celery import shared_task
from apps.accounts.models.password_reset import PasswordResetToken
from apps.accounts.models.user import User
from apps.accounts.services.admin_analytics_service import AdminAnalyticsService
from apps.events.models.event import Event
from apps.participants.models.participant import Participant
from apps.leaderboard.models.leaderboard_snapshot import LeaderboardSnapshot
from apps.leaderboard.services.leaderboard_service import LeaderboardService
from apps.notifications.services.notification_service import NotificationService
from apps.competition.services.websocket_service import WebSocketService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_registration_confirmation_email_task(self, participant_id: str):
    """
    Sends an automated registration confirmation email to a student participant.
    """
    try:
        participant = Participant.objects.select_related("event").get(id=participant_id)
        subject = f"Registration Confirmed: {participant.event.workshop_name}"
        message = (
            f"Hello {participant.name},\n\n"
            f"You have been successfully registered for '{participant.event.workshop_name}' at {participant.event.college_name}.\n"
            f"Event Code: {participant.event.event_code}\n"
            f"Date: {participant.event.event_date}\n\n"
            f"Get ready to analyze threats in the arena!\n\n"
            f"— The Blueteamers Arena Team"
        )
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@blueteamers.io"),
            recipient_list=[participant.email],
            fail_silently=False,
        )
        logger.info(f"Confirmation email sent to {participant.email}")
        return f"Confirmation email sent to {participant.email}"
    except Exception as exc:
        logger.error(f"Error sending confirmation email: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_reminder_emails_task(self):
    """
    Sends reminder emails for upcoming events starting today.
    """
    today = date.today()
    upcoming_events = Event.objects.filter(status=Event.StatusChoices.UPCOMING, event_date=today)
    sent_count = 0
    for ev in upcoming_events:
        participants = Participant.objects.filter(event=ev)
        for p in participants:
            try:
                send_mail(
                    subject=f"Reminder: {ev.workshop_name} Starts Today!",
                    message=f"Hi {p.name},\n\n'{ev.workshop_name}' is starting today! Log in to join the arena.",
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@blueteamers.io"),
                    recipient_list=[p.email],
                    fail_silently=True,
                )
                sent_count += 1
            except Exception as e:
                logger.warning(f"Failed sending reminder to {p.email}: {e}")
    return f"Sent {sent_count} reminder emails for upcoming events."


@shared_task
def scheduled_event_publish_task():
    """
    Automatically publishes scheduled events whose registration window or date has arrived.
    """
    now = timezone.now()
    today = date.today()
    events_to_publish = Event.objects.filter(
        status=Event.StatusChoices.UPCOMING,
        auto_publish=True,
        event_date__lte=today,
    )
    count = 0
    for ev in events_to_publish:
        ev.status = Event.StatusChoices.LIVE
        ev.save()
        count += 1
        NotificationService.broadcast_global(
            title="Event Now Live!",
            message=f"The competition event '{ev.workshop_name}' at {ev.college_name} is now LIVE!",
            action_url=f"/event?code={ev.event_code}",
        )
    return f"Auto-published {count} events."


@shared_task
def scheduled_event_close_task():
    """
    Automatically closes events whose duration or end date has passed.
    """
    today = date.today()
    live_events = Event.objects.filter(status=Event.StatusChoices.LIVE, auto_close=True)
    count = 0
    for ev in live_events:
        if ev.event_date < today:
            ev.status = Event.StatusChoices.COMPLETED
            ev.save()
            count += 1
            # Archive final leaderboard snapshot
            data = LeaderboardService.get_event_leaderboard(event=ev)
            LeaderboardSnapshot.objects.create(event=ev, rank_data=data.get("rankings", []))
    return f"Auto-closed {count} events."


@shared_task
def cleanup_expired_tokens_task():
    """
    Purges expired password reset tokens and blacklisted JWT tokens.
    """
    deleted_reset, _ = PasswordResetToken.objects.filter(expires_at__lt=timezone.now()).delete()
    return f"Cleaned up {deleted_reset} expired password reset tokens."


@shared_task
def generate_analytics_report_task(period: str = "daily"):
    """
    Generates platform analytics report (daily/weekly/monthly).
    """
    stats = AdminAnalyticsService.get_platform_dashboard_stats()
    logger.info(f"Generated {period} analytics report: {stats['summary']}")
    return f"Generated {period} analytics report."


@shared_task
def refresh_live_leaderboards_task():
    """
    Calculates live leaderboard rankings and broadcasts updates via WebSockets for all LIVE events.
    """
    live_events = Event.objects.filter(status=Event.StatusChoices.LIVE)
    refreshed = 0
    for ev in live_events:
        data = LeaderboardService.get_event_leaderboard(event=ev)
        WebSocketService.notify_leaderboard_update(ev.event_code, data)
        refreshed += 1
    return f"Refreshed live leaderboards for {refreshed} live events."
