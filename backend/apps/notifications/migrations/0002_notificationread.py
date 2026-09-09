from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="NotificationRead",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("read_at", models.DateTimeField(auto_now_add=True)),
                (
                    "notification",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="read_by",
                        to="notifications.notification",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="read_notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Notification Read",
                "verbose_name_plural": "Notifications Read",
            },
        ),
        migrations.AddIndex(
            model_name="notificationread",
            index=models.Index(
                fields=["user", "notification"],
                name="notifications_user_notif_idx",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="notificationread",
            unique_together={("notification", "user")},
        ),
    ]
