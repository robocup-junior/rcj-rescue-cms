# RCJ Rescue CMS: Django Migration Plan

Concrete companion to `SKILL.md` (which is the general Express-to-Django
*strategy*). This file is the specific plan for *this* codebase: the view
map, the proposed relational remodel, and the phase ordering. Update it as
phases complete or the plan changes -- it's meant to stay accurate, not be
a point-in-time snapshot.

## Status as of 2026-07-09

Done (see git log on `develop/2026` for the actual commits):
- `compat_auth`: login/logout/me
- `competitions`: Round, Field (+ nested listing under a competition)
- `shorturl`: URL-shortener admin API
- `cms_users`: user management, per-competition role/access-level grants
- `signage`: signage playlists + content-file manager
- `devdemo`: throwaway browser login page (not a migrated route)
- **`competitions`: Competition + CompetitionLeague (Phase 2, first half)** --
  list/leagues/get/create/update-settings/delete, matching the exact
  fallback-default quirks (list vs. detail use different placeholder
  logo/color defaults -- not a bug, replicated on purpose) and directory
  side effects (mkdir on create; on delete, documents/cabinet/survey are
  removed but backup/ deliberately survives, same as Express). Round,
  Field, and `UserCompetitionAccess.competition_id` were retrofitted from
  bare CharFields to real FKs now that Competition exists -- see "Lessons
  learned" below for a real bug this surfaced and fixed.
  NOT yet done (still Phase 2, second half): **Team**. Nothing that
  depends on Team (documents, cabinet, teams admin page, most of
  Phase 3+) can start until it lands.

Not wired into live traffic. No shared session store between Express and
Django yet -- see "Cutover infrastructure" below.

## Lessons learned (apply to every future phase)

- **`full_clean(exclude=[...])` skips uniqueness checks involving excluded
  fields.** Excluding a FK field from `full_clean()` (e.g. to skip
  re-validating something already checked manually) also silently skips
  any `UniqueConstraint` that FK participates in -- so a duplicate that
  should raise a clean `ValidationError` instead falls through to
  `.save()` and raises a DB-level `IntegrityError` there. Both are caught
  by the same `except (ValidationError, IntegrityError)` in these views,
  so the *response* is unaffected -- but see the next point for why the
  save call still needs to be wrapped regardless.
- **Wrap every `full_clean()`/`.save()` pair that anticipates an
  `IntegrityError` in `transaction.atomic()`.** Postgres aborts the whole
  transaction on an unhandled backend error; catching the Python exception
  doesn't undo that. Outside of Django's per-request transaction (not
  enabled here -- `ATOMIC_REQUESTS` is unset) this mostly self-heals
  between statements, but Django's `TestCase` wraps each test in one
  outer transaction, so a poisoned transaction breaks every subsequent
  query *in that same test* -- including unrelated assertions -- with
  `TransactionManagementError`. Applied across `competitions`, `shorturl`,
  `signage`, `cms_users` views.
