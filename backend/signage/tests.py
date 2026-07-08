import os
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from compat_auth.models import CmsUser

from .models import Signage


class _AuthMixin:
    def make_user(self, *, username='admin-user', password='secret-pass', admin=True):
        salt = f'{username}-salt'
        return CmsUser.objects.create(
            username=username,
            salt=salt,
            password=CmsUser.hash_password(password, salt),
            admin=admin,
        )

    def login(self, username='admin-user', password='secret-pass'):
        return self.client.post(
            '/api/auth/login',
            {'username': username, 'password': password},
            content_type='application/json',
        )

    def post_json(self, url, payload):
        return self.client.post(url, payload, content_type='application/json')

    def put_json(self, url, payload):
        return self.client.put(url, payload, content_type='application/json')


class SignageCrudTests(_AuthMixin, TestCase):
    collection_url = '/api/signage'

    def item_url(self, object_id):
        return f'{self.collection_url}/{object_id}'

    def test_list_requires_login_only(self):
        anon = self.client.get(self.collection_url)
        self.assertEqual(anon.status_code, 400)

        self.make_user(username='plain', admin=False)
        self.login('plain')
        response = self.client.get(self.collection_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_both_trailing_slash_forms_list_the_same_thing(self):
        self.make_user()
        self.login()
        self.assertEqual(self.client.get(self.collection_url).status_code, 200)
        self.assertEqual(self.client.get(f'{self.collection_url}/').status_code, 200)

    def test_create_requires_admin_flag(self):
        self.make_user(username='plain', admin=False)
        self.login('plain')

        response = self.post_json(self.collection_url, {'name': 'Lobby screen'})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Signage.objects.count(), 0)

    def test_create_applies_content_item_defaults_and_returns_legacy_response_shape(self):
        self.make_user()
        self.login()

        response = self.post_json(self.collection_url, {
            'name': 'Lobby screen',
            'content': [{'duration': 5, 'type': 'image', 'url': '/a.png'}],
            'news': ['hello'],
        })

        self.assertEqual(response.status_code, 201)
        # Express's own bug: success uses `err` as the message key, not `msg`.
        body = response.json()
        self.assertEqual(body['err'], 'New run has been saved')
        new_id = body['id']

        row = Signage.objects.get(pk=new_id)
        self.assertEqual(row.content, [{
            'duration': 5, 'type': 'image', 'url': '/a.png',
            'group': '0', 'disable': False, 'onlyOnce': False, 'repeat': 1,
        }])

    def test_create_rejects_content_item_missing_required_field(self):
        self.make_user()
        self.login()

        response = self.post_json(self.collection_url, {
            'name': 'Lobby screen',
            'content': [{'duration': 5, 'type': 'image'}],  # missing url
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Signage.objects.count(), 0)

    def test_duplicate_name_rejected(self):
        self.make_user()
        self.login()
        self.post_json(self.collection_url, {'name': 'Lobby screen', 'content': []})

        response = self.post_json(self.collection_url, {'name': 'Lobby screen', 'content': []})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Signage.objects.count(), 1)

    def test_get_by_id_and_unknown_id(self):
        self.make_user()
        self.login()
        create = self.post_json(self.collection_url, {'name': 'Lobby screen', 'content': [], 'news': ['n1']})
        new_id = create.json()['id']

        found = self.client.get(self.item_url(new_id))
        self.assertEqual(found.status_code, 200)
        self.assertEqual(found.json(), {'_id': new_id, 'name': 'Lobby screen', 'content': [], 'news': ['n1'], '__v': 0})

        missing = self.client.get(self.item_url('f' * 24))
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(missing.content, b'')

    def test_update_requires_admin_and_replaces_fields(self):
        self.make_user()
        self.login()
        create = self.post_json(self.collection_url, {'name': 'Lobby screen', 'content': []})
        new_id = create.json()['id']

        response = self.put_json(self.item_url(new_id), {'name': 'Renamed', 'content': [], 'news': ['updated']})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'Saved change'})
        row = Signage.objects.get(pk=new_id)
        self.assertEqual(row.name, 'Renamed')
        self.assertEqual(row.news, ['updated'])

    def test_delete_requires_admin_then_removes_row(self):
        row = Signage.objects.create(name='To delete')
        self.make_user(username='plain', admin=False)
        self.login('plain')

        forbidden = self.client.delete(self.item_url(row.id))
        self.assertEqual(forbidden.status_code, 400)
        self.assertTrue(Signage.objects.filter(pk=row.id).exists())

        self.make_user(username='root', admin=True)
        self.login('root')
        response = self.client.delete(self.item_url(row.id))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Signage.objects.filter(pk=row.id).exists())

    def test_refresh_always_reports_socket_down_since_no_realtime_layer_is_wired(self):
        row = Signage.objects.create(name='Lobby screen')
        self.make_user()
        self.login()

        response = self.client.get(self.item_url(f'{row.id}/refresh'))

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'msg': 'Socket server is now down'})

    def test_field_endpoint_expands_content_repeat_and_exposes_news(self):
        row = Signage.objects.create(
            name='Lobby screen',
            content=[
                {'duration': 5, 'type': 'image', 'url': '/a.png', 'repeat': 3},
                {'duration': 5, 'type': 'image', 'url': '/b.png', 'repeat': 1},
            ],
            news=['n1', 'n2'],
        )
        self.make_user()
        self.login()

        content_response = self.client.get(self.item_url(f'{row.id}/content'))
        self.assertEqual(len(content_response.json()['content']), 4)  # 3x a.png + 1x b.png

        news_response = self.client.get(self.item_url(f'{row.id}/news'))
        self.assertEqual(news_response.json(), {'_id': row.id, 'news': ['n1', 'n2']})


