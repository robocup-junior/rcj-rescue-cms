from django.urls import path

from . import views

# Mirrors routes/api/users.js, mounted at /api/users with
# [ensureLoginApi, private, admin, ensureSuperApi, super] (app.js). Net
# effect per route:
#   GET  /                        -> login only (not actually admin-gated
#                                     despite living in "adminRouter" --
#                                     replicated as-is, not fixed)
#   PUT  /:id/:competitionid/role  -> login + inline per-competition ADMIN check
#   PUT  /:id/:competitionid/:lvl  -> login + inline per-competition ADMIN check
#   POST /me/password              -> login only
#   POST /, PUT /:id, DELETE /:id  -> login + superDuperAdmin
urlpatterns = [
    path('', views.collection, name='users-collection'),
    path('/me/password', views.change_own_password, name='users-change-own-password'),
    path('/<str:userid>/<str:competitionid>/role', views.update_role, name='users-update-role'),
    path('/<str:userid>/<str:competitionid>/<str:alevel>', views.update_access_level, name='users-update-access-level'),
    path('/<str:object_id>', views.user_item, name='users-item'),
]
