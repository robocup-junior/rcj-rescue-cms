import json
import re

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from compat_auth.auth import require_super

from .models import ShortUrl

OBJECT_ID_RE = re.compile(r'^[0-9a-fA-F]{24}$')


def _is_object_id(value):
    return bool(value) and bool(OBJECT_ID_RE.match(value))


def _parse_json_body(request):
    try:
        return json.loads(request.body or b'{}')
    except (ValueError, UnicodeDecodeError):
        return {}


@csrf_exempt
def collection(request):
    if request.method == 'POST':
        return create(request)
    return list_all(request)


@require_super
@require_http_methods(['GET'])
def list_all(request):
    qs = ShortUrl.objects.all().order_by('id')
    return JsonResponse([obj.legacy_dict() for obj in qs], safe=False)


@require_super
@require_http_methods(['POST'])
def create(request):
    body = _parse_json_body(request)
    name = body.get('name')
    shorted = body.get('shorted')
    transfer = body.get('transfer')

    if not name or not shorted or not transfer:
        # Express's Mongoose "required" validation error path.
        return JsonResponse({'msg': 'Could not register url shortening :('}, status=400)

    # Express: findOne({name}) then update-in-place if found, else create.
    # Note this deliberately does NOT replicate an Express bug: on a save
    # error there, the code sends a 400 and then unconditionally falls
    # through to also send a 200 on the same response, which throws
    # ERR_HTTP_HEADERS_SENT in Node. Here we just return the 400 and stop.
    existing = ShortUrl.objects.filter(name=name).first()
    if existing is not None:
        existing.shorted = shorted
        existing.transfer = transfer
        try:
            existing.full_clean()
            existing.save()
        except (ValidationError, IntegrityError):
            return JsonResponse({'msg': 'Could not register url shortening :('}, status=400)
        return JsonResponse({'msg': 'Setting has been registered!'})

    new_url = ShortUrl(name=name, shorted=shorted, transfer=transfer)
    try:
        new_url.full_clean(exclude=['id'])
        new_url.save()
    except (ValidationError, IntegrityError):
        # Express's pre-save hook: duplicate `shorted` slug on a new doc.
        return JsonResponse({'msg': 'Could not register url shortening :('}, status=400)
    return JsonResponse({'msg': 'Setting has been registered!'})


@csrf_exempt
@require_super
@require_http_methods(['DELETE'])
def destroy(request, object_id):
    if not _is_object_id(object_id):
        return HttpResponse(status=404)
    ShortUrl.objects.filter(pk=object_id).delete()
    return JsonResponse({'msg': 'Setting has been removed!'})
