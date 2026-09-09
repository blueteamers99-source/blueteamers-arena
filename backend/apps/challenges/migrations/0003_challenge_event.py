# Generated manually to add event FK for cross-event isolation

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('challenges', '0002_rename_challenges__slug_123456_idx_challenges__slug_85cc59_idx_and_more'),
        ('events', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='challenge',
            name='event',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='challenges',
                to='events.event',
            ),
        ),
    ]
