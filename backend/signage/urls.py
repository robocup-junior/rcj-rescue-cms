from django.urls import path

from . import views

# Mirrors routes/api/signage.js. Express relies on router registration
# order to make sure e.g. GET /contentList/img is tried before the generic
# GET /:id/:cont falls through to it (ObjectId.isValid('contentList') is
# false, so it `next()`s past the private router's catch-all into the
# admin router). Django has no such fallthrough, so the equivalent here is
# just: list literal paths before the <str:object_id> patterns.
urlpatterns = [
    path('', views.collection, name='signage-collection'),
    path('/', views.collection, name='signage-collection-slash'),  # both forms are used by the frontend
    path('/contentList/img', views.content_list_images, name='signage-content-images'),
    path('/contentList/mov', views.content_list_movies, name='signage-content-movies'),
    path('/contentList/upload', views.content_upload, name='signage-content-upload'),
    path('/contentList/<str:file_name>', views.content_delete, name='signage-content-delete'),
    path('/contentList', views.content_list, name='signage-content-list'),
    path('/<str:object_id>/refresh', views.refresh_signage, name='signage-refresh'),
    path('/<str:object_id>/<str:field>', views.get_signage_field, name='signage-field'),
    path('/<str:object_id>', views.item, name='signage-item'),
]