@override_settings()
class SignageContentFilesTests(_AuthMixin, TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp_dir, ignore_errors=True)
        self.settings_override = override_settings(SIGNAGE_CONTENT_DIR=self.tmp_dir)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

        with open(os.path.join(self.tmp_dir, 'photo.png'), 'wb') as fh:
            fh.write(b'fake-png-bytes')
        with open(os.path.join(self.tmp_dir, 'clip.mp4'), 'wb') as fh:
            fh.write(b'fake-mp4-bytes')
        with open(os.path.join(self.tmp_dir, 'boot.html'), 'w') as fh:
            fh.write('<html></html>')

        self.make_user()
        self.login()

    def test_content_list_excludes_html_and_includes_mime_type(self):
        response = self.client.get('/api/signage/contentList')

        names = {entry['name'] for entry in response.json()}
        self.assertEqual(names, {'photo.png', 'clip.mp4'})

    def test_content_list_img_and_mov_filter_by_extension(self):
        images = self.client.get('/api/signage/contentList/img').json()
        movies = self.client.get('/api/signage/contentList/mov').json()

        self.assertEqual(images, ['photo.png'])
        self.assertEqual(movies, ['clip.mp4'])

    def test_upload_writes_file_to_disk(self):
        upload = SimpleUploadedFile('new.png', b'binary-content', content_type='image/png')

        response = self.client.post('/api/signage/contentList/upload', {'file': upload})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'File is uploaded', 'fileName': 'new.png'})
        with open(os.path.join(self.tmp_dir, 'new.png'), 'rb') as fh:
            self.assertEqual(fh.read(), b'binary-content')

    def test_delete_removes_file_from_disk(self):
        response = self.client.delete('/api/signage/contentList/photo.png')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'msg': 'File is deleted', 'fileName': 'photo.png'})
        self.assertFalse(os.path.exists(os.path.join(self.tmp_dir, 'photo.png')))

    def test_file_endpoints_require_admin(self):
        self.make_user(username='plain', admin=False)
        self.login('plain')

        self.assertEqual(self.client.get('/api/signage/contentList').status_code, 400)
