import hashlib
import secrets

from django.db import models


ACCESS_LEVELS = {
    'SUPERADMIN': 15,
    'ADMIN': 10,
    'JUDGE': 5,
    'VIEW': 1,
    'NONE': 0,
}

ROLES = ('VIEW', 'JUDGE', 'INTERVIEW', 'ADMIN')


class CmsUserManager(models.Manager):
    def find_by_legacy_or_pk(self, object_id):
        """CmsUser is addressed externally by legacy_public_dict()'s `_id`,
        which is `legacy_id` for genuinely-migrated users or `str(pk)` for
        users created directly in Django -- callers (e.g. cms_users views
        handling routes/api/users.js's :userid params) need to resolve
        either form back to a row."""
        user = self.filter(legacy_id=object_id).first()
        if user is not None:
            return user
        if object_id.isdigit():
            return self.filter(pk=int(object_id)).first()
        return None


class CmsUser(models.Model):
    objects = CmsUserManager()

    legacy_id = models.CharField(max_length=24, unique=True, null=True, blank=True, db_index=True)
    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=128)
    email = models.EmailField(blank=True, default='')
    salt = models.CharField(max_length=64)
    admin = models.BooleanField(default=False)
    super_duper_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cms_users'
        ordering = ['username']

    def __str__(self):
        return self.username

    @staticmethod
    def hash_password(raw_password, salt):
        return hashlib.sha512(f'{salt}{raw_password}{salt}'.encode('utf-8')).hexdigest()

    def set_password(self, raw_password):
        self.salt = secrets.token_hex(16)
        self.password = self.hash_password(raw_password, self.salt)

    def compare_password(self, raw_password):
        return secrets.compare_digest(self.password, self.hash_password(raw_password, self.salt))

    def legacy_public_dict(self):
        return {
            '_id': self.legacy_id or str(self.pk),
            'username': self.username,
            'admin': self.admin,
            'superDuperAdmin': self.super_duper_admin,
            'competitions': [access.legacy_dict() for access in self.competition_accesses.all()],
        }


class UserCompetitionAccess(models.Model):
    user = models.ForeignKey(CmsUser, related_name='competition_accesses', on_delete=models.CASCADE)
    # Real FK, not a bare id string -- Competition now exists in Postgres
    # (competitions app). Express's competitionSchema pre-delete hooks
    # never clean up User.competitions when a competition is deleted (a
    # real gap there, dangling references left behind); CASCADE here is a
    # deliberate improvement, not a compatibility requirement.
    competition = models.ForeignKey('competitions.Competition', related_name='user_accesses', on_delete=models.CASCADE)
    access_level = models.PositiveSmallIntegerField(default=ACCESS_LEVELS['NONE'])
    role = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = 'cms_user_competition_access'
        constraints = [
            models.UniqueConstraint(fields=['user', 'competition'], name='uniq_cms_user_competition_access'),
        ]

    def legacy_dict(self):
        return {
            'id': self.competition_id,
            'accessLevel': self.access_level,
            'role': self.role or [],
        }
