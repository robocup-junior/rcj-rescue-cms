from django.urls import path

from . import views

# Mirrors routes/api/shortURL.js, mounted (like Express) at /api/short, not
# /api/shortURL -- app.js: app.use('/api/short', [ensureSuperApi, ...]).
#
# NOT ported (out of scope, page-serving rather than JSON API): the public
# redirect route in routes/shortURL.js (GET /s/:name -> 302 or 404 page).
urlpatterns = [
    path('', views.collection, name='shorturl-collection'),
    path('/<str:object_id>', views.destroy, name='shorturl-item'),
]
