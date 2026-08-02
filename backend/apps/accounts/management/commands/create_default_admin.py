import os
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create default admin user if it does not exist"

    def handle(self, *args, **kwargs):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME", "admin")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@blueteamers.io")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "Admin@123")

        if not password:
            self.stdout.write(
                self.style.ERROR(
                    "DJANGO_SUPERUSER_PASSWORD environment variable is not set."
                )
            )
            return

        user = User.objects.filter(email=email).first() or User.objects.filter(username=username).first()

        if user:
            self.stdout.write(
                self.style.SUCCESS(f"Admin user '{email}' already exists.")
            )
            return

        try:
            User.objects.create_superuser(
                email=email,
                password=password,
                username=username,
                full_name="Default Administrator",
            )
            self.stdout.write(
                self.style.SUCCESS(f"Admin '{username}' ({email}) created successfully.")
            )
        except Exception:
            User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
            )
            self.stdout.write(
                self.style.SUCCESS(f"Admin '{username}' ({email}) created successfully.")
            )
