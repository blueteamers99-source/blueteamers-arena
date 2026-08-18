import json
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Exports Postman Collection JSON for Blueteamers Arena REST APIs."

    def handle(self, *args, **options):
        collection = {
            "info": {
                "name": "Blueteamers Arena API Collection",
                "description": "Postman API Collection for Blueteamers Arena SOC CTF Platform.",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            },
            "item": [
                {
                    "name": "Authentication",
                    "item": [
                        {
                            "name": "Admin Login",
                            "request": {
                                "method": "POST",
                                "header": [{"key": "Content-Type", "value": "application/json"}],
                                "body": {
                                    "mode": "raw",
                                    "raw": json.dumps({"email": "admin@blueteamers.io", "password": "{{admin_password}}"}),
                                },
                                "url": {"raw": "{{baseUrl}}/api/v1/auth/login/", "host": ["{{baseUrl}}"], "path": ["api", "v1", "auth", "login", ""]},
                            },
                        },
                    ],
                },
                {
                    "name": "Student Platform",
                    "item": [
                        {
                            "name": "Verify Event Code",
                            "request": {
                                "method": "POST",
                                "header": [{"key": "Content-Type", "value": "application/json"}],
                                "body": {"mode": "raw", "raw": json.dumps({"code": "CBIT2026"})},
                                "url": {"raw": "{{baseUrl}}/api/v1/arena/verify-code/", "host": ["{{baseUrl}}"], "path": ["api", "v1", "arena", "verify-code", ""]},
                            },
                        },
                        {
                            "name": "Student Dashboard",
                            "request": {
                                "method": "GET",
                                "header": [{"key": "X-Participant-Token", "value": "{{participantToken}}"}],
                                "url": {"raw": "{{baseUrl}}/api/v1/dashboard/", "host": ["{{baseUrl}}"], "path": ["api", "v1", "dashboard", ""]},
                            },
                        },
                    ],
                },
                {
                    "name": "Health Check",
                    "request": {
                        "method": "GET",
                        "url": {"raw": "{{baseUrl}}/api/health/", "host": ["{{baseUrl}}"], "path": ["api", "health", ""]},
                    },
                },
            ],
            "variable": [
                {"key": "baseUrl", "value": "http://localhost:8000"},
                {"key": "participantToken", "value": ""},
            ],
        }

        output_filename = "blueteamers_postman_collection.json"
        with open(output_filename, "w") as f:
            json.dump(collection, f, indent=2)

        self.stdout.write(self.style.SUCCESS(f"Successfully exported Postman collection to {output_filename}"))
