import os
import shutil
import tempfile

from django.test import TestCase, override_settings

from compat_auth.models import ACCESS_LEVELS, CmsUser, UserCompetitionAccess

from .models import Competition, CompetitionLeague, Field, Round


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

    def make_competition(self, name='Some Competition'):
        return Competition.objects.create(name=name)

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
        competition_id = self.make_competition().id

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

    def test_create_against_nonexistent_competition_is_rejected_distinctly(self):
        # New behavior vs. Express: Mongoose refs aren't enforced FKs, so
        # this would silently succeed there. Postgres's real FK constraint
        # is stricter (deliberately); this must not be reported as a
        # duplicate-name error, so check the message is the distinct one.
        self.create_user()
        self.login()

        response = self.client.post(
            self.collection_url,
            {'name': 'Round 1', 'competition': 'a' * 24},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'msg': f'Error saving {self.label}', 'err': 'competition not found'})
        self.assertEqual(self.model.objects.count(), 0)

    def test_duplicate_name_within_same_competition_is_rejected(self):
        self.create_user()
        self.login()
        competition_id = self.make_competition().id
        payload = {'name': 'Round 1', 'competition': competition_id}
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

        for competition in (self.make_competition('Comp D'), self.make_competition('Comp E')):
            response = self.client.post(
                self.collection_url,
                {'name': 'Round 1', 'competition': competition.id},
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 201)

        self.assertEqual(self.model.objects.count(), 2)

    def test_create_missing_name_returns_400_without_saving(self):
        self.create_user()
        self.login()

        response = self.client.post(
            self.collection_url,
            {'competition': self.make_competition().id},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.model.objects.count(), 0)

    def test_delete_requires_login_then_admin_removes_row(self):
        obj = self.model.objects.create(name='To delete', competition=self.make_competition())

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


