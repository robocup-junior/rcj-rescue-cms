from django.urls import path

from . import views

# Mirrors routes/api/rounds.js and routes/api/fields.js exactly, including
# the lack of a trailing slash (the Angular frontend calls e.g.
# "/api/rounds" and "/api/rounds/" + id with no trailing slash -- these
# patterns are mounted with an empty '' collection entry against a
# no-trailing-slash prefix in cms_migration/urls.py, so no APPEND_SLASH
# redirect ever kicks in and breaks a POST/DELETE).
#
# NOT ported (out of scope for this slice): GET /:id/runs on either
# resource -- those query the Run collection, which still lives entirely
# in MongoDB and hasn't been migrated yet. Left running on Express.
rounds_urlpatterns = [
    path('', views.round_collection, name='round-collection'),
    path('/<str:object_id>', views.round_item, name='round-item'),
]

fields_urlpatterns = [
    path('', views.field_collection, name='field-collection'),
    path('/<str:object_id>', views.field_item, name='field-item'),
]

# Mirrors routes/api/competitions.js's competition CRUD plus the
# round/field sub-routes nested under it. Ordering matters: literal paths
# ('', '/leagues', '/leagues/<id>') must come before the generic
# '/<str:competition_id>' detail pattern, or the latter would shadow them.
competitions_urlpatterns = [
    path('', views.competition_list_or_create, name='competition-collection'),
    path('/leagues', views.league_reference_list, name='competition-leagues'),
    path('/leagues/<str:league_id>', views.league_reference_detail, name='competition-league-detail'),
    path('/<str:competition_id>/rounds', views.rounds_by_competition, name='competition-rounds'),
    path('/<str:competition_id>/rounds/<str:name>', views.rounds_by_competition_and_name, name='competition-round-by-name'),
    path('/<str:competition_id>/fields', views.fields_by_competition, name='competition-fields'),
    path('/<str:competition_id>/fields/<str:name>', views.fields_by_competition_and_name, name='competition-field-by-name'),
    path('/<str:competition_id>', views.competition_item, name='competition-item'),
]
