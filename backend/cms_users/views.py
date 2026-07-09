import json
import logging
import re

from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from compat_auth.auth import require_login, require_super, has_competition_access
from compat_auth.models import ACCESS_LEVELS, CmsUser, UserCompetitionAccess
from competitions.models import Competition

logger = logging.getLogger(__name__)


def _parse_json_body(request):
    try:
        return json.loads(request.body or b'{}')
    except (ValueError, UnicodeDecodeError):
        return {}


def _competition_access_dict(user):
    return [access.legacy_dict() for access in user.competition_accesses.all()]


def _send_welcome_email(username, password, email):
    # Express sends "Welcome to RCJ CMS" via helper/mailSender.sendMail using
    # a mail-merge HTML template (templates/mail/_Welcome to RCJ CMS...html).
    # Django has no template engine or SMTP configured yet (settings.py:
    # TEMPLATES = []) -- that's a separate infrastructure slice, not part of
    # this endpoint's request/response contract. Logging instead of sending
    # for now so this is visible rather than silently swallowed.
    logger.info('TODO: send welcome email to %s <%s> (not yet wired up in Django)', username, email)


@csrf_exempt
def collection(request):
    if request.method == 'POST':
        return create_or_update_user(request)
    return list_users(request)


@csrf_exempt
def user_item(request, object_id):
    if request.method == 'DELETE':
        return delete_user(request, object_id)
    return update_user(request, object_id)


@require_login
@require_http_methods(['GET'])
def list_users(request):
    # Express: adminRouter.get('/') -- despite the router's name, the only
    # gate actually applied ahead of it is ensureLoginApi (see app.js
    # mounting order), not an admin-flag check. Replicated as-is.
    users = CmsUser.objects.all().order_by('username')
    data = [
        {
            '_id': user.legacy_id or str(user.pk),
            'username': user.username,
            'email': user.email,
            'admin': user.admin,
            'superDuperAdmin': user.super_duper_admin,
            'competitions': _competition_access_dict(user),
        }
        for user in users
    ]
    return JsonResponse(data, safe=False)


@csrf_exempt
@require_super
@require_http_methods(['DELETE'])
def delete_user(request, object_id):
    user = CmsUser.objects.find_by_legacy_or_pk(object_id)
    if user is not None:
        user.delete()
    return JsonResponse({'msg': 'User has been removed!'})


@csrf_exempt
@require_super
@require_http_methods(['POST'])
def create_or_update_user(request):
    body = _parse_json_body(request)
    username = body.get('username')
    password = body.get('password')
    email = body.get('email', '')
    admin = bool(body.get('admin'))
    super_duper_admin = bool(body.get('superDuperAdmin'))

    existing = CmsUser.objects.filter(username=username).first()
    if existing is not None:
        if password:
            existing.set_password(password)
        existing.admin = admin
        existing.super_duper_admin = super_duper_admin
        existing.email = email
        try:
            with transaction.atomic():
                existing.save()
        except Exception as exc:  # noqa: BLE001 - mirror Express's generic save-error shape
            logger.error(exc)
            return JsonResponse({'msg': 'Could not regist user :('}, status=400)
    else:
        # Express only seeds `competitions` from the request body on brand
        # new users, never on update. Unlike Express/Mongoose (refs aren't
        # enforced FKs there), a bogus competition id here would otherwise
        # raise an uncaught IntegrityError -- check existence up front and
        # report it like the rest of the request, rather than 500.
        competition_entries = [e for e in (body.get('competitions') or []) if e.get('id')]
        unknown_ids = [
            e['id'] for e in competition_entries
            if not Competition.objects.filter(pk=e['id']).exists()
        ]
        if unknown_ids:
            return JsonResponse({'msg': 'Could not regist user :(', 'err': f'competition not found: {unknown_ids[0]}'}, status=400)

        new_user = CmsUser(username=username, admin=admin, super_duper_admin=super_duper_admin, email=email)
        new_user.set_password(password or '')
        try:
            with transaction.atomic():
                new_user.save()
                for entry in competition_entries:
                    UserCompetitionAccess.objects.create(
                        user=new_user,
                        competition_id=entry['id'],
                        access_level=entry.get('accessLevel', ACCESS_LEVELS['NONE']),
                        role=entry.get('role') or [],
                    )
        except Exception as exc:  # noqa: BLE001
            logger.error(exc)
            return JsonResponse({'msg': 'Could not regist user :('}, status=400)

    if body.get('emailNotification') and email:
        _send_welcome_email(username, password, email)

    return JsonResponse({'msg': 'User has been registerd!'})


