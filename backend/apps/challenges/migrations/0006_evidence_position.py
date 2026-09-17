import django.db.models.deletion
from django.db import migrations, models


def backfill_positions(apps, schema_editor):
    """
    Backfill `position` per challenge using the previously effective display
    order (created_at, then id) so existing deployments keep a stable order
    instead of an arbitrary one. The seeders then normalize positions to the
    canonical resource order on the next run.
    """
    Evidence = apps.get_model("challenges", "Evidence")

    challenge_ids = (
        Evidence.objects.values_list("challenge_id", flat=True).distinct()
    )
    for challenge_id in challenge_ids:
        for idx, ev in enumerate(
            Evidence.objects.filter(challenge_id=challenge_id).order_by("created_at", "id")
        ):
            if ev.position != idx:
                ev.position = idx
                ev.save(update_fields=["position"])


class Migration(migrations.Migration):

    dependencies = [
        ("challenges", "0005_add_passing_percentage_to_challenge"),
    ]

    operations = [
        migrations.AddField(
            model_name="evidence",
            name="position",
            field=models.PositiveIntegerField(
                default=0,
                db_index=True,
                help_text="Display order of the evidence within its challenge (0 = first resource shown).",
            ),
        ),
        migrations.RunPython(backfill_positions, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name="evidence",
            options={
                "ordering": ["position", "created_at"],
                "verbose_name": "Evidence File",
                "verbose_name_plural": "Evidence Files",
            },
        ),
    ]
