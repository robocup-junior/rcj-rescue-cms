# Hand-written (not autodetector-generated): makemigrations' interactive
# "provide a default" prompt for the Round/Field competition_id -> FK
# conversion can't be answered non-interactively, and it doesn't matter
# anyway since both tables are empty in every environment this has been
# applied to so far. Safe to RemoveField+AddField rather than backfill.

import django.db.models.deletion
from django.db import migrations, models

import competitions.models


class Migration(migrations.Migration):

    dependencies = [
        ('competitions', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Competition',
            fields=[
                ('id', models.CharField(default=competitions.models.new_object_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255, unique=True)),
                ('logo', models.CharField(default='/images/noLogo.png', max_length=512)),
                ('bk_color', models.CharField(default='#fff', max_length=32)),
                ('color', models.CharField(default='#000', max_length=32)),
                ('message', models.TextField(blank=True, default='')),
                ('description', models.TextField(blank=True, default='')),
                ('preparation', models.BooleanField(default=True)),
                ('public_token', models.CharField(default=competitions.models.new_public_token, editable=False, max_length=32)),
                ('documents_enable', models.BooleanField(default=False)),
                ('documents_deadline', models.BigIntegerField(default=0)),
            ],
            options={'db_table': 'competitions'},
        ),
        migrations.RemoveConstraint(model_name='round', name='uniq_round_competition_name'),
        migrations.RemoveConstraint(model_name='field', name='uniq_field_competition_name'),
        migrations.RemoveField(model_name='round', name='competition_id'),
        migrations.RemoveField(model_name='field', name='competition_id'),
        migrations.AddField(
            model_name='round',
            name='competition',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rounds', to='competitions.competition'),
        ),
        migrations.AddField(
            model_name='field',
            name='competition',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='fields', to='competitions.competition'),
        ),
        migrations.AlterField(
            model_name='round',
            name='competition',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rounds', to='competitions.competition'),
        ),
        migrations.AlterField(
            model_name='field',
            name='competition',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fields', to='competitions.competition'),
        ),
        migrations.AddConstraint(
            model_name='round',
            constraint=models.UniqueConstraint(fields=('competition', 'name'), name='uniq_round_competition_name'),
        ),
        migrations.AddConstraint(
            model_name='field',
            constraint=models.UniqueConstraint(fields=('competition', 'name'), name='uniq_field_competition_name'),
        ),
        migrations.CreateModel(
            name='CompetitionLeague',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('league', models.CharField(max_length=64)),
                ('num', models.IntegerField(default=20)),
                ('mode', models.CharField(
                    choices=[
                        ('SUM_OF_BEST_N_GAMES', 'SUM_OF_BEST_N_GAMES'),
                        ('MEAN_OF_NORMALIZED_BEST_N_GAMES', 'MEAN_OF_NORMALIZED_BEST_N_GAMES'),
                        ('MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT', 'MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT'),
                        ('GAMES_DOCUMENT_CHALLENGE', 'GAMES_DOCUMENT_CHALLENGE'),
                    ],
                    default='SUM_OF_BEST_N_GAMES', max_length=64,
                )),
                ('disclose', models.BooleanField(default=False)),
                ('rule', models.CharField(default='', max_length=32)),
                ('competition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='leagues', to='competitions.competition')),
            ],
            options={'db_table': 'competition_leagues'},
        ),
        migrations.AddConstraint(
            model_name='competitionleague',
            constraint=models.UniqueConstraint(fields=('competition', 'league'), name='uniq_competition_league'),
        ),
    ]
