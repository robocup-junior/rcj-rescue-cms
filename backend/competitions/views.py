import json
import os
import re
import shutil

from django.conf import settings as django_settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import Http404, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from compat_auth.auth import competition_access_level, get_current_user, has_competition_access
from compat_auth.models import ACCESS_LEVELS, UserCompetitionAccess

from .models import Competition, CompetitionLeague, Field, Round

OBJECT_ID_RE = re.compile(r'^[0-9a-fA-F]{24}$')


def _is_object_id(value):
    return bool(value) and bool(OBJECT_ID_RE.match(value))


def _admin_gate(request):
    """Mirrors Express mounting order [public, ensureLoginApi, private,
    ensureAdminApi, admin]: not-logged-in and logged-in-not-admin get
    distinct plain-text 400 bodies. Returns a short-circuit response, or
    None if the request may proceed."""
    user = get_current_user(request)
    if user is None:
        return HttpResponse('You need to be logged in to do this', status=400)
    if not user.admin:
        return HttpResponse('You need to be admin to do this', status=400)
    return None


def _parse_json_body(request):
    try:
        return json.loads(request.body or b'{}')
    except (ValueError, UnicodeDecodeError):
        return {}


def _make_endpoints(model, label):
    """Round and Field are identical in shape and behavior in Express
    (rounds.js / fields.js are near-duplicates), so build both sets of
    views from one factory instead of copy-pasting."""

    @require_http_methods(['GET'])
    def list_all(request):
        # Express: query.doFindResultSortQuery with no find filter -> all rows.
        # find/result/sort query-string passthrough is NOT replicated here:
        # it's a raw Mongo-query passthrough with no real usage found in the
        # Angular frontend for rounds/fields, so it's left unported rather
        # than guessed at.
        qs = model.objects.all().order_by('id')
        return JsonResponse([obj.legacy_dict() for obj in qs], safe=False)

    @csrf_exempt
    @require_http_methods(['POST'])
    def create(request):
        gate = _admin_gate(request)
        if gate is not None:
            return gate

        body = _parse_json_body(request)
        name = body.get('name')
        competition_id = body.get('competition')

        if not name or not competition_id:
            # Express: Mongoose ValidationError -> 400 {msg, err}
            return JsonResponse({'msg': f'Error saving {label}', 'err': 'name and competition are required'}, status=400)

        # Express/Mongoose refs are NOT enforced foreign keys -- a Round can
        # currently be saved against a nonexistent competition ObjectId with
        # no error. Postgres's real FK constraint below is stricter than
        # that (deliberately -- referential integrity is a genuine
        # improvement here), so check existence explicitly first and report
        # it distinctly, rather than let full_clean's FK validation error
        # get caught by the duplicate-name handler below and show a
        # misleading "already exists" message.
        if not Competition.objects.filter(pk=competition_id).exists():
            return JsonResponse({'msg': f'Error saving {label}', 'err': 'competition not found'}, status=400)

        obj = model(name=name, competition_id=competition_id)
        try:
            # atomic(): a duplicate-name IntegrityError from the DB (not
            # just full_clean's own pre-check) would otherwise leave the
            # connection's transaction poisoned for every query after it in
            # the same request/test -- see MIGRATION_PLAN.md's note on this.
            with transaction.atomic():
                obj.full_clean(exclude=['id', 'competition'])
                obj.save()
        except (ValidationError, IntegrityError):
            # Express's pre-save hook rejects on duplicate {competition, name}.
            return JsonResponse(
                {'msg': f'Error saving {label}', 'err': f'{label.capitalize()} with name "{name}" already exists!'},
                status=400,
            )
        except Exception as exc:  # noqa: BLE001 - mirror Express's catch-all save error shape
            return JsonResponse({'msg': f'Error saving {label}', 'err': str(exc)}, status=400)

        response = JsonResponse({'msg': f'New {label} has been saved', 'id': obj.id}, status=201)
        response['Location'] = f'/api/{label}s/{obj.id}'
        return response

    @require_http_methods(['GET'])
    def retrieve(request, object_id):
        if not _is_object_id(object_id):
            return HttpResponse(status=404)
        obj = model.objects.filter(pk=object_id).first()
        if obj is None:
            # Express's doIdQuery does res.send(data) with data=null -> empty 200 body.
            return HttpResponse(status=200)
        return JsonResponse(obj.legacy_dict())

    @csrf_exempt
    @require_http_methods(['DELETE'])
    def destroy(request, object_id):
        gate = _admin_gate(request)
        if gate is not None:
            return gate

        if not _is_object_id(object_id):
            return HttpResponse(status=404)
        model.objects.filter(pk=object_id).delete()
        # Express's deleteOne succeeds (no error) even if nothing matched.
        return JsonResponse({'msg': f'{label.capitalize()} has been removed!'})

    @require_http_methods(['GET'])
    def by_competition(request, competition_id):
        if not _is_object_id(competition_id):
            return HttpResponse(status=404)
        qs = model.objects.filter(competition_id=competition_id).order_by('id')
        return JsonResponse([obj.legacy_dict() for obj in qs], safe=False)

    @require_http_methods(['GET'])
    def by_competition_and_name(request, competition_id, name):
        if not _is_object_id(competition_id):
            return HttpResponse(status=404)
        qs = model.objects.filter(competition_id=competition_id, name=name)
        return JsonResponse([{'_id': obj.id} for obj in qs], safe=False)

    return list_all, create, retrieve, destroy, by_competition, by_competition_and_name


