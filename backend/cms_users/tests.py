from django.test import TestCase

from compat_auth.models import CmsUser, UserCompetitionAccess
from competitions.models import Competition


class UsersEndpointTests(TestCase):
    collection_url = '/api/users'

    def item_url(self, object_id):
        return f'{self.collection_url}/{object_id}'

    def role_url(self, userid, competitionid):
        return f'{self.collection_url}/{userid}/{competitionid}/role'

    def alevel_url(self, userid, competitionid, alevel):
        return f'{self.collection_url}/{userid}/{competitionid}/{alevel}'

    def make_competition(self, name='Some Competition'):
        return Competition.objects.create(name=name)

    def make_user(self, *, username, password='secret-pass', admin=False, super_duper_admin=False, **attrs):
        salt = f'{username}-salt'
        return CmsUser.objects.create(
            username=username,
            salt=salt,
            password=CmsUser.hash_password(password, salt),
            admin=admin,
            super_duper_admin=super_duper_admin,
            **attrs,
        )

    def login(self, username, password='secret-pass'):
        return self.client.post(
            '/api/auth/login',
            {'username': username, 'password': password},
            content_type='application/json',
        )

    def post_json(self, url, payload):
        return self.client.post(url, payload, content_type='application/json')

    def put_json(self, url, payload):
        return self.client.put(url, payload, content_type='application/json')

    # -- GET / (list) --------------------------------------------------

    def test_list_requires_only_login_not_admin_flag(self):
        anon = self.client.get(self.collection_url)
        self.assertEqual(anon.status_code, 400)
        self.assertEqual(anon.content.decode(), 'You need to be logged in to do this')

        self.make_user(username='plain-view-user', admin=False, super_duper_admin=False)
        self.login('plain-view-user')

        response = self.client.get(self.collection_url)
        self.assertEqual(response.status_code, 200)

    def test_list_includes_email_and_competition_access(self):
        competition = self.make_competition()
        user = self.make_user(username='captain', email='captain@example.com')
        UserCompetitionAccess.objects.create(user=user, competition=competition, access_level=10, role=['ADMIN'])
        self.login('captain')

        response = self.client.get(self.collection_url)

        rows = response.json()
        row = next(r for r in rows if r['username'] == 'captain')
        self.assertEqual(row['email'], 'captain@example.com')
        self.assertEqual(row['competitions'], [{'id': competition.id, 'accessLevel': 10, 'role': ['ADMIN']}])

    # -- POST / (super only, create-or-update-by-username) --------------

    def test_create_requires_super_duper_admin_not_just_admin(self):
        self.make_user(username='regular-admin', admin=True, super_duper_admin=False)
        self.login('regular-admin')

        response = self.post_json(self.collection_url, {'username': 'new-guy', 'password': 'irrelevant'})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content.decode(), "You need to be 'superDuperAdmin' to do this")
        self.assertFalse(CmsUser.objects.filter(username='new-guy').exists())

    def test_create_new_user_hashes_password_and_seeds_competitions(self):
        competition = self.make_competition()
        self.make_user(username='root', super_duper_admin=True)
        self.login('root')

        response = self.post_json(self.collection_url, {
            'username': 'new-guy',
            'password': 'plaintext-pass',
            'email': 'new-guy@example.com',
            'admin': True,
            'competitions': [{'id': competition.id, 'accessLevel': 5, 'role': ['JUDGE']}],
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'User has been registerd!'})

        created = CmsUser.objects.get(username='new-guy')
        self.assertNotEqual(created.password, 'plaintext-pass')
        self.assertTrue(created.compare_password('plaintext-pass'))
        self.assertTrue(created.admin)
        access = created.competition_accesses.get()
        self.assertEqual(access.competition_id, competition.id)
        self.assertEqual(access.access_level, 5)

    def test_create_new_user_with_unknown_competition_id_is_rejected(self):
        self.make_user(username='root', super_duper_admin=True)
        self.login('root')

        response = self.post_json(self.collection_url, {
            'username': 'new-guy',
            'password': 'plaintext-pass',
            'competitions': [{'id': 'a' * 24, 'accessLevel': 5, 'role': ['JUDGE']}],
        })

        self.assertEqual(response.status_code, 400)
        self.assertFalse(CmsUser.objects.filter(username='new-guy').exists())

    def test_update_existing_user_does_not_touch_competitions(self):
        competition = self.make_competition()
        self.make_user(username='root', super_duper_admin=True)
        existing = self.make_user(username='captain', password='old-pass')
        UserCompetitionAccess.objects.create(user=existing, competition=competition, access_level=1, role=[])
        self.login('root')

        response = self.post_json(self.collection_url, {
            'username': 'captain',
            'password': 'new-pass',
            'admin': True,
            # Even though a `competitions` array is sent, updates ignore it --
            # only the two dedicated role/access-level endpoints may touch it.
            # Not even a real competition id, to prove it's never looked at.
            'competitions': [{'id': 'd' * 24, 'accessLevel': 10, 'role': ['ADMIN']}],
        })

        self.assertEqual(response.status_code, 200)
        existing.refresh_from_db()
        self.assertTrue(existing.compare_password('new-pass'))
        self.assertTrue(existing.admin)
        self.assertEqual(existing.competition_accesses.count(), 1)
        self.assertEqual(existing.competition_accesses.get().competition_id, competition.id)

    # -- PUT /:id/:competitionid/role ------------------------------------

    def test_update_role_requires_competition_admin_access(self):
        competition = self.make_competition()
        target = self.make_user(username='target')
        actor = self.make_user(username='low-access')
        UserCompetitionAccess.objects.create(user=actor, competition=competition, access_level=1, role=[])
        self.login('low-access')

        response = self.put_json(self.role_url(target.pk, competition.id), ['JUDGE'])

        self.assertEqual(response.status_code, 401)
        self.assertFalse(UserCompetitionAccess.objects.filter(user=target).exists())

    def test_update_role_against_unknown_competition_is_rejected(self):
        target = self.make_user(username='target')
        self.make_user(username='root', super_duper_admin=True)
        self.login('root')

        response = self.put_json(self.role_url(target.pk, 'a' * 24), ['JUDGE'])

        self.assertEqual(response.status_code, 400)
        self.assertFalse(UserCompetitionAccess.objects.filter(user=target).exists())

    def test_update_role_creates_access_with_zero_level_when_missing(self):
        competition = self.make_competition()
        target = self.make_user(username='target')
        actor = self.make_user(username='comp-admin')
        UserCompetitionAccess.objects.create(user=actor, competition=competition, access_level=10, role=[])
        self.login('comp-admin')

        response = self.put_json(self.role_url(target.pk, competition.id), ['JUDGE', 'JUDGE', 'VIEW'])

        self.assertEqual(response.status_code, 200)
        access = UserCompetitionAccess.objects.get(user=target, competition=competition)
        self.assertEqual(access.access_level, 0)
        self.assertEqual(access.role, ['JUDGE', 'VIEW'])

    def test_update_role_preserves_existing_access_level(self):
        competition = self.make_competition()
        target = self.make_user(username='target')
        UserCompetitionAccess.objects.create(user=target, competition=competition, access_level=5, role=['VIEW'])
        self.make_user(username='comp-admin', super_duper_admin=True)
        self.login('comp-admin')

        self.put_json(self.role_url(target.pk, competition.id), ['ADMIN'])

        access = UserCompetitionAccess.objects.get(user=target, competition=competition)
        self.assertEqual(access.access_level, 5)
        self.assertEqual(access.role, ['ADMIN'])

    # -- PUT /:id/:competitionid/:aLevel ----------------------------------

    def test_update_access_level_creates_with_empty_role_when_missing(self):
        competition = self.make_competition()
        target = self.make_user(username='target')
        self.make_user(username='root', super_duper_admin=True)
        self.login('root')

        response = self.put_json(self.alevel_url(target.pk, competition.id, '10'), {})

        self.assertEqual(response.status_code, 200)
        access = UserCompetitionAccess.objects.get(user=target, competition=competition)
        self.assertEqual(access.access_level, 10)
        self.assertEqual(access.role, [])

    def test_update_access_level_against_unknown_competition_is_rejected(self):
        target = self.make_user(username='target')
        self.make_user(username='root', super_duper_admin=True)
        self.login('root')

        response = self.put_json(self.alevel_url(target.pk, 'a' * 24, '10'), {})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(UserCompetitionAccess.objects.filter(user=target).exists())

    def test_update_access_level_preserves_existing_role(self):
        competition = self.make_competition()
        target = self.make_user(username='target')
        UserCompetitionAccess.objects.create(user=target, competition=competition, access_level=1, role=['VIEW'])
        self.make_user(username='root', super_duper_admin=True)
        self.login('root')

        self.put_json(self.alevel_url(target.pk, competition.id, '10'), {})

        access = UserCompetitionAccess.objects.get(user=target, competition=competition)
        self.assertEqual(access.access_level, 10)
        self.assertEqual(access.role, ['VIEW'])

    # -- DELETE /:id / PUT /:id (super only) ------------------------------

    def test_delete_requires_super_duper_admin(self):
        target = self.make_user(username='target')
        self.make_user(username='regular-admin', admin=True)
        self.login('regular-admin')

        response = self.client.delete(self.item_url(target.pk))

        self.assertEqual(response.status_code, 400)
        self.assertTrue(CmsUser.objects.filter(pk=target.pk).exists())

    def test_delete_removes_user(self):
        target = self.make_user(username='target')
        self.make_user(username='root', super_duper_admin=True)
        self.login('root')

        response = self.client.delete(self.item_url(target.pk))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'User has been removed!'})
        self.assertFalse(CmsUser.objects.filter(pk=target.pk).exists())

    def test_update_user_only_allows_email_not_username_or_admin_flags(self):
        target = self.make_user(username='target', email='old@example.com')
        self.make_user(username='root', super_duper_admin=True)
        self.login('root')

        response = self.put_json(self.item_url(target.pk), {
            'email': 'new@example.com',
            'username': 'hacked-name',
            'admin': True,
            'superDuperAdmin': True,
        })

        self.assertEqual(response.status_code, 200)
        target.refresh_from_db()
        self.assertEqual(target.email, 'new@example.com')
        self.assertEqual(target.username, 'target')
        self.assertFalse(target.admin)
        self.assertFalse(target.super_duper_admin)

    # -- POST /me/password --------------------------------------------

    def test_change_own_password_requires_current_password_to_match(self):
        self.make_user(username='captain', password='old-Passw0rd')
        self.login('captain', 'old-Passw0rd')

        response = self.post_json(f'{self.collection_url}/me/password', {
            'current': 'wrong-pass',
            'new': 'New-Passw0rd',
            'confirm': 'New-Passw0rd',
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'msg': 'Current password is incorrect'})

    def test_change_own_password_enforces_strength_and_confirmation(self):
        self.make_user(username='captain', password='old-Passw0rd')
        self.login('captain', 'old-Passw0rd')

        mismatch = self.post_json(f'{self.collection_url}/me/password', {
            'current': 'old-Passw0rd', 'new': 'New-Passw0rd', 'confirm': 'different',
        })
        self.assertEqual(mismatch.json(), {'msg': 'Passwords do not match'})

        weak = self.post_json(f'{self.collection_url}/me/password', {
            'current': 'old-Passw0rd', 'new': 'alllowercase', 'confirm': 'alllowercase',
        })
        self.assertEqual(weak.json(), {'msg': 'Password does not meet the requirements'})

    def test_change_own_password_success_updates_hash(self):
        user = self.make_user(username='captain', password='old-Passw0rd')
        self.login('captain', 'old-Passw0rd')

        response = self.post_json(f'{self.collection_url}/me/password', {
            'current': 'old-Passw0rd', 'new': 'New-Passw0rd', 'confirm': 'New-Passw0rd',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'Password updated successfully'})
        user.refresh_from_db()
        self.assertTrue(user.compare_password('New-Passw0rd'))
