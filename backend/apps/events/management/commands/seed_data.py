from django.core.management.base import BaseCommand
import seed_production_real_data


class Command(BaseCommand):
    help = "Seeds production PostgreSQL database with real students, events, domain challenges, and submissions."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting production PostgreSQL database seeding..."))
        try:
            seed_production_real_data.seed_real_data()
            self.stdout.write(self.style.SUCCESS("Successfully seeded production PostgreSQL database!"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error seeding database: {e}"))