- **Real FK constraints are DEFERRABLE INITIALLY DEFERRED by default in
  Django/Postgres**, checked at transaction commit, not at each `INSERT`.
  A test that creates a row with a bogus FK value via the raw ORM (not
  going through the view's own existence check) can pass even though the
  same operation would fail for real outside a test transaction -- don't
  read too much into that kind of test passing; use a real fixture row
  instead of trusting the deferral to catch it.
- **Mongoose refs are not enforced FKs; Django's now are.** Anywhere
  Express lets you save a document referencing a nonexistent id (Round →
  Competition, a user's `competitions[].id`, etc.), the Django port
  needs an explicit existence check *before* attempting the write, with
  its own distinct error message -- otherwise the generic duplicate/
  validation-error handler ends up reporting a misleading message, or an
  unhandled `IntegrityError` 500s the request. Check every new FK
  introduced in a phase for this, not just the "obvious" one.

## 1. View map (admin section)

Starting from the actual competition-creation entry point and following
every link reachable from it (verified against `views/admin/home.pug`,
`views/admin/competition.pug`, and `routes/admin.js` -- not guessed).

```
GET /admin                                    admin/home.pug
  |- "Add competition" -> POST /api/competitions -> redirect to /admin/:id
  |- top-level tools (not competition-scoped):
  |    /admin/line/tilesets      (line map tilesets)
  |    /signage/setting          (signage settings -- API migrated, page not)
  |    /admin/restore            (Mongo backup restore)
  |    /admin/mailTemplates (+ /editor[/:subject])
  |    /admin/queues             (Bull board -- job queue UI, external)
  |    /admin/mongo              (mongo-express -- external)
  |    /admin/short              (short URL admin -- API migrated [x])
  |    /admin/user               (user admin -- API migrated [x])
  |
  \- click a competition (requires authLevel >= 10) -> /admin/:id

GET /admin/:id                                admin/competition.pug (per-competition hub)
  |- /admin/:id/teams                         admin/team.pug
  |- /admin/:id/teams/bulk                    admin/team_bulk.pug
  |- /admin/:id/rounds                        admin/round.pug            [x migrated]
  |- /admin/:id/fields                        admin/field.pug            [x migrated]
  |- /admin/:id/:league/games                 admin/games.pug
  |    |- /admin/:id/:league/games/ranking    admin/rankingPrint/*
  |    |- /admin/:id/:league/games/print      admin/gamesPrint/*
  |    \- /admin/:id/:league/games/bulk       admin/games_bulk.pug
  |- /admin/:id/:league/maps                  admin/maps.pug
  |    \- /admin/:id/:league/mapEditor[/:mapId]   admin/mapEditor/*
  |- /admin/:id/settings                      admin/competition_settings.pug
  |                                             (authority table -> cms_users [x])
  |- /admin/:id/backup                        admin/competition_backup.pug
  |- /admin/:id/documents                     document/admin.pug
  |    |- /admin/:id/documents/teams          document/team_admin.pug
  |    |- /admin/:id/documents/reviewStatus   document/reviewStatus.pug
  |    \- /admin/:id/documents/:lid/{results,form,review,preview}
  |- /admin/:id/mails                         mail_home.pug
  |    \- /admin/:id/mails/sent               mail_sent.pug
  |- /admin/:id/registration                  registration/settings.pug
  |- /admin/:id/reservation                   reservation/list.pug
  |    |- /admin/:id/reservation/edit[/:resvId]   reservation/settings.pug
  |    \- /admin/:id/reservation/admin/:resvId    reservation/admin.pug
  |- /admin/:id/cabinet                       cabinet/admin.pug
  |    \- /admin/:id/cabinet/:leagueTeam      cabinet/file.pug
  |- /admin/:id/survey                        survey/list.pug
  |    |- /admin/:id/survey/edit[/:survId]    survey/edit.pug
  |    \- /admin/:id/survey/answers/:survId   survey/answers.pug
  \- /admin/:id/application                   application_admin.pug
```

Route source file per area (for when it's that area's turn):

| Area | Express route file(s) | Mongoose model(s) |
|---|---|---|
| Teams | `routes/api/teams.js` | Team |
| Rounds/Fields | `routes/api/rounds.js`, `fields.js` | Round, Field | [x]
| Games/Ranking | `routes/api/competitions.js` (leagues), `routes/api/ranking.js` | Competition.leagues, LineRun/MazeRun/SimRun |
| Maps | `routes/api/lineMaps.js`, `mazeMaps.js` | LineMap, TileSet, TileType, MazeMap |
| Map editor scoring | (same as Games, run-side) | LineRun, MazeRun |
| Settings | `routes/api/competitions.js` (competition CRUD), `users.js` | Competition, CmsUser | [partial]
| Backup | `routes/api/backup.js` | (filesystem + Bull queue, all collections) |
| Documents | `routes/api/document.js` (2008 lines, biggest file) | review, Competition.documents config, Team.document |
| Mail | `routes/api/mail.js` | mail, mailAuth |
| Registration | `routes/api/competitions.js` (registration sub-routes) | Competition.registration config |
| Reservation | `routes/api/reservation.js` | reservation |
| Cabinet | `routes/api/cabinet.js` | filesystem under `cabinet/:competition/:league` |
| Survey | `routes/api/survey.js` | survey, surveyAnswer |
| Application | (check `routes/api/competitions.js` application sub-routes) | Competition |
| Technical Challenge | `routes/api/technicalChallenge.js` | TechnicalChallenge |

## 2. Proposed relational remodel

Rule of thumb applied throughout: **promote a field to a real column (and
index it) when something filters, sorts, joins, or aggregates on it;
leave it as a `JSONField` when it's only ever read/written as one whole
blob** (this is exactly what was already done for `Signage.content` and
`UserCompetitionAccess.role` -- extending the same principle, not a new
one).

### Competition (new, foundational)

```
Competition
  id (24-hex, like Round/Field/Signage)
  name (unique)
  logo, bk_color, color, message, description
  preparation (bool)
  public_token

CompetitionLeague  (was Competition.leagues[] embedded array)
  competition FK -> Competition
  league (enum)
  num (int)
  mode (enum)
  disclose (bool)
  rule (string)
  unique(competition, league)
```

Why split `leagues[]` out: `games.js`/`ranking.js` look up a specific
`competition.leagues.find(l => l.league === X)` constantly -- that's a
`WHERE competition_id = ? AND league = ?` query begging to happen, not an
array scan. A real table with a unique constraint also makes "can't have
the same league twice" a DB guarantee instead of an app-level assumption.

`Competition.documents` (the deeply nested enable/deadline/leagues[]
languages/notifications/blocks[]/questions[]/options[] form-builder
config) stays a **JSONField** -- it's a per-league document form
definition, always read and saved as one whole tree from the form editor
UI (`document/form_editor.pug`), never queried into individual questions
from SQL. Same reasoning as `Signage.content`.

### Team (new, foundational -- almost everything else FKs to this)

```
Team
  id (24-hex)
  competition FK -> Competition
  name
  league (indexed -- filtered on constantly: rankings, judge queues, bulk ops)
  inspected, doc_public, country, checkin, team_code (real columns)
  email (JSONField list of strings -- edited as a whole list in the UI,
         see team.js:207-222's add/remove-email rows; not queried)
  members (JSONField list of {name, birthDay, agreement})
  document_deadline, document_enabled, document_public, document_token,
    document_penalty  (promoted to real columns, not nested JSON --
    these are exactly the fields the team_admin/reviewStatus tables
    filter and inline-edit per row; see the work already done on those
    two pages' UI)
  document_answers (JSONField dict, questionId -> answer string --
    dynamic keys, matches Competition.documents' blocks[].questions[].
    questionId; never joined against in SQL)
```

**Cascade deletes become real FKs.** Today `teamSchema.pre('deleteOne'/
'deleteMany')` manually deletes matching Review, LineRun, MazeRun, Mail,
SurveyAnswer, and TechnicalChallenge rows -- and only fires for the
Mongoose call patterns those hooks are attached to; a `deleteMany` run
through a different code path, or a raw driver call, silently skips it.
In Postgres this is just `on_delete=CASCADE` on each of those tables'
`team` FK -- enforced by the database itself regardless of which code
path deletes the team. Flagging this because it's a correctness
improvement, not a stylistic one; worth calling out explicitly when this
phase lands rather than letting it pass as an incidental side effect.

### Maps: LineMap, MazeMap, TileSet, TileType

Header fields (`competition`, `league`, `name`, `height`/`width`/`length`,
`duration`, etc.) as real columns; the `tiles`/`cells` grid itself as
`JSONField`. The map editor (`admin/mapEditor/*.pug`, `public/javascripts/
admin/mapEditor/*.js`) always loads/saves the entire grid at once -- there
is no "give me just tile (3,4)" query anywhere in the codebase. Exactly
the `Signage.content` pattern again.

### Runs: LineRun, MazeRun, SimRun, TechnicalChallenge

Split the same way: everything ranking/leaderboard logic filters, sorts,
or sums on becomes a real column --
`competition, round, field, team, map` (FKs), `group`,
`normalization_group`, `adjustment`, `score`, `raw_score`, `multiplier`,
`showed_up`, `status`, `started`, `time_minutes`/`time_seconds`,
`sign_captain`/`sign_referee`/`sign_referee_as`. The per-tile scoring
detail (`tiles[].scoredItems`, `LoPs`, `rescueOrder`, `cells[]`) stays
`JSONField` -- it's written one field-click at a time by the judge UI
(`doScoring`/`cellClick` -> `upload_run` -> whole-document `PUT`, see
`public/javascripts/judge/{line,maze}_2026.js`) and never queried into
individual cells from SQL.

### Document review

`review` (team/competition/reviewer FKs, `name`, `comments` Map) ports
almost directly: FKs become real FKs, `comments` (dynamic questionId ->
text) stays JSONField. Needs `Competition.documents` (Phase 1) and `Team`
(Phase 1) to exist first.

### Survey / Reservation

`i18n[]`/`languages[]`/`questions[]` (survey) and `i18n[]`/`languages[]`/
`slot[]` (reservation) are config trees edited as a whole in their
respective editor UIs -- JSONField, same reasoning as Competition.documents.

**But** `Survey.team[]` and `Reservation.team[]` (which teams this survey/
reservation targets) and `Reservation.slot[].booked[]` (which teams
booked which slot) are real many-to-many *membership* data -- "is team X
in this survey's target list" / "which teams booked slot Y" are
relational questions. Promote these to join tables:
`SurveyTeam(survey, team)`, `ReservationTeam(reservation, team)`,
`ReservationSlotBooking(slot, team)` -- with `slot` itself likely needing
to become its own table (`ReservationSlot(reservation FK, slot_id,
start, duration, max)`) rather than a JSON array, precisely because
`booked[]` needs a real FK target.

### Mail / mailAuth

Fairly relational already (`competition`/`team` FKs, scalar fields).
`events[]` (open/click tracking timeline) and `replacedURL[]` are
append-only logs, not queried individually -- JSONField is fine there.
Requires real SMTP + a template-rendering story in Django before this is
actually useful (flagged already in the `cms_users` commit for the
welcome email -- same gap applies here, bigger, since this whole
subsystem *is* mail sending/tracking).

## 3. Phase ordering

Each phase should land the same way the first five did: read the Express
route + model, write the Django model/view/tests, live-smoke-test against
a running server, commit with a description of what was and wasn't
ported and why.

1. ~~Auth, Round/Field, ShortURL, Users, Signage~~ -- done.
2. **Competition + CompetitionLeague + Team.** Blocking prerequisite for
   nearly everything else in this list. This is the next slice, and the
   one worth the most design scrutiny before starting (schema shape
   decisions here get inherited by every later phase).
3. Document review + document form config (`Competition.documents`,
   `Team.document_*`). Needs phase 2.
4. Maps: LineMap, MazeMap, TileSet, TileType. Only needs phase 2
   (Competition), can happen in parallel with phase 3.
5. Runs: LineRun, MazeRun, SimRun, TechnicalChallenge. Needs phases 2 and
   4 (Team, Round, Field, Map all required as FK targets).
6. Ranking. No own collection (computed from Competition.leagues +
   Team + Run at query time) -- porting `routes/api/ranking.js`'s
   aggregation logic is the actual work here. Needs phase 5.
7. Survey + Reservation (+ join tables) + Mail/mailAuth. Mail additionally
   needs real SMTP + template rendering wired into Django first.
8. Cabinet, Backup, TechnicalChallenge review UI, signage realtime
   refresh. Filesystem/job-queue/websocket heavy; lowest ROI to port
   early since they're thin wrappers around infra (Bull queue, Socket.IO)
   this Django project doesn't have yet.

### Cutover infrastructure (parallel track, not a "phase")

None of the above serves real users until this exists, and it's
independent of which model-migration phase is in progress:

- **Shared session store.** Express and Django currently have separate
  session stores (Express: whatever `config/pass.js` + connect uses;
  Django: its own `django_session` Postgres table). A user logged into
  one is not logged into the other. Needs a decision: shared session
  backend (e.g. both read/write the same Redis-backed session store), or
  a translation layer, before any real per-route cutover.
- **Reverse proxy / routing.** Something needs to route `/api/rounds`,
  `/api/fields`, etc. to Django (port 8000) while everything else still
  hits Express (port 3000) -- nginx, or Express itself proxying specific
  paths. Currently nothing does this; both apps run independently.
- **Mongo -> Postgres backfill.** Every phase above only creates *new*
  Postgres tables -- existing production data stays in MongoDB until a
  one-off migration script copies it over per collection (see the
  `find_by_legacy_or_pk` / 24-hex-id-generation conventions already
  established in `compat_auth`/`competitions` -- they exist specifically
  so IDs stay stable across a future backfill).
