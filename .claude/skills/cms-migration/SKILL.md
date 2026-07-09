# CMS Migration Skill: Express/Angular/Postgres to Django

## Where things stand and what's next

`MIGRATION_PLAN.md` (same directory) is the concrete, codebase-specific
companion to this file: the full admin-section view map, which Express
route file/Mongoose model backs each view, a proposed relational remodel
(what stays a real column/FK vs. what becomes a JSONField blob, and why),
and the phase ordering with what's already done. Read it before starting
the next slice -- it records *why* each modeling decision was made, not
just what to do next, and should be kept up to date as phases land.

## Core Migration Rule

For quick migration, keep the existing Angular frontend unchanged as much as possible and replace only the Express backend with a Django/Django REST Framework backend.

The Django backend must imitate the existing Express API contract first. Do not redesign the API during the initial migration unless explicitly requested.

## Primary Goal

Preserve frontend behavior by making Django compatible with the current Angular expectations.

That means preserving:

- Existing `/api/...` route paths
- HTTP methods
- Query parameters
- Request body structure
- Response JSON shape
- Field names, even if inconsistent or legacy
- Status codes where practically possible
- Authentication/session behavior
- Upload/download/export behavior
- Pagination/filtering/sorting behavior

Frontend changes should be limited to unavoidable infrastructure changes, such as API base URL, CSRF handling, or authentication header/session handling.

## Migration Strategy

### 1. Freeze the Existing API Contract

Before rewriting an endpoint, inspect the current Express implementation and document:

- Route path
- Method
- Middleware/auth requirements
- Request params
- Query params
- Request body
- Response format
- Error responses
- Side effects
- Database tables/models touched

The Angular frontend should be treated as the source of truth for what the API must return.

### 2. Recreate Express Routes in Django

Prefer route-compatible Django URLs, for example:

```python
path("api/maps/<str:league_type>/export", export_maps)
```

For legacy Express-style endpoints, simple DRF function views or APIView classes are acceptable and often preferred over ViewSets.

Use ViewSets only when they naturally match the existing API.

### 3. Preserve Legacy Shapes First

Do not rename fields, restructure objects, or normalize response shapes during the first migration pass.

Bad initial migration:

```json
{
  "competitionId": "...",
  "leagueId": "..."
}
```

if the frontend expects:

```json
{
  "competition": "...",
  "league": "..."
}
```

Compatibility comes before cleanliness.

### 4. Use Postgres via Django ORM

The database is Postgres, not MongoDB.

Use Django models and migrations when creating new schema.

If migrating onto an existing Postgres schema, consider starting with:

```python
class Meta:
    managed = False
    db_table = "existing_table_name"
```

This allows Django to read/write existing tables without immediately taking ownership of schema migrations.

After the system is stable, models and schema can be cleaned up in a second phase.

### 5. Keep Angular Mostly Untouched

Avoid rewriting Angular components during backend migration.

Allowed Angular changes during the quick migration:

- API base URL changes
- CSRF token handling
- Auth/session/header handling
- Small compatibility fixes only when unavoidable

Avoid Angular refactors, UI rewrites, or service redesigns during the backend migration phase.

### 6. Migrate Endpoint by Endpoint

Migrate one vertical slice at a time:

1. Pick one Express route/controller
2. Identify Angular calls using it
3. Implement equivalent Django endpoint
4. Compare old and new responses
5. Test the Angular screen against Django
6. Move to the next endpoint

Do not attempt a full backend rewrite before validating endpoint compatibility.

## Recommended Django Stack

Use:

- Django
- Django REST Framework
- PostgreSQL driver (`psycopg` or `psycopg2` depending on project standards)
- Django admin where useful
- Django auth/permissions if compatible with the existing system

Optional, depending on current CMS needs:

- `django-filter` for filtering
- `drf-spectacular` for OpenAPI documentation
- Celery/RQ for background jobs
- WhiteNoise or external web server/CDN for static Angular assets

## Express-to-Django Mapping

| Express / Node Concept | Django Equivalent |
|---|---|
| Express router | `urls.py` |
| Controller function | DRF view / APIView |
| Middleware | Django middleware / DRF permission/auth classes |
| `req.params` | URL path parameters |
| `req.query` | `request.GET` / `request.query_params` |
| `req.body` | `request.data` |
| `res.json(...)` | `Response(...)` |
| `res.status(...).json(...)` | `Response(..., status=...)` |
| Sequelize/Knex/raw SQL | Django ORM / raw SQL when needed |
| Passport/session auth | Django auth/session or custom DRF auth |

## Example Conversion

Existing Express style:

```javascript
router.get('/api/maps/:league/export', controller.exportMaps)
```

Django route:

```python
# urls.py
path("api/maps/<str:league_type>/export", export_maps),
```

Django view:

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["GET"])
def export_maps(request, league_type):
    competition_id = request.query_params.get("competition")
    league_id = request.query_params.get("league")
    ids = request.query_params.get("ids", "")
    selected_ids = [value for value in ids.split(",") if value]

    # TODO: Recreate old Express behavior exactly.
    # Query Postgres using Django ORM or raw SQL.
    # Return the same response/file format expected by Angular.

    return Response({
        "competition": competition_id,
        "league": league_id,
        "league_type": league_type,
        "ids": selected_ids,
    })
```

## Testing Requirements

For every migrated endpoint, compare old Express output with new Django output.

Check:

- Same status code
- Same content type
- Same JSON structure
- Same field names
- Same null/empty-list behavior
- Same ordering where relevant
- Same file download names and MIME types
- Same permission behavior

Where possible, create regression tests based on real Angular API calls.

## Important Migration Principle

Initial migration is not the time to make the system beautiful.

First target:

> Same frontend, same behavior, Django backend.

Second target:

> Cleaner Django models, better APIs, improved admin tools, and frontend refactoring.
