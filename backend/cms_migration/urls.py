from django.urls import include, path

urlpatterns = [
    path('api/auth/', include('compat_auth.urls')),
]
