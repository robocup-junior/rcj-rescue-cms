from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .auth import SESSION_USER_ID, get_current_user
from .models import CmsUser

_current_user = get_current_user


@csrf_exempt
@api_view(['POST'])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if password is None or not password.isascii():
        return Response({'msg': 'Invalid characters'}, status=400)

    try:
        user = CmsUser.objects.get(username=username)
    except CmsUser.DoesNotExist:
        return Response({'msg': 'Login failed'}, status=400)

    if not user.compare_password(password):
        return Response({'msg': 'Login failed'}, status=400)

    request.session[SESSION_USER_ID] = user.pk
    request.session.modified = True
    return Response({'msg': 'Login successful'})


@api_view(['GET'])
def logout_view(request):
    request.session.flush()
    return Response({'msg': 'Logout successful', 'status': True})


@api_view(['GET'])
def me_view(request):
    user = _current_user(request)
    if user is None:
        return Response({'msg': 'You need to be logged in to do this'}, status=400)
    return Response(user.legacy_public_dict())
