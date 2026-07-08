import functools

from django.http import HttpResponse

from .models import CmsUser

SESSION_USER_ID = 'cms_user_id'


def get_current_user(request):
    user_id = request.session.get(SESSION_USER_ID)
    if not user_id:
        return None
    try:
        return CmsUser.objects.prefetch_related('competition_accesses').get(pk=user_id)
    except CmsUser.DoesNotExist:
        request.session.pop(SESSION_USER_ID, None)
        return None


def require_login(view_func):
    """Mirrors Express's pass.ensureLoginApi: plain-text 400 body, not JSON."""
    @functools.wraps(view_func)
    def wrapped(request, *args, **kwargs):
        user = get_current_user(request)
        if user is None:
            return HttpResponse('You need to be logged in to do this', status=400)
        request.cms_user = user
        return view_func(request, *args, **kwargs)
    return wrapped


def require_admin(view_func):
    """Mirrors Express's pass.ensureAdminApi: global admin flag, plain-text 400 body."""
    @functools.wraps(view_func)
    def wrapped(request, *args, **kwargs):
        user = get_current_user(request)
        if user is None or not user.admin:
            return HttpResponse('You need to be admin to do this', status=400)
        request.cms_user = user
        return view_func(request, *args, **kwargs)
    return wrapped


def require_super(view_func):
    """Mirrors Express's pass.ensureSuperApi: superDuperAdmin flag, plain-text 400 body."""
    @functools.wraps(view_func)
    def wrapped(request, *args, **kwargs):
        user = get_current_user(request)
        if user is None or not user.super_duper_admin:
            return HttpResponse("You need to be 'superDuperAdmin' to do this", status=400)
        request.cms_user = user
        return view_func(request, *args, **kwargs)
    return wrapped


def has_competition_access(user, competition_id, level):
    """Mirrors helper/authLevels.js authCompetition: superDuperAdmin bypasses
    everything, otherwise the user needs a per-competition access grant at
    or above `level` for this specific competition_id."""
    if user is None:
        return False
    if user.super_duper_admin:
        return True
    return any(
        access.competition_id == competition_id and access.access_level >= level
        for access in user.competition_accesses.all()
    )
