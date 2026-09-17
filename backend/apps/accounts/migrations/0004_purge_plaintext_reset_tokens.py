# Data migration: Password-reset tokens are now stored as SHA-256 digests
# (see PasswordResetToken.hash_token). Tokens created before this change were
# stored in plaintext and are no longer compatible with the hashed lookup in
# UserSelector.get_valid_password_reset_token, so they are purged here. They
# are short-lived and disposable, so no user-visible data is lost.

from django.db import migrations


def purge_plaintext_reset_tokens(apps, schema_editor):
    PasswordResetToken = apps.get_model("accounts", "PasswordResetToken")
    PasswordResetToken.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_remove_user_accounts_us_email_74c8d6_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(purge_plaintext_reset_tokens),
    ]