(
    round_list, round_create, round_detail, round_delete,
    rounds_by_competition, rounds_by_competition_and_name,
) = _make_endpoints(Round, 'round')

(
    field_list, field_create, field_detail, field_delete,
    fields_by_competition, fields_by_competition_and_name,
) = _make_endpoints(Field, 'field')


@csrf_exempt
def round_collection(request):
    if request.method == 'POST':
        return round_create(request)
    return round_list(request)


@csrf_exempt
def round_item(request, object_id):
    if request.method == 'DELETE':
        return round_delete(request, object_id)
    return round_detail(request, object_id)


@csrf_exempt
def field_collection(request):
    if request.method == 'POST':
        return field_create(request)
    return field_list(request)


@csrf_exempt
def field_item(request, object_id):
    if request.method == 'DELETE':
        return field_delete(request, object_id)
    return field_detail(request, object_id)


# -- Competition CRUD (routes/api/competitions.js) --------------------------
#
# Ported here: list, leagues + leagues/:id (static reference data), get by
# id, create, update (settings only), delete.
#
# NOT ported (separate, larger phases -- see MIGRATION_PLAN.md):
#   - /:id/documents/:leagueId[/review]   (document form config, Phase 3)
#   - /:id/teams/documents, /:id/teams, /:id/teams/:teamid,
#     /:id/:league/teams                  (Team domain)
#   - /:id/registration                   (registration config)
#   - /:id/adminTeams                     (Team domain)
#   - /:id/line/runs, /:id/maze/runs, /:id/:league/maps
#                                          (Map/Run domains, Phase 4/5)
#   - the `data.documents` branch of PUT /:id (document form config)

@csrf_exempt
def competition_list_or_create(request):
    if request.method == 'POST':
        return competition_create(request)
    return competition_list(request)


@csrf_exempt
def competition_item(request, competition_id):
    if request.method == 'PUT':
        return competition_update(request, competition_id)
    if request.method == 'DELETE':
        return competition_delete(request, competition_id)
    return competition_detail(request, competition_id)


@require_http_methods(['GET'])
def competition_list(request):
    user = get_current_user(request)
    data = []
    for row in Competition.objects.all().order_by('name'):
        entry = row.legacy_list_dict()
        entry['authLevel'] = competition_access_level(user, row.id)
        data.append(entry)
    return JsonResponse(data, safe=False)


@require_http_methods(['GET'])
def league_reference_list(request):
    return JsonResponse(django_settings.LEAGUES_JSON, safe=False)


@require_http_methods(['GET'])
def league_reference_detail(request, league_id):
    if league_id not in django_settings.LEAGUE_IDS:
        raise Http404
    entry = next(l for l in django_settings.LEAGUES_JSON if l['id'] == league_id)
    return JsonResponse({'id': entry['id'], 'type': entry['type'], 'name': entry['name']})


@require_http_methods(['GET'])
def competition_detail(request, competition_id):
    if not _is_object_id(competition_id):
        raise Http404
    row = Competition.objects.filter(pk=competition_id).first()
    if row is None:
        return JsonResponse({'msg': 'Could not get competition'}, status=400)
    return JsonResponse(row.legacy_dict())


