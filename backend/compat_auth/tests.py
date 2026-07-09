from django.test import TestCase

from competitions.models import Competition

from .models import CmsUser, UserCompetitionAccess


class LegacyPasswordTests(TestCase):
    def test_hash_password_matches_legacy_sha512_salt_password_salt_format(self):
        digest = CmsUser.hash_password('rescue-pass', 'legacy-salt')

        self.assertEqual(
            digest,
            '1159cee786308683dac10c546b38cb907c6c93e263671bdf7dd997b8245685e18f7785d4f1cee5bbecfecd2c24c3d97619ed30dbe75a34b486b08deec3a43850',
        )

    def test_compare_password_accepts_matching_legacy_digest_and_rejects_other_passwords(self):
        user = CmsUser.objects.create(
            username='judge',
            salt='legacy-salt',
            password=CmsUser.hash_password('correct-password', 'legacy-salt'),
        )

        self.assertTrue(user.compare_password('correct-password'))
        self.assertFalse(user.compare_password('wrong-password'))


class CompatibilityAuthEndpointTests(TestCase):
    login_url = '/api/auth/login'
    logout_url = '/api/auth/logout'
    me_url = '/api/auth/me'

    def create_user(self, *, username='captain', password='secret-pass', **attrs):
        salt = attrs.pop('salt', f'{username}-salt')
        return CmsUser.objects.create(
            username=username,
            salt=salt,
            password=CmsUser.hash_password(password, salt),
            **attrs,
        )

    def login(self, username='captain', password='secret-pass'):
        return self.client.post(
            self.login_url,
            {'username': username, 'password': password},
            content_type='application/json',
        )

    def test_login_success_returns_express_json_and_authenticates_follow_up_requests(self):
        self.create_user(username='captain', password='secret-pass')

        response = self.login('captain', 'secret-pass')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'Login successful'})
        self.assertEqual(self.client.get(self.me_url).status_code, 200)

    def test_login_bad_password_returns_express_failure_json_without_authenticating(self):
        self.create_user(username='captain', password='secret-pass')

        response = self.login('captain', 'wrong-pass')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'msg': 'Login failed'})
        self.assertEqual(self.client.get(self.me_url).status_code, 400)

    def test_login_non_ascii_password_returns_invalid_characters_without_authenticating(self):
        self.create_user(username='captain', password='secret-pass')

        response = self.login('captain', 'pässword')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'msg': 'Invalid characters'})
        self.assertEqual(self.client.get(self.me_url).status_code, 400)

    def test_me_returns_legacy_public_user_shape_for_authenticated_session(self):
        user = self.create_user(
            username='captain',
            password='secret-pass',
            legacy_id='64f7c926f62d4dc53f7a0001',
            admin=True,
            super_duper_admin=True,
        )
        competition = Competition.objects.create(id='64f7c926f62d4dc53f7a0101', name='Some Competition')
        UserCompetitionAccess.objects.create(
            user=user,
            competition=competition,
            access_level=10,
            role=['ADMIN', 'JUDGE'],
        )
        self.login('captain', 'secret-pass')

        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                '_id': '64f7c926f62d4dc53f7a0001',
                'username': 'captain',
                'admin': True,
                'superDuperAdmin': True,
                'competitions': [
                    {
                        'id': '64f7c926f62d4dc53f7a0101',
                        'accessLevel': 10,
                        'role': ['ADMIN', 'JUDGE'],
                    }
                ],
            },
        )

    def test_logout_flushes_authenticated_session_and_returns_express_json(self):
        self.create_user(username='captain', password='secret-pass')
        self.login('captain', 'secret-pass')

        response = self.client.get(self.logout_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'Logout successful', 'status': True})
        self.assertEqual(self.client.get(self.me_url).status_code, 400)
