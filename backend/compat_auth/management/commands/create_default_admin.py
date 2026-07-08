import os

from django.core.management.base import BaseCommand, CommandError

from compat_auth.models import CmsUser


class Command(BaseCommand):
    help = 'Create or update the default CMS admin user from legacy process.env-style variables.'

    def add_arguments(self, parser):
        parser.add_argument('--username', default=os.environ.get('dUsername'))
        parser.add_argument('--password', default=os.environ.get('dPassword'))
        parser.add_argument('--email', default=os.environ.get('dEmail', ''))
        parser.add_argument('--admin', default=os.environ.get('dAdmin', 'true'))
        parser.add_argument('--super', default=os.environ.get('dSDAdmin', 'true'))

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        if not username or not password:
            raise CommandError('username and password are required')

        user, created = CmsUser.objects.get_or_create(username=username)
        user.email = options['email'] or ''
        user.admin = str(options['admin']).lower() in ('1', 'true', 'yes')
        user.super_duper_admin = str(options['super']).lower() in ('1', 'true', 'yes')
        user.set_password(password)
        user.save()

        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} default admin user {username}'))
