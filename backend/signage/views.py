import json
import mimetypes
import os
import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import Http404, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from compat_auth.auth import require_admin, require_login

from .models import CONTENT_ITEM_REQUIRED, Signage, normalize_content_item

OBJECT_ID_RE = re.compile(r'^[0-9a-fA-F]{24}$')
IMAGE_EXT_RE = re.compile(r'.*\.(jpg|jpeg|png|gif)$', re.IGNORECASE)
MOVIE_EXT_RE = re.compile(r'.*\.(mov|mp4|wmv|webm)$', re.IGNORECASE)


def _is_object_id(value):
    return bool(value) and bool(OBJECT_ID_RE.match(value))


def _parse_json_body(request):
    try:
        return json.loads(request.body or b'{}')
    except (ValueError, UnicodeDecodeError):
        return {}


def _validate_and_normalize_content(content):
    normalized = []
    for item in content or []:
        for field in CONTENT_ITEM_REQUIRED:
            if not item.get(field):
                raise ValueError(f'content.{field} is required')
        normalized.append(normalize_content_item(item))
    return normalized


# -- /api/signage (list) / /api/signage/ ----------------------------------

@require_login
@require_http_methods(['GET'])
def list_signage(request):
    rows = Signage.objects.all().order_by('id')
    return JsonResponse([row.legacy_dict() for row in rows], safe=False)


@csrf_exempt
@require_admin
@require_http_methods(['POST'])
def create_signage(request):
    body = _parse_json_body(request)
    name = body.get('name')
    if not name:
        return JsonResponse({'msg': 'Error saving signage setting in db', 'err': 'name is required'}, status=400)

    try:
        content = _validate_and_normalize_content(body.get('content'))
    except ValueError as exc:
        return JsonResponse({'msg': 'Error saving signage setting in db', 'err': str(exc)}, status=400)

    row = Signage(name=name, content=content, news=body.get('news') or [])
    try:
        row.full_clean(exclude=['id', 'content', 'news'])
        row.save()
    except (ValidationError, IntegrityError):
        return JsonResponse(
            {'msg': 'Error saving signage setting in db', 'err': f'Signage setting with name "{name}" already exists!'},
            status=400,
        )

    # Express's own response here uses `err` as the success-message key too
    # (routes/api/signage.js:241 -- likely a copy-paste artifact of another
    # endpoint), replicated exactly for contract fidelity.
    return JsonResponse({'err': 'New run has been saved', 'id': row.id}, status=201)


# -- /api/signage/contentList* (media file management, admin) -------------

@require_admin
@require_http_methods(['GET'])
def content_list(request):
    directory = settings.SIGNAGE_CONTENT_DIR
    try:
        entries = os.listdir(directory)
    except OSError:
        return JsonResponse({'msg': 'Could not get file list'}, status=500)

    data = []
    for name in entries:
        full_path = os.path.join(directory, name)
        if os.path.isdir(full_path):
            continue
        mime_type, _ = mimetypes.guess_type(name)
        if mime_type == 'text/html':
            continue
        data.append({
            'name': name,
            'path': f'/signage_content/{name}',
            'type': mime_type,
        })
    return JsonResponse(data, safe=False)


def _filtered_file_list(pattern):
    directory = settings.SIGNAGE_CONTENT_DIR
    entries = os.listdir(directory)
    return [
        name for name in entries
        if os.path.isfile(os.path.join(directory, name)) and pattern.match(name)
    ]


@require_admin
@require_http_methods(['GET'])
def content_list_images(request):
    return JsonResponse(_filtered_file_list(IMAGE_EXT_RE), safe=False)


@require_admin
@require_http_methods(['GET'])
def content_list_movies(request):
    return JsonResponse(_filtered_file_list(MOVIE_EXT_RE), safe=False)