class CompetitionEndpointTests(TestCase):
    collection_url = '/api/competitions'

    def setUp(self):
        # POST creates real directories under settings.REPO_ROOT (documents/,
        # survey/, cabinet/<league>/, backup/, mailAttachment/) -- point that
        # at a throwaway tempdir instead of the real repo for the duration
        # of these tests, same approach as signage/tests.py.
        self.tmp_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp_dir, ignore_errors=True)
        override = override_settings(REPO_ROOT=self.tmp_dir)
        override.enable()
        self.addCleanup(override.disable)

    def item_url(self, competition_id):
        return f'{self.collection_url}/{competition_id}'

    def make_user(self, *, username='admin-user', password='secret-pass', admin=False, super_duper_admin=False):
        salt = f'{username}-salt'
        return CmsUser.objects.create(
            username=username, salt=salt, password=CmsUser.hash_password(password, salt),
            admin=admin, super_duper_admin=super_duper_admin,
        )

    def login(self, username='admin-user', password='secret-pass'):
        return self.client.post(
            '/api/auth/login', {'username': username, 'password': password}, content_type='application/json',
        )

    def post_json(self, url, payload):
        return self.client.post(url, payload, content_type='application/json')

    def put_json(self, url, payload):
        return self.client.put(url, payload, content_type='application/json')

    def test_list_reports_viewers_access_level_per_competition(self):
        comp = Competition.objects.create(name='Comp A')
        admin_user = self.make_user(username='comp-admin')
        UserCompetitionAccess.objects.create(user=admin_user, competition=comp, access_level=ACCESS_LEVELS['ADMIN'], role=[])
        outsider = self.make_user(username='outsider')

        self.login('comp-admin')
        row = next(r for r in self.client.get(self.collection_url).json() if r['_id'] == comp.id)
        self.assertEqual(row['authLevel'], ACCESS_LEVELS['ADMIN'])
        # Schema default is truthy ('/images/noLogo.png'), so the list
        # endpoint's own '/images/NoImage.png' fallback (for an explicitly
        # empty logo) never actually triggers in practice -- same quirk as
        # Express, see Competition.legacy_list_dict()'s docstring.
        self.assertEqual(row['logo'], '/images/noLogo.png')

        self.client.get('/api/auth/logout')
        self.login('outsider')
        row = next(r for r in self.client.get(self.collection_url).json() if r['_id'] == comp.id)
        self.assertEqual(row['authLevel'], ACCESS_LEVELS['NONE'])

    def test_empty_string_fields_fall_back_to_distinct_defaults_per_endpoint(self):
        # Exercises the actual fallback branches: list uses NoImage.png /
        # '000000' / 'ffffff', detail uses noLogo.png -- distinct defaults,
        # not a typo, see Competition.legacy_dict()/legacy_list_dict().
        comp = Competition.objects.create(name='Comp A', logo='', color='', bk_color='')

        list_row = next(r for r in self.client.get(self.collection_url).json() if r['_id'] == comp.id)
        self.assertEqual(list_row['logo'], '/images/NoImage.png')
        self.assertEqual(list_row['color'], '000000')
        self.assertEqual(list_row['bkColor'], 'ffffff')

        detail = self.client.get(self.item_url(comp.id)).json()
        self.assertEqual(detail['logo'], '/images/noLogo.png')
        self.assertEqual(detail['color'], '#000')
        self.assertEqual(detail['bkColor'], '#fff')

    def test_leagues_reference_endpoints_serve_static_leagues_json(self):
        all_leagues = self.client.get(f'{self.collection_url}/leagues').json()
        self.assertGreater(len(all_leagues), 0)
        first = all_leagues[0]

        detail = self.client.get(f'{self.collection_url}/leagues/{first["id"]}').json()
        self.assertEqual(detail, {'id': first['id'], 'type': first['type'], 'name': first['name']})

        missing = self.client.get(f'{self.collection_url}/leagues/DoesNotExist')
        self.assertEqual(missing.status_code, 404)

    def test_create_requires_admin_seeds_leagues_and_grants_creator_admin_access(self):
        self.make_user(username='regular', admin=False)
        self.login('regular')
        denied = self.post_json(self.collection_url, {'name': 'New Comp'})
        self.assertEqual(denied.status_code, 400)

        self.client.get('/api/auth/logout')
        creator = self.make_user(username='creator', admin=True)
        self.login('creator')

        response = self.post_json(self.collection_url, {'name': 'New Comp'})

        self.assertEqual(response.status_code, 201)
        new_id = response.json()['id']
        comp = Competition.objects.get(pk=new_id)

        # Every league in leagues.json got seeded with its latest rule.
        self.assertGreater(comp.leagues.count(), 0)
        for league in comp.leagues.all():
            self.assertTrue(league.rule)

        # Directory side effects landed under the (tempdir) REPO_ROOT.
        self.assertTrue(os.path.isdir(os.path.join(self.tmp_dir, 'documents', new_id)))
        self.assertTrue(os.path.isdir(os.path.join(self.tmp_dir, 'survey', new_id)))
        self.assertTrue(os.path.isdir(os.path.join(self.tmp_dir, 'backup', new_id)))
        for league in comp.leagues.all():
            self.assertTrue(os.path.isdir(os.path.join(self.tmp_dir, 'cabinet', new_id, league.league)))

        # Creator is granted ADMIN access automatically.
        access = UserCompetitionAccess.objects.get(user=creator, competition=comp)
        self.assertEqual(access.access_level, ACCESS_LEVELS['ADMIN'])

    def test_create_duplicate_name_is_rejected(self):
        Competition.objects.create(name='Existing')
        self.make_user(username='creator', admin=True)
        self.login('creator')

        response = self.post_json(self.collection_url, {'name': 'Existing'})

        self.assertEqual(response.status_code, 400)

    def test_get_by_id_enriches_leagues_with_name_and_type(self):
        comp = Competition.objects.create(name='Comp A')
        CompetitionLeague.objects.create(competition=comp, league='Line', rule='2026')

        response = self.client.get(self.item_url(comp.id))

        body = response.json()
        self.assertEqual(body['logo'], '/images/noLogo.png')  # detail-endpoint fallback
        league = next(l for l in body['leagues'] if l['league'] == 'Line')
        self.assertEqual(league['name'], 'Rescue Line')
        self.assertEqual(league['type'], 'line')

    def test_update_requires_competition_admin_access_and_replaces_leagues(self):
        comp = Competition.objects.create(name='Comp A')
        CompetitionLeague.objects.create(competition=comp, league='Line', rule='2025')
        outsider = self.make_user(username='outsider')
        self.login('outsider')

        denied = self.put_json(self.item_url(comp.id), {'name': 'Renamed'})
        self.assertEqual(denied.status_code, 401)

        self.client.get('/api/auth/logout')
        admin_user = self.make_user(username='comp-admin')
        UserCompetitionAccess.objects.create(user=admin_user, competition=comp, access_level=ACCESS_LEVELS['ADMIN'], role=[])
        self.login('comp-admin')

        response = self.put_json(self.item_url(comp.id), {
            'name': 'Renamed',
            'color': '#123456',
            'leagues': [{'league': 'Maze', 'num': 30, 'mode': 'SUM_OF_BEST_N_GAMES', 'disclose': True, 'rule': '2026'}],
        })

        self.assertEqual(response.status_code, 200)
        comp.refresh_from_db()
        self.assertEqual(comp.name, 'Renamed')
        self.assertEqual(comp.color, '#123456')
        self.assertEqual(comp.leagues.count(), 1)
        self.assertEqual(comp.leagues.get().league, 'Maze')

    def test_delete_requires_competition_admin_access_and_cascades(self):
        comp = Competition.objects.create(name='Comp A')
        round_obj = Round.objects.create(name='Round 1', competition=comp)
        admin_user = self.make_user(username='comp-admin')
        UserCompetitionAccess.objects.create(user=admin_user, competition=comp, access_level=ACCESS_LEVELS['ADMIN'], role=[])
        outsider = self.make_user(username='outsider')

        self.login('outsider')
        denied = self.client.delete(self.item_url(comp.id))
        self.assertEqual(denied.status_code, 401)

        self.client.get('/api/auth/logout')
        self.login('comp-admin')
        response = self.client.delete(self.item_url(comp.id))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Competition.objects.filter(pk=comp.id).exists())
        # Real FK CASCADE removes the Round without any app-level hook.
        self.assertFalse(Round.objects.filter(pk=round_obj.id).exists())
