from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='CmsUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('legacy_id', models.CharField(blank=True, db_index=True, max_length=24, null=True, unique=True)),
                ('username', models.CharField(max_length=150, unique=True)),
                ('password', models.CharField(max_length=128)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('salt', models.CharField(max_length=64)),
                ('admin', models.BooleanField(default=False)),
                ('super_duper_admin', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'cms_users',
                'ordering': ['username'],
            },
        ),
        migrations.CreateModel(
            name='UserCompetitionAccess',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('competition_id', models.CharField(db_index=True, max_length=24)),
                ('access_level', models.PositiveSmallIntegerField(default=0)),
                ('role', models.JSONField(blank=True, default=list)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='competition_accesses', to='compat_auth.cmsuser')),
            ],
            options={
                'db_table': 'cms_user_competition_access',
            },
        ),
        migrations.AddConstraint(
            model_name='usercompetitionaccess',
            constraint=models.UniqueConstraint(fields=('user', 'competition_id'), name='uniq_cms_user_competition_access'),
        ),
    ]