@csrf_exempt
@require_admin
@require_http_methods(['POST'])
def content_upload(request):
    directory = settings.SIGNAGE_CONTENT_DIR
    os.makedirs(directory, exist_ok=True)

    uploaded = request.FILES.get('file')
    if uploaded is None:
        return JsonResponse({'msg': 'No file provided'}, status=400)

    destination = os.path.join(directory, uploaded.name)
    with open(destination, 'wb') as fh:
        for chunk in uploaded.chunks():
            fh.write(chunk)

    return JsonResponse({'msg': 'File is uploaded', 'fileName': uploaded.name})


@csrf_exempt
@require_admin
@require_http_methods(['DELETE'])
def content_delete(request, file_name):
    path = os.path.join(settings.SIGNAGE_CONTENT_DIR, file_name)
    try:
        os.unlink(path)
    except OSError as exc:
        return JsonResponse({'msg': 'Could not delete file', 'err': str(exc)}, status=500)
    return JsonResponse({'msg': 'File is deleted', 'fileName': file_name})


# -- /api/signage/<id>... (private: login only) ---------------------------

@require_login
@require_http_methods(['GET'])
def get_signage(request, object_id):
    if not _is_object_id(object_id):
        raise Http404
    row = Signage.objects.filter(pk=object_id).first()
    if row is None:
        return HttpResponse(status=200)
    return JsonResponse(row.legacy_dict())


@require_login
@require_http_methods(['GET'])
def refresh_signage(request, object_id):
    if not _is_object_id(object_id):
        raise Http404
    # Express only emits if a Socket.IO server got wired up via
    # connectSocketIo(); Django has no realtime layer set up yet (ASGI app
    # is the bare default, no Channels/consumer wired) so this always takes
    # the same "socket server is down" branch Express takes when unwired.
    return JsonResponse({'msg': 'Socket server is now down'}, status=400)


@require_login
@require_http_methods(['GET'])
def get_signage_field(request, object_id, field):
    if not _is_object_id(object_id):
        raise Http404
    row = Signage.objects.filter(pk=object_id).first()
    if row is None:
        return HttpResponse(status=200)

    data = {'_id': row.id}
    if field == 'content':
        expanded = []
        for content_item in row.content:
            for _ in range(content_item.get('repeat') or 1):
                expanded.append(content_item)
        data['content'] = expanded
    elif field == 'news':
        data['news'] = row.news
    elif field == 'name':
        data['name'] = row.name
    # Unknown field name: Mongoose's .select(field) on a nonexistent path
    # just silently omits it, leaving only _id -- matched here by falling
    # through with `data` containing only `_id`.

    return JsonResponse(data)


@csrf_exempt
@require_admin
@require_http_methods(['PUT'])
def update_signage(request, object_id):
    if not _is_object_id(object_id):
        raise Http404
    row = Signage.objects.filter(pk=object_id).first()
    if row is None:
        return JsonResponse({'msg': 'Could not get signage', 'err': 'not found'}, status=400)

    body = _parse_json_body(request)
    try:
        content = _validate_and_normalize_content(body.get('content'))
    except ValueError as exc:
        return JsonResponse({'msg': 'Could not save change', 'err': str(exc)}, status=400)

    row.name = body.get('name')
    row.content = content
    row.news = body.get('news') or []
    try:
        row.full_clean(exclude=['id', 'content', 'news'])
        row.save()
    except (ValidationError, IntegrityError) as exc:
        return JsonResponse({'msg': 'Could not save change', 'err': str(exc)}, status=400)

    return JsonResponse({'msg': 'Saved change'})


@csrf_exempt
@require_admin
@require_http_methods(['DELETE'])
def delete_signage(request, object_id):
    if not _is_object_id(object_id):
        raise Http404
    Signage.objects.filter(pk=object_id).delete()
    return JsonResponse({'msg': 'Signage setting has been removed!'})


# -- method-dispatch wrappers for shared paths -----------------------------

@csrf_exempt
def collection(request):
    if request.method == 'POST':
        return create_signage(request)
    return list_signage(request)


@csrf_exempt
def item(request, object_id):
    if request.method == 'PUT':
        return update_signage(request, object_id)
    if request.method == 'DELETE':
        return delete_signage(request, object_id)
    return get_signage(request, object_id)
