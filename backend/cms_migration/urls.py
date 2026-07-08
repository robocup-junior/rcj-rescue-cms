from django.urls import include, path

from competitions.urls import competitions_urlpatterns, fields_urlpatterns, rounds_urlpatterns

urlpatterns = [
    path('api/auth/', include('compat_auth.urls')),
    path('api/rounds', include(rounds_urlpatterns)),
    path('api/fields', include(fields_urlpatterns)),
    path('api/competitions', include(competitions_urlpatterns)),
    path('api/short', include('shorturl.urls')),
]