@csrf_exempt
@require_http_methods(['POST'])
def competition_create(request):
    gate = _admin_gate(request)
    if gate is not None:
        return gate

    body = _parse_json_body(request)
    name = body.get('name')
    if not name:
        return JsonResponse({'msg': 'Error saving competition', 'err': 'name is required'}, status=400)

    row = Competition(name=name)
    try:
        with transaction.atomic():
            row.full_clean(exclude=['id', 'public_token'])
            row.save()
    except (ValidationError, IntegrityError) as exc:
        return JsonResponse({'msg': 'Error saving competition', 'err': str(exc)}, status=400)

    for league_entry in django_settings.LEAGUES_JSON:
        CompetitionLeague.objects.create(
            competition=row,
            league=league_entry['id'],
            rule=league_entry['rules'][-1],
        )

    # Directory side effects, mirroring the Express endpoint exactly (see
    # the comment on SIGNAGE_CONTENT_DIR for why this is REPO_ROOT-relative,
    # not backend/-relative): these dirs are prep for later phases
    # (documents, survey, cabinet, backup, mail attachments) -- harmless to
    # create now even though nothing reads from them yet on the Django side.
    for rel_path in (
        f'documents/{row.id}',
        f'survey/{row.id}',
        f'backup/{row.id}',
        f'mailAttachment/{row.id}',
    ):
        os.makedirs(os.path.join(django_settings.REPO_ROOT, rel_path), exist_ok=True)
    for league_entry in django_settings.LEAGUES_JSON:
        os.makedirs(
            os.path.join(django_settings.REPO_ROOT, 'cabinet', row.id, league_entry['id']),
            exist_ok=True,
        )

    user = get_current_user(request)
    if user is not None:
        UserCompetitionAccess.objects.create(
            user=user, competition=row, access_level=ACCESS_LEVELS['ADMIN'], role=[],
        )

    response = JsonResponse({'msg': 'New competition has been saved', 'id': row.id}, status=201)
    return response


@csrf_exempt
@require_http_methods(['PUT'])
def competition_update(request, competition_id):
    if not _is_object_id(competition_id):
        raise Http404
    user = get_current_user(request)
    if not has_competition_access(user, competition_id, ACCESS_LEVELS['ADMIN']):
        return JsonResponse({'msg': 'You have no authority to access this api'}, status=401)

    row = Competition.objects.filter(pk=competition_id).first()
    if row is None:
        return JsonResponse({'msg': 'Could not get competition', 'err': 'not found'}, status=400)

    body = _parse_json_body(request)
    for field, attr in (
        ('name', 'name'), ('logo', 'logo'), ('bkColor', 'bk_color'), ('color', 'color'),
        ('message', 'message'), ('description', 'description'), ('preparation', 'preparation'),
    ):
        if body.get(field) is not None:
            setattr(row, attr, body[field])

    # NOT ported here: the `data.documents` branch (document form config
    # upsert-by-league) -- that's Phase 3 (document form editor) scope.

    try:
        with transaction.atomic():
            if body.get('leagues') is not None:
                row.leagues.all().delete()
                default_mode = CompetitionLeague._meta.get_field('mode').default
                for entry in body['leagues']:
                    CompetitionLeague.objects.create(
                        competition=row,
                        league=entry.get('league'),
                        num=entry.get('num', 20),
                        mode=entry.get('mode', default_mode),
                        disclose=bool(entry.get('disclose')),
                        rule=entry.get('rule', ''),
                    )
            row.full_clean(exclude=['id', 'public_token'])
            row.save()
    except (ValidationError, IntegrityError) as exc:
        return JsonResponse({'msg': 'Could not save changes', 'err': str(exc)}, status=400)

    return JsonResponse({'msg': 'Settings has been saved'})


@csrf_exempt
@require_http_methods(['DELETE'])
def competition_delete(request, competition_id):
    if not _is_object_id(competition_id):
        raise Http404
    user = get_current_user(request)
    if not has_competition_access(user, competition_id, ACCESS_LEVELS['ADMIN']):
        return JsonResponse({'msg': 'You have no authority to access this api'}, status=401)

    Competition.objects.filter(pk=competition_id).delete()
    response = JsonResponse({'msg': 'Competition has been removed!'})

    # Express removes documents/, cabinet/, survey/ recursively but
    # deliberately leaves backup/ alone (its own delete call is commented
    # out in routes/api/competitions.js) so backups survive a competition
    # being deleted. Same here.
    for rel_path in (f'documents/{competition_id}', f'cabinet/{competition_id}', f'survey/{competition_id}'):
        shutil.rmtree(os.path.join(django_settings.REPO_ROOT, rel_path), ignore_errors=True)

    return response
