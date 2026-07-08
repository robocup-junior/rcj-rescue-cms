from django.test import TestCase

from compat_auth.models import CmsUser

from .models import Field, Round


class _RoundOrFieldEndpointTests:
    """Shared behavior for Round and Field: routes/api/rounds.js and
    routes/api/fields.js are near-identical in Express, so exercise both
    resources through one shared test body instead of duplicating it."""

    model = None
    label = None
    collection_url = None

    def item_url(self, object_id):
        return f'{self.collection_url}/{object_id}'

    def competition_url(self, competition_id):
        return f'/api/competitions/{competition_id}/{self.label}s'

    def competition_name_url(self, competition_id, name):
        return f'{self.competition_url(competition_id)}/{name}'

    def create_user(self, *, username='admin-user', password='secret-pass', admin=True, **attrs):
        salt = f'{username}-salt'
        return CmsUser.objects.create(
            username=username,
            salt=salt,
            password=CmsUser.hash_password(password, salt),
            admin=admin,
            **attrs,
        )

    def login(self, username='admin-user', password='secret-pass'):
        return self.client.post(
            '/api/auth/login',
            {'username': username, 'password': password},
            content_type='application/json',
        )

    def test_list_is_empty_array_when_no_rows_exist(self):
        response = self.client.get(self.collection_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_create_requires_login(self):
        response = self.client.post(
            self.collection_url,
            {'name': 'Round 1', 'competition': 'a' * 24},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content.decode(), 'You need to be logged in to do this')
        self.assertEqual(self.model.objects.count(), 0)

    def test_create_requires_admin_flag_even_when_logged_in(self):
        self.create_user(username='regular', admin=False)
        self.login('regular')

        response = self.client.post(
            self.collection_url,
            {'name': 'Round 1', 'competition': 'a' * 24},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content.decode(), 'You need to be admin to do this')
        self.assertEqual(self.model.objects.count(), 0)

    def test_admin_can_create_then_fetch_by_id_and_by_competition(self):
        self.create_user()
        self.login()
        competition_id = 'b' * 24

        create_response = self.client.post(
            self.collection_url,
            {'name': 'Round 1', 'competition': competition_id},
            content_type='application/json',
        )

        self.assertEqual(create_response.status_code, 201)
        body = create_response.json()
        self.assertEqual(body['msg'], f'New {self.label} has been saved')
        new_id = body['id']
        self.assertEqual(len(new_id), 24)
        self.assertEqual(create_response['Location'], f'{self.collection_url}/{new_id}')

        expected = {'_id': new_id, 'competition': competition_id, 'name': 'Round 1', '__v': 0}

        self.assertEqual(self.client.get(self.item_url(new_id)).json(), expected)
        self.assertEqual(self.client.get(self.competition_url(competition_id)).json(), [expected])
        self.assertEqual(
            self.client.get(self.competition_name_url(competition_id, 'Round 1')).json(),
            [{'_id': new_id}],
        )

    def test_get_by_unknown_id_returns_empty_200_body_like_express_doidquery(self):
        response = self.client.get(self.item_url('f' * 24))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b'')

    def test_duplicate_name_within_same_competition_is_rejected(self):
        self.create_user()
        self.login()
        payload = {'name': 'Round 1', 'competition': 'c' * 24}
        self.client.post(self.collection_url, payload, content_type='application/json')

        response = self.client.post(self.collection_url, payload, content_type='application/json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {'msg': f'Error saving {self.label}', 'err': f'{self.label.capitalize()} with name "Round 1" already exists!'},
        )
        self.assertEqual(self.model.objects.count(), 1)

    def test_same_name_is_allowed_across_different_competitions(self):
        self.create_user()
        self.login()

        for competition_id in ('d' * 24, 'e' * 24):
            response = self.client.post(
                self.collection_url,
                {'name': 'Round 1', 'competition': competition_id},
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 201)

        self.assertEqual(self.model.objects.count(), 2)

    def test_create_missing_name_returns_400_without_saving(self):
        self.create_user()
        self.login()

        response = self.client.post(
            self.collection_url,
            {'competition': 'a' * 24},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.model.objects.count(), 0)

    def test_delete_requires_login_then_admin_removes_row(self):
        obj = self.model.objects.create(name='To delete', competition_id='a' * 24)

        anon_response = self.client.delete(self.item_url(obj.id))
        self.assertEqual(anon_response.status_code, 400)
        self.assertTrue(self.model.objects.filter(pk=obj.id).exists())

        self.create_user()
        self.login()
        delete_response = self.client.delete(self.item_url(obj.id))

        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {'msg': f'{self.label.capitalize()} has been removed!'})
        self.assertFalse(self.model.objects.filter(pk=obj.id).exists())

    def test_delete_unknown_id_still_returns_success_like_express_deleteone(self):
        self.create_user()
        self.login()

        response = self.client.delete(self.item_url('a' * 24))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': f'{self.label.capitalize()} has been removed!'})


class RoundEndpointTests(_RoundOrFieldEndpointTests, TestCase):
    model = Round
    label = 'round'
    collection_url = '/api/rounds'


class FieldEndpointTests(_RoundOrFieldEndpointTests, TestCase):
    model = Field
    label = 'field'
    collection_url = '/api/fields'