@csrf_exempt
@require_login
@require_http_methods(['PUT'])
def update_role(request, userid, competitionid):
    if not has_competition_access(request.cms_user, competitionid, ACCESS_LEVELS['ADMIN']):
        return JsonResponse({'msg': 'You have no authority to access this api'}, status=401)

    user = CmsUser.objects.find_by_legacy_or_pk(userid)
    if user is None:
        return JsonResponse({'msg': 'Could not get user', 'err': 'not found'}, status=400)
    if not Competition.objects.filter(pk=competitionid).exists():
        return JsonResponse({'msg': 'Could not save changes', 'err': 'competition not found'}, status=400)

    body = _parse_json_body(request)
    # Express: `Array.from(new Set(req.body))` -- req.body is the raw JSON
    # array itself here, not a wrapper object. De-dupe, preserve order.
    role = list(dict.fromkeys(body)) if isinstance(body, list) else []

    with transaction.atomic():
        access, _created = UserCompetitionAccess.objects.get_or_create(
            user=user, competition_id=competitionid, defaults={'access_level': ACCESS_LEVELS['NONE'], 'role': role},
        )
        if not _created:
            access.role = role
            access.save()

    return JsonResponse({'msg': 'Saved changes'})


@csrf_exempt
@require_login
@require_http_methods(['PUT'])
def update_access_level(request, userid, competitionid, alevel):
    if not has_competition_access(request.cms_user, competitionid, ACCESS_LEVELS['ADMIN']):
        return JsonResponse({'msg': 'You have no authority to access this api'}, status=401)

    user = CmsUser.objects.find_by_legacy_or_pk(userid)
    if user is None:
        return JsonResponse({'msg': 'Could not get user', 'err': 'not found'}, status=400)
    if not Competition.objects.filter(pk=competitionid).exists():
        return JsonResponse({'msg': 'Could not save changes', 'err': 'competition not found'}, status=400)

    try:
        access_level = int(alevel)
    except ValueError:
        return JsonResponse({'msg': 'Could not save changes', 'err': 'invalid access level'}, status=400)

    with transaction.atomic():
        access, _created = UserCompetitionAccess.objects.get_or_create(
            user=user, competition_id=competitionid, defaults={'access_level': access_level, 'role': []},
        )
        if not _created:
            access.access_level = access_level
            access.save()

    return JsonResponse({'msg': 'Saved changes'})


@csrf_exempt
@require_super
@require_http_methods(['PUT'])
def update_user(request, object_id):
    # Express's equivalent here is a generic recursive property-copy onto
    # the Mongoose document, excluding _id/username/superDuperAdmin/admin/
    # __v/password -- but still allowing e.g. `competitions` through
    # wholesale, which is why the original code has a
    # "// not good at security" comment on this route. Rather than port
    # that generic (and self-flagged-unsafe) copy mechanism onto a
    # completely different ORM shape, this only supports the one field
    # it's actually used for from the frontend: email.
    user = CmsUser.objects.find_by_legacy_or_pk(object_id)
    if user is None:
        return JsonResponse({'msg': 'Could not get user', 'err': 'not found'}, status=400)

    body = _parse_json_body(request)
    if 'email' in body:
        user.email = body['email'] or ''
    user.save()

    return JsonResponse({'msg': 'Saved user'})


@csrf_exempt
@require_login
@require_http_methods(['POST'])
def change_own_password(request):
    body = _parse_json_body(request)
    current = body.get('current')
    new_pass = body.get('new')
    confirm = body.get('confirm')

    if new_pass != confirm:
        return JsonResponse({'msg': 'Passwords do not match'}, status=400)

    types = sum([
        bool(re.search(r'[a-z]', new_pass or '')),
        bool(re.search(r'[A-Z]', new_pass or '')),
        bool(re.search(r'[0-9]', new_pass or '')),
        bool(re.search(r'[^A-Za-z0-9]', new_pass or '')),
    ])
    if not new_pass or len(new_pass) < 8 or types < 2:
        return JsonResponse({'msg': 'Password does not meet the requirements'}, status=400)

    user = request.cms_user
    if not user.compare_password(current or ''):
        return JsonResponse({'msg': 'Current password is incorrect'}, status=400)

    user.set_password(new_pass)
    user.save()
    return JsonResponse({'msg': 'Password updated successfully'})
