import json
import re

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from compat_auth.auth import get_current_user

from .models import Field, Round

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

        obj = model(name=name, competition_id=competition_id)
        try:
            obj.full_clean(exclude=['id'])
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
