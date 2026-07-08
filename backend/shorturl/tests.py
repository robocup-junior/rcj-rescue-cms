from django.test import TestCase

from compat_auth.models import CmsUser

from .models import ShortUrl


class ShortUrlEndpointTests(TestCase):
    collection_url = '/api/short'

    def item_url(self, object_id):
        return f'{self.collection_url}/{object_id}'

    def create_user(self, *, username='super-user', password='secret-pass', super_duper_admin=True, admin=True):
        salt = f'{username}-salt'
        return CmsUser.objects.create(
            username=username,
            salt=salt,
            password=CmsUser.hash_password(password, salt),
            admin=admin,
            super_duper_admin=super_duper_admin,
        )

    def login(self, username='super-user', password='secret-pass'):
        return self.client.post(
            '/api/auth/login',
            {'username': username, 'password': password},
            content_type='application/json',
        )

    def post_json(self, url, payload):
        return self.client.post(url, payload, content_type='application/json')

    def test_list_requires_super_duper_admin_not_just_admin(self):
        anon_response = self.client.get(self.collection_url)
        self.assertEqual(anon_response.status_code, 400)
        self.assertEqual(anon_response.content.decode(), "You need to be 'superDuperAdmin' to do this")

        self.create_user(username='regular-admin', super_duper_admin=False)
        self.login('regular-admin')
        admin_only_response = self.client.get(self.collection_url)
        self.assertEqual(admin_only_response.status_code, 400)
        self.assertEqual(admin_only_response.content.decode(), "You need to be 'superDuperAdmin' to do this")

    def test_create_then_list_returns_legacy_shape(self):
        self.create_user()
        self.login()

        response = self.post_json(self.collection_url, {
            'name': 'Awesome Testbana',
            'shorted': 'abc123',
            'transfer': 'https://example.com/target',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'Setting has been registered!'})

        list_response = self.client.get(self.collection_url)
        rows = list_response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['name'], 'Awesome Testbana')
        self.assertEqual(rows[0]['shorted'], 'abc123')
        self.assertEqual(rows[0]['transfer'], 'https://example.com/target')
        self.assertEqual(rows[0]['__v'], 0)
        self.assertEqual(len(rows[0]['_id']), 24)

    def test_posting_same_name_again_updates_existing_row_instead_of_creating_new_one(self):
        self.create_user()
        self.login()
        self.post_json(self.collection_url, {'name': 'X', 'shorted': 'first', 'transfer': 'https://a.example'})

        response = self.post_json(self.collection_url, {'name': 'X', 'shorted': 'second', 'transfer': 'https://b.example'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ShortUrl.objects.count(), 1)
        row = ShortUrl.objects.get()
        self.assertEqual(row.shorted, 'second')
        self.assertEqual(row.transfer, 'https://b.example')

    def test_duplicate_shorted_slug_on_a_new_name_is_rejected(self):
        self.create_user()
        self.login()
        self.post_json(self.collection_url, {'name': 'X', 'shorted': 'taken', 'transfer': 'https://a.example'})

        response = self.post_json(self.collection_url, {'name': 'Y', 'shorted': 'taken', 'transfer': 'https://b.example'})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'msg': 'Could not register url shortening :('})
        self.assertEqual(ShortUrl.objects.count(), 1)

    def test_create_missing_field_returns_400(self):
        self.create_user()
        self.login()

        response = self.post_json(self.collection_url, {'name': 'X', 'shorted': 'abc'})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'msg': 'Could not register url shortening :('})
        self.assertEqual(ShortUrl.objects.count(), 0)

    def test_delete_requires_super_duper_admin_then_removes_row(self):
        obj = ShortUrl.objects.create(name='X', shorted='abc', transfer='https://a.example')

        anon_response = self.client.delete(self.item_url(obj.id))
        self.assertEqual(anon_response.status_code, 400)
        self.assertTrue(ShortUrl.objects.filter(pk=obj.id).exists())

        self.create_user()
        self.login()
        response = self.client.delete(self.item_url(obj.id))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'Setting has been removed!'})
        self.assertFalse(ShortUrl.objects.filter(pk=obj.id).exists())

    def test_delete_unknown_id_still_returns_success(self):
        self.create_user()
        self.login()

        response = self.client.delete(self.item_url('a' * 24))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'Setting has been removed!'})
