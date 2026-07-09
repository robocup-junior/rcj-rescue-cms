# Hand-written for the same reason as competitions/migrations/
# 0002_competition_and_league_fks.py: the CharField -> ForeignKey
# conversion confuses makemigrations' autodetector into an interactive-
# only "provide a default" prompt. cms_user_competition_access is empty
# in every environment this has been applied to so far -- safe to
# RemoveField+AddField.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('compat_auth', '0001_initial'),
        ('competitions', '0002_competition_and_league_fks'),
    ]

    operations = [
        migrations.RemoveConstraint(model_name='usercompetitionaccess', name='uniq_cms_user_competition_access'),
        migrations.RemoveField(model_name='usercompetitionaccess', name='competition_id'),
        migrations.AddField(
            model_name='usercompetitionaccess',
            name='competition',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='user_accesses', to='competitions.competition'),
        ),
        migrations.AlterField(
            model_name='usercompetitionaccess',
            name='competition',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_accesses', to='competitions.competition'),
        ),
        migrations.AddConstraint(
            model_name='usercompetitionaccess',
            constraint=models.UniqueConstraint(fields=('user', 'competition'), name='uniq_cms_user_competition_access'),
        ),
    ]
