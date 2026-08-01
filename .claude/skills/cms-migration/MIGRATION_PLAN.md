# RCJ Rescue CMS -> rcj-scoreboard Migration Plan

Concrete companion to `SKILL.md`. This file is the current target plan for
moving Rescue CMS functionality into the existing `rcj-scoreboard/` Django
application.

## Target and status as of 2026-07-09

### Repositories

- **Target application:** `rcj-scoreboard/`
  - Django 6, Python 3.14, `uv`.
  - Existing apps: `core`, `soccer`, `public`.
  - Existing shared kernel: `core.User`, `Region`, `Tournament`,
    `TournamentMembership`, `League`, `Stage`, `Team`, `Venue`, `StageEntry`,
    `StageRound`.
  - Existing route shape: `/t/<slug>/...` for tournament-scoped HTML and
    `/api/v1/<app>/...` for versioned JSON APIs.
- **Source CMS (authoritative, live):** `rcj-rescue-cms-1/` (repo root, NOT
  `backend/`) -- Express/Mongoose/MongoDB app, actively maintained with the
  *current* competition ruleset (as of 2026-07-11: Rescue Maze uses
  PHI/PSI/OMEGA letter victims plus 5-ring "Cognitive" targets --
  `models/mazeMap.js`, `mapEditor/maze_2026.js`, `maze_editor_modal_2026.html`
  -- not the older H/S/U/Red/Yellow/Green scheme).
  - Route inventory starts at `app.js`.
  - Runtime inventory starts at `server.js`.
  - Domain inventory starts at `models/competition.js`, `models/user.js`,
    maps/runs models, and `routes/api/*`.
  - Rule-year files use a `<type>_<year>[E].{pug,js}` naming convention
    (`maze_2026.js`, `line_2026.js`, `..._2026E.js` for Entry-league
    variants); always check for the **highest year present** before using an
    older one as ground truth.
- **`rcj-rescue-cms-migration/` is a STALE, frozen snapshot** (last touched
  2025-07-19, predates the 2026 ruleset). Do not use it as the source of
  truth for anything rule-dependent (victim types, scoring, map schemas) --
  it will silently produce a pre-2026 port. It is still fine as a secondary
  cross-reference for route/queue/realtime plumbing that hasn't changed.
- **Prior standalone Django migration reference:** `rcj-rescue-cms-1/backend/`
  - Earlier work produced standalone Django apps such as `compat_auth`,
    `competitions`, `cms_users`, `shorturl`, `signage`, and `devdemo`.
  - That work is not wired into `rcj-scoreboard`.
  - Treat it as reference behavior/schema/tests only. Nothing is "done" for the
    target until implemented and tested inside `rcj-scoreboard`.

### Target status (updated 2026-08-01, end of session)

Integrated into `rcj-scoreboard/rescue/` (+ `core/mail_*`, `core/shorturl.py`)
and tested (still uncommitted in the scoreboard working tree as of this
writing):

- **Technical Challenge scoring (2026-08-01, closes a Phase 3 gap):**
  `rescue/technical_challenge.py` adds `RescueTechnicalChallengeScore`
  (stage-scoped, one row per team in a dedicated `technical_challenge`
  Stage -- the CMS source has no stage concept at all and keys its
  `TechnicalChallenge` collection off (competition, team) directly;
  this port anchors the score-entry screen to a Stage so it reuses the
  existing Stages-list/permission plumbing instead of inventing a new
  league-singleton config surface) plus `compute_technical_challenge_score`/
  `compute_technical_challenge_scores`, faithfully porting
  `getTechnicalChallengeScore` (`routes/api/ranking.js:833-858`)
  including its "every raw score in the league is zero -> normalize
  everyone to 1" quirk-to-keep. New `RescueTechnicalChallengeScoreView`
  (Editor-gated, `rescue:stage_technical_challenge`) renders one editable
  score field per team in a single-POST bulk-save table -- deliberately
  not the source's per-row AJAX PUT, matching this port's synchronous-
  form convention elsewhere. `RescueRankingConfig.Mode.
  GAMES_DOCUMENT_CHALLENGE` is now offered (was explicitly blocked
  before this session to avoid silently ranking on a fabricated zero
  component); `rescue/ranking.py`'s `compute_ranking` blends
  `0.6 * normalized game mean + 0.2 * document score + 0.2 * technical
  challenge score`, mirroring the source's `GAMES_DOCUMENT_CHALLENGE`
  formula exactly (`routes/api/ranking.js:213-214`). 16 new tests
  (`rescue/tests/test_technical_challenge.py`: model validation,
  normalization including the all-zero and missing-row edge cases, view
  permission/persistence; `rescue/tests/test_ranking.py`: one blend-math
  test) bring the full project suite to 2960 passing, same 2 pre-existing
  unrelated `soccer/` failures. Verified live in a real browser against
  the running dev server: created a Technical challenge stage from the
  existing "New Rescue stage" form, entered scores for two teams through
  the new table, set a Line stage's ranking mode to
  `GAMES_DOCUMENT_CHALLENGE`, and confirmed the rendered standings score
  matched the hand-computed blend exactly (0.64 / 0.50 for a 100/50
  game split against a 20/100 technical-challenge split, zero document
  component). Out of scope, unchanged from before: the CMS import
  command still lists `technicalchallenges` as an unsupported collection
  (`rescue/management/commands/import_cms.py`) -- wiring that up needs a
  decision on which Stage an imported score attaches to and was left
  alone rather than guessed.

- **Phase 1 (app shell):** `rescue` app wired into `INSTALLED_APPS`, URLs,
  `core.context_processors`, sidebar, `pyproject.toml` testpaths.
- **Phase 3a (admin console), all sub-phases 3a-1..3a-6:** tournament/league/
  stage landing pages; tournament-scoped Round/Field CRUD; stage-scoped Maps
  list; Map Editor for **Line** (full MVP+advanced: grid, palette, undo/redo,
  floors, save/duplicate, JSON export/import, PNG, max-score estimate,
  cross-tournament **Save As**, multi-page **PDF** scoresheet export) and for
  **Maze** (full cell/wall/victim editor on the *current* 2026 ruleset:
  PHI/PSI/OMEGA letter victims, 5-ring Cognitive targets with a ring-color
  picker and live status, Entry-league gating, checkpoint/black/blue/red/
  speedbump/ramp/steps, elevators, reachability highlighting, same Save
  As/PDF); Bulk Registration schedule generator (CSV import + both
  Scrambled/Fixed-Map generator modes, preview/commit); Run overview
  (filter/browse/inline adjustment edit/status/bulk delete, **Judge**
  button alongside Edit for Line/Maze/Simulation stages).
- **Phase 3 (ranking, 4 of 4 modes):** `rescue/ranking.py` computes
  `SUM_OF_BEST_N_GAMES`, `MEAN_OF_NORMALIZED_BEST_N_GAMES`,
  `MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT` (0.8 * normalized
  game mean + 0.2 * document review score), and `GAMES_DOCUMENT_CHALLENGE`
  (0.6 * normalized game mean + 0.2 * document review score + 0.2 *
  Technical Challenge score, closed 2026-08-01) standings (adjustment-on-
  read, per-normalization-group max normalization, best-N with score/time
  tiebreak), gated by a per-stage `RescueRankingConfig` (mode/best-N/
  disclose), rendered at `rescue:stage_ranking`.
- **Judge scoring engine (tile-by-tile), Line + Maze + Simulation:**
  `rescue/judging.py` faithfully ports the source's pure scoring formulas
  (`calculateLineScore`/`calculateMazeScore` from
  `helper/scoreCalculatorRules/2026.js`, plus Simulation's simpler
  clamp-only rules -- Simulation has no event-driven formula in the source
  at all, confirmed by reading both `simulation_2026.js` and
  `routes/api/simRuns.js`). `rescue/judging_line.py` /`judging_maze.py`/
  `judging_simulation.py` are alternative, richer entry points next to the
  existing plain manual score form (which stays, for corrections) --
  the judge records raw scoring events (tile-by-tile for Line/Maze,
  stopwatch+score for Simulation), the server recomputes score/raw_score
  from that raw log (persisted on `RescueRun.judge_log` for
  audit/re-scoring) via the ported formula. Deliberately out of scope for
  v1 (documented in each view's module docstring, not silently dropped):
  audio feedback, cookie-persisted rotation preference, multi-run batch
  queue, cross-device realtime sync, the pre-start checklist gate.
- **Phase 4/5 (self-service operations), Cabinet/Documents/Survey/Mail/
  Reservation/Document Review:** built on a shared `RescueTeamProfile`
  (one-to-one with `Team`, cryptographically-random `access_token`,
  lazily created on first host "copy link" or first team visit) gating a
  bearer-token team portal at `rescue:team_portal_home`
  (`/t/<slug>/rescue/team/<team_id>/<token>/`) -- mirrors the source CMS's
  `Team.document.token` pattern (confirmed the CMS itself reuses this
  *same* token for Reservation booking too, not a separate one per
  feature, validating this design) but scoped to one shared per-team
  token across every feature instead of one token per feature.
  - **Cabinet:** host-side league/team folder browse+upload+delete
    (`rescue/cabinet.py`, `CabinetFile` model) plus a read-only merged
    (league + own-team) view/download in the team portal.
  - **Document submission:** per-league `RescueDocumentConfig` (JSON block/
    question schema: input/select/scale/picture/movie/pdf/zip/
    explanationOnly, HTML5 client validation + server-side re-validation),
    per-team `RescueTeamDocument` answers + `RescueDocumentFile` uploads,
    host per-team enable/deadline/penalty override table, team-facing
    editable/read-only submission form gated on enabled+deadline.
  - **Document review:** `RescueDocumentReviewer` (rescue-local per-league
    grant table, mirrors `core.RegionAdmin`'s shape -- deliberately not
    folded into the shared `TournamentMembership.Role` enum, which is
    HOST/EDITOR only and shared with soccer) + `RescueDocumentReview`
    (one row per reviewer per submission, draft vs submitted). Host
    grant/revoke UI, reviewer queue + per-team scoring form (`scale`
    questions only, matching the source). `compute_document_score`
    faithfully ports `getDocumentScore` (`routes/api/ranking.js:687-831`):
    Olympic-trimmed mean (drop min+max) at/above `MINIMUM_REVIEWER=5`
    reviewers, plain average below it, summed per block, penalty-adjusted,
    normalized against the league's per-block maximum, weighted. A
    reviewer with *only* a `RescueDocumentReviewer` grant (no
    `TournamentMembership`) can now reach a private tournament's review
    pages -- fixed a real gap where the base permission mixin's tournament-
    visibility gate ran before the reviewer-grant check, 404-ing an
    otherwise-authorized external reviewer.
  - **Survey:** `Survey`/`SurveyAnswer`/`SurveyFileAnswer`, host
    list/builder (JSON questions) + answers browser, team-facing form
    targeted by league/team (empty = tournament-wide), open/closed/
    not-yet-open/answered state on the portal card.
  - **Reservation:** `RescueReservation`/`RescueReservationSlot`/
    `RescueReservationBooking` (ports `models/reservation.js`) -- host
    creates a named slot-booking event targeted at leagues and/or specific
    teams (empty targets = invisible to everyone, matching the source's
    literal query semantics -- no "empty means all" fallback, unlike
    Survey), adds time slots with a capacity, teams self-book/cancel one
    slot per reservation from their portal before the deadline. Booking
    uses `transaction.atomic()` + `select_for_update()` for real
    overbooking-proof concurrency (an improvement over the source's
    read-then-save Mongoose pattern, which is not truly atomic).
  - **Mail:** `core.MailTemplate`/`OutboundEmail` (deliberately placed in
    `core`, not `rescue` -- reusable by other apps), host compose (from
    scratch or from a system/custom template, `${team_name}` etc.
    substitution, per-team recipient picker skipping teams with no mentor
    email) + sent log + detail, synchronous send via
    `EmailMultiAlternatives` mirroring `core/auth_views.py`'s pattern,
    click-tracking link rewriting and an open-tracking pixel updating
    `OutboundEmail.status`/`events` (queued -> sent -> opened/clicked).
  - Every page above is reachable through the UI, not just by URL --
    fixed two real navigation gaps found this session: (1) the Rescue
    landing page's "Common" card row only linked Teams/Rounds/Fields/
    Cabinet, leaving Document submission/Surveys (only reachable via the
    per-league page, itself unlinked from anywhere) and Mail (unlinked
    anywhere at all) orphaned -- fixed by linking the league hero title
    into the per-league page and adding a permission-gated Mail sidebar
    row; (2) Reservations and Document Reviewers/Review-queue had the
    identical problem, fixed the same way (a Reservations card on the
    landing page, Reviewers/Review queue buttons on the document config
    page). (2) revealed (1) needed a session-spanning check, not a
    one-off fix -- every new feature going forward should get its own
    nav-reachability check as part of "done," not just a working URL.
  - **Real bug found and fixed by browser-testing rather than trusting
    green tests:** the `leagues`/`teams` `ModelMultipleChoiceField` ->
    `CheckboxSelectMultiple` widget swap in both `RescueSurveyBuilderForm`
    and `RescueReservationBuilderForm` reassigned `.widget` *after* the
    `.queryset` setter had already propagated choices onto the *old*
    widget instance -- silently discarding them. Rendered a completely
    empty, un-clickable checkbox list with no error anywhere; every
    existing test POSTed a known pk directly and never inspected the
    GET-rendered HTML, so this shipped undetected through a full green
    test suite in an earlier session. Fixed in both forms (swap widget
    in before assigning queryset) plus a new regression test in each
    survey/reservation test file asserting real `<input>` elements
    render for each league/team choice.
  - Verified end-to-end in a real browser against the running dev
    container + Postgres + Maildev: host creates a reservation, targets a
    league, adds a slot; a cookie-cleared (truly anonymous) tab using
    only the team's portal token books the slot (DB-verified), submits a
    document, and a granted reviewer scores it (`compute_document_score`
    verified live to reflect the new score); Save As duplicates a real
    map's tile definition into another stage; PDF export downloads a
    real multi-page `%PDF-` file; a Line run is judged through the tile
    UI and the computed score persists correctly; a superuser creates a
    short link and `/s/<code>/` redirects (302, curl-verified) with no
    auth required.
  - **Rich text answers/mail HTML:** the Document Submission "input"
    question type and Mail compose/template `html_body` fields were raw
    plain textareas -- no bold/italic/links, and free-text answers from
    competitors (an untrusted, competitor-controlled input) were stored
    and later re-rendered verbatim, a stored-XSS hole. **First pass was
    a hand-rolled vanilla-JS `contenteditable` widget -- wrong call,
    corrected same session.** The source CMS's own Document/Mail/
    Survey/Reservation Quill instances (`rcj-rescue-cms-1/public/
    javascripts/document/form.js`'s `NG_QUILL_CONFIG`) are a genuinely
    full-featured editor (headers, lists, sub/superscript, indent,
    direction, size, color/background, font, align, code-block,
    blockquote, inline image upload) -- ported properly instead:
    vendored Quill 2.0.3 (`static/js/quill.min.js` +
    `static/css/quill.snow.min.css`, ~210KB/25KB, same flat-file
    vendoring convention as the existing `jsqr.min.js`; no build step,
    no npm) with the *exact* same toolbar array as the source, driving
    it from `static/js/rich_text_editor.js`. One source feature
    deliberately not replicated: Mail/Survey/Reservation's Quill
    instances in the source had an image *toolbar button* with no real
    upload handler wired -- clicking it fell through to inlining an
    unbounded base64 data URI. Not parity-worthy (bloats a JSONField/
    outbound email with megabytes of base64); this port's toolbar omits
    the image button entirely wherever `data-image-upload-url` isn't
    set, i.e. everywhere except Document Submission answers, which is
    the *only* source Quill instance (`document/form.js` +
    `document/review.js`) that had a real upload endpoint
    (`/api/document/files/usercontent/:teamId/:token`) -- ported as
    `RescueDocumentAnswerImageUploadView` (new
    `RescueDocumentAnswerImage` model, same team-portal-token gate +
    host override as `RescueDocumentFormView`, 5MB image-only upload
    validated by `RescueDocumentAnswerImageUploadForm`), plus a custom
    Quill `CustomImage` blot (real ES6 `class extends`, matching the
    source's own registration in `rcj-rescue-cms-1/views/document/
    form.pug` -- an ES5 pseudo-inheritance first attempt threw
    "[Parchment] Unable to create image blot" against Quill 2.x's ES6
    class-based `ImageFormat` and had to be rewritten) persisting
    width/height for future resize-handle support (the third-party
    `quill-image-resize-module` drag-handle UI itself was NOT vendored
    -- Quill 1.x-era, unclear 2.x compatibility, and a real but
    non-essential UX nicety relative to everything else in this port).

    Sanitizer (`core/richtext.py`, `bleach` + `bleach.css_sanitizer.
    CSSSanitizer`/`tinycss2`) is not guessed: the allowlist (tags,
    `ql-*` classes by exact value, `data-list` values, `color`/
    `background-color` style values) was built from *actually driving a
    real Quill 2.0.3 instance in a browser* and capturing
    `quill.root.innerHTML` for every toolbar format, then verified
    round-trip-lossless by reloading the sanitized output back into a
    fresh Quill instance (byte-identical modulo Quill's own auto-
    regenerated internal bookkeeping attributes -- `contenteditable`,
    `spellcheck`, `data-language` -- which Quill re-derives from
    surviving semantic markup on every load regardless). Two allowlist
    tiers (`sanitize_answer_html` for competitor Document Submission
    answers, includes `img`; `sanitize_host_html` for host-authored
    Mail, no `img`), both force every surviving `<a>` to
    `rel="noopener noreferrer nofollow" target="_blank"` and strip non-
    `http`/`https`/`mailto` hrefs. `bleach`'s `CSSSanitizer` allowlists
    CSS *property names* but not value shapes -- a real gap found
    during testing (`color: expression(alert(1))`, the old-IE CSS-
    expression vector, survived property-name filtering alone); closed
    with a second, value-level regex pass restricting `color`/
    `background-color` to a bare `rgb()`/hex color, run after
    `bleach.clean`. Sanitization runs server-side on save/send in both
    directions (`RescueDocumentFormView._validate_answers`,
    `MailComposeView.post`, `MailTemplateForm.clean_html_body`) --
    never trust the client editor's toolbar as the security boundary.
    `max_length` on document answers measures stripped visible text,
    not raw markup, so formatting tags don't eat into a competitor's
    character budget. List/indent/size/font/align formats are **CSS-
    class-driven, not semantic markup** in Quill's live DOM (e.g. a
    bullet list is `<ol><li data-list="bullet">`, styled by `quill.
    snow.css`'s `.ql-editor`-scoped rules) -- any read-only render of a
    sanitized answer MUST wrap it in a `.ql-editor`-classed container
    with that stylesheet loaded, or these formats silently lose their
    visual appearance (`templates/rescue/document_portal.html`'s
    read-only branch does this; fixed in the same pass). Mail HTML is
    sent to real inboxes, which don't load `quill.snow.css` -- list/
    indent/size/font/align formatting may not render in all email
    clients (bold/italic/underline/strike/headers/blockquote/links are
    plain semantic tags and render everywhere); a known, accepted,
    documented limitation, not a bug -- WYSIWYG-to-email-safe-HTML
    normally needs a separate CSS-inlining pass, out of scope here.

    Verified end-to-end in the browser against the running dev
    container for both surfaces: full-toolbar formatting (headings,
    bold/italic/underline, colored text, bullet lists) round-trips
    through save/send and displays correctly for hosts/teams and in a
    sent email; a real image upload (native file-picker flow, Puppeteer
    `waitForFileChooser`) persists and renders inline; injected
    `<script>`/`onerror`/`javascript:`/CSS-`expression()` payloads are
    all neutralized with zero JS-console errors and no dialog/alert
    firing (confirmed via direct DB inspection that stored HTML is
    sanitized, not merely display-escaped). Also fixed two pre-
    existing, unrelated `ModelMultipleChoiceField` widget/queryset-
    ordering bugs discovered along the way (Survey and Reservation
    builder forms silently rendered empty league/team checkbox lists --
    `.widget` must be replaced *before* `.queryset` is assigned, not
    after) with new regression tests. New runtime deps: `bleach`,
    `tinycss2` (added to `pyproject.toml`/`uv.lock` -- **the dev
    container's baked venv needed an image rebuild**, `docker compose
    build web`, to pick these up; bind-mounted code/static changes do
    not require this, only new Python dependencies do).
  - 320 tests (29 new: 20 sanitizer unit tests in `core/tests/
    test_richtext.py` covering the full tag/class/data-list/style
    allowlist by value plus every XSS vector above, 9 for
    `RescueDocumentAnswerImageUploadView` in `rescue/tests/
    test_documents.py`) from the earlier Cabinet/Documents/Survey/Mail
    session + prior sessions' Reservation/Document-Review/Judge-
    Scoring/Map-Editor-Polish/ShortURL/Phase-2-Import/Rich-Text work
    bring the full `rescue/`+`core/` suite to 2856 passing (project-
    wide), zero regressions to the 2 pre-existing unrelated `soccer/`
    failures.
  - **Document admin hub (follow-up navigation fix):** Document
    submission was still only reachable by first drilling into a
    specific league's page (`rescue:league`) and clicking a small
    button -- unlike Rounds/Fields/Cabinet/Reservations, which all have
    a card on the tournament-wide Rescue landing page. Root cause:
    `RescueDocumentConfig` is genuinely per-league (`League` `OneToOne`,
    unlike Survey/Reservation's tournament-wide M2M targeting), so there
    was no single tournament-wide destination for a landing-page card to
    point at. Fixed with a proper hub, matching the source CMS's own
    `/admin/:id/documents` screen (`rcj-rescue-cms-1/views/document/
    admin.pug`, which lists every league with Question/Review/Result
    tiles): new `RescueDocumentAdminHubView` (tournament-scoped,
    `rescue:document_admin`, `templates/rescue/document_admin.html`)
    lists every Rescue league with its config/enabled status, submitted-
    vs-total team counts, reviewer count, and reviewed-vs-total counts,
    each row linking straight into that league's Config/Team-access/
    Reviewers/Review-queue screens (all four already existed and worked
    -- only the entry point was missing). Added as a "Documents" card on
    the Rescue landing page's Common row, verified live in the browser
    against real seeded data (2 leagues, correct submitted/reviewed
    counts, all 8 action links resolving to the right per-league URLs).
  - **Rich text editor sizing**: default editable height raised
    (`min-height` 8rem -> 14rem) and a native CSS `resize: vertical`
    handle added to the editing surface (`overflow-y: auto` was already
    required for Quill's own scrolling and is also what CSS `resize`
    needs to be enabled) -- competitors/hosts can now drag the box
    taller for long answers/emails instead of scrolling a cramped fixed-
    height box. Scoped to `.rich-text-wrapper .ql-editor` only, so the
    read-only answer-display `.ql-editor` (no drag handle needed for
    static content) is unaffected.
  - **CORRECTION (this session): the block-level reviewer assignment
    above was built on the wrong premise and is being replaced, not
    patched.** User feedback: "reviewers are not assigned to document
    blocks itself, but i basically need the full review configuration
    ... Look at the old review configuration. I should be able to
    define blocks which can be assigned and each block has rubrics
    defined in a small text block and vote can be done from 1-6 for
    each question/rubric." Re-read the actual source CMS (not memory)
    to ground the fix -- see "Corrected review design" immediately
    below for the real schema. The bullet above (kept for the record,
    not deleted) is superseded: `RescueDocumentBlockReviewer` and every
    view/template built on top of it are being removed wholesale in
    favor of the design below. The two real bugs it *did* fix --
    Submission/Review needing independent config screens, and the
    adoption-fallback/soft-degrade pattern instead of a hard 403 for an
    unassigned reviewer -- are both preserved in the new design, just
    rebuilt on the correct data model.

  - ### Corrected review design, ground-truthed against the source CMS

    **Source schema (`rcj-rescue-cms-migration/models/competition.js`,
    `competitionSchema.documents.leagues[]`)**: review configuration is
    a genuinely INDEPENDENT sibling array, `leagues[].review` (lines
    148-186), sitting next to -- never reusing -- the submission form's
    own `leagues[].blocks` (lines 119-146). A review block has: `i18n[]
    .title` (no per-block rubric/description field), `color`, `weight`
    (Number 0-1, default 0 -- `weight == 0` skips the block from
    scoring entirely, `ranking.js:720`), `linkedQuestionBlock` ([Object
    Id] -- cross-references specific *submission* block(s) so the
    reviewer UI can show relevant answers alongside the rubric; purely
    contextual, not identity), `assignedReviewers` ([{reviewerId,
    teamIds}] -- see below), and `questions[]`. A review QUESTION has
    its own `i18n[].question/description/example` (the `description`
    field, rendered through a rich-text editor in the source, IS the
    per-question rubric text the user means by "rubrics defined in a
    small text block" -- there is no block-level rubric field, it's
    per-question), `type` (enum incl. `scale`/`run`/others), `required`,
    `fileName`, and `scale: {least, most}` -- a CONFIGURABLE numeric
    range (source default 1-5, not a hardcoded "1-6"; the port should
    default new questions to 1-6 per the user's stated expectation but
    keep it host-editable per question, matching source shape exactly).
    `runReview: {round, map, movie}` exists only for `type: 'run'`
    questions (reviewing a recorded competition run/video) -- **out of
    scope for this pass**, along with every non-`scale` question type
    (`input`/`select`/`pdf`/`picture`/`movie`/`zip`/`run`): the user's
    ask is explicitly scale-only ("vote can be done from 1-6 for each
    question/rubric"), and only `scale` questions ever fed scoring in
    the source anyway (`ranking.js` never reads other types) -- a
    documented, intentional v1 scope cut, not a silent gap.

    **Reviewer assignment (`assignedReviewers`)** is BLOCK **and**
    TEAM scoped, not block-only: an empty `assignedReviewers` array on
    a block means "open to every authorized reviewer, every team" (the
    adoption-fallback default this port already got right); a non-
    empty entry `{reviewerId, teamIds: []}` means that reviewer covers
    every team; `{reviewerId, teamIds: [t1, t2]}` restricts them to
    just those teams. The source UI (`review_editor.pug:148-176`) is an
    inline table INSIDE each block's editor card -- one row per
    (reviewer, team-subset), `<select>` for the reviewer + a multi-
    select for teams, add/remove rows with buttons -- not a separate
    screen, not a CSV import (confirmed by an exhaustive repo-wide grep
    for `csv`/`papaparse`/`FileReader`: **no CSV-based reviewer/team
    bulk-assignment feature exists anywhere in the source CMS**; the
    only concession to bulk entry is a clipboard-paste-team-codes
    helper on the team multi-select, `teamCodePaste`,
    `review_editor.js:341-352` -- UI paste, not a file importer). CSV
    import for review assignment (user ask 3.2) is therefore a
    deliberate NEW capability this port is adding, not a port of an
    existing one -- built on `core/csv_import.py`'s dataclass
    preview-then-commit pattern (`ParsedImport`/`ParsedRow`,
    session-stash, row-level errors, `transaction.atomic()` commit),
    the more mature of this app's two existing hand-rolled CSV
    importers (the other, `rescue/views.py`'s schedule-CSV tab, skips
    bad rows silently at commit instead of an all-or-nothing rollback
    -- the team-importer's stricter behavior is the one to copy for
    something as consequential as reviewer assignment).

    **Review status + reminder email (user ask 3.3) is a REAL, existing
    source feature, not a gap to invent from scratch**: `GET /api/
    document/admin/:competitionId/reviewStatus` (`document.js:1888-
    1996`) renders one row per INTERVIEW-role reviewer with one badge
    per assigned team (green=complete, red=0%, orange=partial,
    `reviewStatus.js:56-67`), and a `?sendReminder=true` query flag
    (wired to a "Send a reminder" button, `reviewStatus.pug:103-106`)
    emails every reviewer with at least one incomplete item (`document.
    js:1958`: `answeredQuestionsNum != assienedQuestionsNum` for any
    assignment -- reviewers who are fully done are explicitly skipped,
    matching the user's "leave out completed reviews" instruction
    exactly) using the CMS's normal mail-merge pipeline. The port reuses
    `core.mail_models.OutboundEmail`/`send_outbound_email()` exactly as
    `MailComposeView` already does (one `OutboundEmail` row per
    recipient, fully synchronous send loop, bucketed `messages.*`
    feedback via the same pattern as `_report_compose_result`) --
    `OutboundEmail.team` is already nullable, so a reviewer-reminder
    send needs no schema change there.

    **Reviewer roster + referee coupling (user asks 1-3.1)**: this
    app's `soccer.Referee` model (`soccer/models.py:1153-1222`) is
    tournament-scoped with an OPTIONAL `user` FK (nullable,
    `on_delete=SET_NULL`) -- a referee can exist with no login account
    at all, in which case they have no email address anywhere in the
    schema. The existing `RescueDocumentReviewer` grant (kept, unchanged
    shape) is coupled to Referee by widening the roster screen's
    candidate pool to the UNION of `TournamentMembership` (existing:
    hosts/editors = "admin accounts that can do anything," matching the
    user's point 1) and `soccer.Referee` rows for the tournament
    (point 2, "referees which are already implemented") -- a Referee
    with no linked `user` is listed but its reviewer toggle is disabled
    with an explanatory note ("link an account on the Referee's own
    edit screen first"), rather than inventing a parallel auto-
    provisioning path outside where `RefereeForm` already owns it.

    **Target Django models** (new module `rescue/review.py`, replacing
    the removed `RescueDocumentBlockReviewer` and the review-specific
    classes moved out of `rescue/documents.py`): `RescueReviewBlock`
    (league FK, title, weight `DecimalField` 0-1 default 0, order,
    `linked_block_ids` `JSONField` list of submission `block_id`
    strings), `RescueReviewQuestion` (review_block FK, title,
    `description` `TextField` sanitized rich text -- the per-question
    rubric, `sanitize_answer_html` reused verbatim, same rich-text
    editor widget as Document Submission's own `input` questions),
    `scale_least`/`scale_most` (default 1/6 for new questions, matching
    the user's stated "1-6," host-editable), `required`, `order`;
    `RescueReviewAssignment` (review_block FK, reviewer FK ->
    `RescueDocumentReviewer`, `teams` M2M to `core.Team` blank=True --
    empty means every team in the league, exactly mirroring source
    `teamIds: []`). `RescueDocumentReview` (submitted per-team-per-
    reviewer scores) and `RescueDocumentReviewer` (the roster grant)
    move into this same module; `compute_document_score`/
    `_document_scores_for_league` are rewritten to source scores from
    `RescueReviewBlock`/`RescueReviewQuestion` instead of submission
    `config.blocks` scale questions, keeping the exact same Olympic-
    trim/`MINIMUM_REVIEWER`/weight/normalize math (`rescue/ranking.py`'s
    one call site, `compute_document_score(team, league)`, needs no
    behavior change, only an import-path update).

    **Screens** (all still independent per the "configure submission
    and review independently" fix, now correctly grounded): Reviewer
    roster (admin+referee union, unchanged url) -> Review Config
    (rebuilt: an actual block/question/rubric builder, add/remove
    blocks and questions, weight, linked-submission-block picker,
    per-block inline reviewer+team assignment rows, mirroring
    `rescue_document_builder.js`'s existing vanilla-JS block/question
    CRUD patterns for the submission form builder rather than
    reinventing a second builder idiom) -> new Review Assignment CSV
    import (preview-then-commit, `core/csv_import.py`-style) -> new
    Review Status (per-reviewer/per-team completion badges + "Send
    reminders," skipping fully-complete reviewers) -> Review Queue /
    Review Form (rewritten to source from the new models, same host-
    override + adoption-fallback-when-unassigned soft-degrade pattern
    already proven correct in the superseded version).

  - **Built and verified, this session (2026-07-15).** Implemented
    exactly the corrected design above, with three deliberate deviations
    from the plan text, each a real tradeoff not an oversight:
    - `RescueReviewBlock.weight` defaults to **1**, not the source's 0
      -- a freshly-created block that a host forgets to touch should
      score immediately, not silently sit excluded until someone
      remembers to set a weight; `weight=0` still excludes a block from
      scoring for hosts who want that.
    - `RescueReviewAssignment` uses a single nullable `team` FK (one row
      per (block, reviewer, team), `team=None` = every team), not a
      `teams` M2M -- two partial-unique constraints (mirroring
      `soccer.Referee`'s own NULL-safe pattern) enforce "one all-teams
      grant XOR N team-specific grants" per (block, reviewer) without
      the M2M-through-table uniqueness headache; scoping to 3 specific
      teams takes 3 add-rows instead of one multi-select, an acceptable
      cost for a much simpler assignment/removal UI and DB layer.
    - `linked_block_ids` (the submission-block cross-reference for
      contextual display while scoring) was **cut from this pass**: it
      is genuine CMS behavior, but none of the user's four numbered
      asks (roster/referee coupling, CSV import, status+reminders, the
      rubric structure itself) require it, and adding an unused field
      wired to no UI would be speculative generality, not requested
      scope. Revisit only if a concrete need for it surfaces.

    Everything else matches the design above as specified: separate
    `RescueReviewBlock`/`RescueReviewQuestion`/`RescueReviewAssignment`
    models in new `rescue/review.py` (`RescueDocumentReviewer`/
    `RescueDocumentReview` stay in `rescue/documents.py`, imported by
    review.py -- moving them bought nothing and would have added an
    import edge for no benefit); `sync_review_blocks` diff-syncs a
    posted JSON tree by client-minted `client_key` (create/update/
    delete), mirroring `rescue_document_builder.js`'s UX via new
    `rescue_review_builder.js` + `RescueReviewConfigView`; reviewer
    roster (`RescueDocumentReviewerListView`) unions
    `TournamentMembership` and eligible `soccer.Referee` rows,
    unlinked referees listed read-only with a pointer to link an
    account first; `RescueReviewAssignmentView` is an add/remove table
    (block + reviewer + optional team) plus a `ReviewerEmail,
    BlockTitle, TeamName`-column CSV bulk-import, preview-then-execute
    via session stash (`core`'s schedule-CSV tab pattern, not the
    team-importer's -- both already existed in this app; the simpler
    one fit a 3-column CSV better than the dataclass-heavy team
    importer); `RescueReviewStatusView` computes per-reviewer pending
    (team, block) pairs (all-or-nothing per team -- one
    `RescueDocumentReview` row covers every block assigned to that
    reviewer for that team at once) and a "Send reminder" action reuses
    `OutboundEmail`/`send_outbound_email` exactly as `MailComposeView`
    does, skipping reviewers with zero pending work; Queue/Form views
    and `compute_document_score`/`_document_scores_for_league` are
    rewritten against the new models with the same host-override +
    adoption-fallback soft-degrade pattern (zero `RescueReviewAssignment`
    rows for the league = unrestricted, matching the pre-existing
    precedent from the now-fully-superseded `RescueDocumentBlockReviewer`
    attempt below) and the same Olympic-trim/`MINIMUM_REVIEWER`/weight/
    normalize math, scores keyed by `str(question.id)` instead of a
    JSON string `question_id`.

    Migration history squashed clean (the never-deployed
    `RescueDocumentBlockReviewer` migration was unapplied and deleted
    rather than left as a create-then-drop pair, since none of this was
    committed or released -- see the squash note on the superseded
    bullet below for why that's safe here specifically).
    `rescue/tests/test_document_review.py` (the old model's entire test
    file) deleted; the invalidated `RescueDocumentBlockReviewer`
    sections of `rescue/tests/test_documents.py` removed, its remaining
    66 submission/roster-slice tests otherwise untouched and still
    green (the pre-existing `RescueDocumentReviewerListView` roster
    tests live in that count, unmodified -- only the block-assignment
    tests were removed from that file). 91 new tests across three
    parallel-delegated files (`test_review.py`: models/sync/scoring,
    40; `test_review_config_roster.py`: config builder + referee
    roster, 14; `test_review_assignment_status.py`: assignment/CSV/
    status/queue/form, 37) -- full `rescue/` suite 460 passing.
    Project-wide: 2943 passed, 3 skipped, same 2 pre-existing
    `soccer/` standings failures unrelated to this feature (confirmed
    via `git stash`/re-run against the unstashed tree, not caused by
    this session). Verified live end-to-
    end via headless browser + magic-link auth as two separate accounts
    (host + reviewer): builder add-block/add-question/save persists
    correctly with `sanitize_host_html`-cleaned description; roster
    grant-by-email; assignment add (all-teams scope); reviewer sees the
    assigned-block banner and scores a rubric question through the
    form; per-team all-or-nothing pending tracking confirmed correct
    against two teams (one reviewed, one not); reminder email
    delivered with the correct pending-team list in its body.

  - **Document admin UI redesign, this session (2026-07-15, follow-up).**
    User feedback on the hub built earlier this session: "make it more
    card styled... display different cards underneath... look at cms
    setup for that." Re-read the actual source (`rcj-rescue-cms-1/views/
    document/admin.pug`) rather than guessing: the CMS's own admin
    screen is a "Setup" section (one tournament-wide "Team admin" card,
    not per-league) followed by per-league card grids -- this directly
    validated two more explicit asks in the same message ("make team
    access a general config that shows a screen with all teams at once,
    including all leagues" + filter/search) as matching the source's own
    intent, not a scoreboard-only invention.
    - **`rescue:document_admin`** (`templates/rescue/document_admin.html`)
      rebuilt from a single dense table (7 `btn-sm` buttons crammed into
      one table cell per league row) into two card sections reusing the
      Rescue landing page's own established card language: a "Setup"
      row (`.rescue-common-card`, unchanged CSS, one new "Team access"
      card) plus a "Leagues" `.rescue-doc-card-grid` (new CSS,
      `minmax(440px, 1fr)` auto-fill) of one bordered `.rescue-doc-card`
      per league -- name/status header, a 3-stat row (submitted/
      reviewers/reviewed), then pill-shaped `.rescue-doc-btn` action
      groups (Submission / Review), the primary Review-queue action
      accent-colored. View/context unchanged (`RescueDocumentAdminHubView`
      untouched) -- this was a template + CSS-only change.
    - **Team access promoted to tournament-wide**
      (`RescueTeamDocumentListView`, `rescue/documents.py`): was
      league-scoped (`_LeagueScopedMixin`, one URL per league); now
      tournament-scoped (`HostRequiredMixin` only), one URL
      (`rescue:document_config_teams`, no `abbrev` kwarg) listing every
      team across every Rescue league at once, filterable by
      `?league=<abbrev>` and searchable by `?q=<team name substring,
      icontains>` -- mirrors the filter-bar convention already
      established by `core.mail_views.MailSentLogView`
      (`templates/mail/sent_log.html`'s `<form method="get">` +
      `<select name="team">`/`<input name="q">` pair), not a new
      pattern. A row save redirects back through the *current* filter
      querystring (`_list_url()` re-appends `request.GET`), so editing
      one team while filtered to a league doesn't bounce the host back
      to the unfiltered list. `document_config.html`'s "Per-team access"
      link now points at the tournament-wide URL pre-filtered to that
      league (`?league=<abbrev>`) so the per-league entry point still
      lands somewhere scoped, even though the destination screen itself
      is tournament-wide.
      **Follow-up (same session): filter went fully live.** User: "I
      dont want to click the filter button every time." Moved
      league+search filtering from a server GET round-trip to instant
      client-side hide/show, mirroring the existing
      `static/js/module_search.js` progressive-enhancement pattern (new
      `static/js/rescue_team_access_filter.js`): the view now always
      renders every team (dropped the `.filter(league__abbrev=...)`/
      `.filter(name__icontains=...)` queryset narrowing entirely --
      `?league=`/`?q=` only seed the controls' initial value), each
      `<tr data-team-row data-league="..." data-search="...">` is
      shown/hidden on every keystroke/select-change with no page
      reload, and the now-redundant "Filter" submit button hides itself
      once the script attaches (no-JS fallback: button stays visible,
      form still round-trips, table is simply unfiltered either way
      since the server always returns everyone now).
    - **Reviewer grant flow rebuilt as one checkbox-sync form**
      (`RescueDocumentReviewerListView`, `rescue/review.py`). User
      feedback: "reviewer should be added either via dropdown or better
      full list with just checkbox... display all admins that have
      access to the tournament and all the referees... I dont want to
      enter email manually again." Removed entirely: the free-text
      "grant by email" form and the old per-row `action=toggle`/
      `action=revoke` POST handlers. Replaced with a single form
      listing every candidate with a checkbox (pre-checked iff already
      granted); one POST syncs the league's `RescueDocumentReviewer`
      rows to exactly match the checked set in one
      `transaction.atomic()` pass (grant newly-checked, revoke
      newly-unchecked, leave already-matching rows untouched) --
      checked ids outside the computed candidate pool are silently
      intersected away, never create a stray grant. Also **dropped the
      referee-eligibility filter entirely**: the candidate pool used to
      require `RefereeLeagueEligibility` for this specific league
      (an earlier session's own design choice, see the "Reviewer roster
      + referee coupling" bullet under "Corrected review design"
      below); now it is *every* `soccer.Referee` in the tournament with
      a linked account, full stop -- reviewing document submissions is
      independent of which leagues a referee is allowed to officiate
      matches for, and the user's literal ask was "all the referees."
      Referees with no linked account are still listed read-only
      (checkbox disabled, pointer to link an account first) -- there is
      still no `request.user` to authenticate as for them, that part of
      the design is unchanged.
    - **Verified**: 461 `rescue/` tests passing (+1 net: 3 new,
      2 deleted -- the deleted tests encoded now-removed behavior
      [free-text email grant, eligibility-gated referees], not weakened
      assertions), delegated to one Tester agent that fixed the 8
      regressions this redesign caused and added dedicated coverage for
      the tournament-wide filter/search and the checkbox-sync's exact-
      set semantics (grant+revoke+no-op-on-match+ignore-non-candidate,
      all in one POST). Project-wide 2944 passing, same 2 pre-existing
      unrelated `soccer/` failures. Manually verified live: card grid
      renders full-width with both leagues' stat cards side by side;
      team access lists all 3 teams across both LINE/MAZE leagues,
      `?league=LINE&q=Team` correctly narrows to exactly one team;
      reviewer checkbox sync (unchecking a previously-granted reviewer
      and submitting) correctly revoked exactly that grant and left the
      other reviewer's grant untouched, confirmed via direct DB query.

  - **Block-level reviewer assignment + reviewer roster redesign**
    (follow-up on user feedback: "the document submission admin is not
    really working correctly... I need the possibility to configure
    the submission and the review independently... the reviewer should
    be assignable on block basis"): the review side had a real design
    gap the submission side (host builder) didn't -- every granted
    `RescueDocumentReviewer` saw and had to score *every* `scale`
    question in the whole league, with no way to split, say, a
    "Technical Interview" block and a "Project Presentation" block
    across two different judges, and Reviewers/Review-queue lived only
    as action buttons bolted onto the submission Config page (not an
    independent screen). Fixed with a new relational model,
    `RescueDocumentBlockReviewer` (league, block_id, reviewer -- M2M:
    several reviewers may share a block for a judging panel, one
    reviewer may cover several blocks; unique per (league, block_id,
    reviewer), `clean()` rejects a reviewer assigned outside their own
    granted league), plus **three now genuinely independent
    screens**: `RescueDocumentReviewerListView` (existing url,
    redesigned) is now an **account roster**, not a blind "type an
    email" box -- lists every `TournamentMembership` (host/editor) for
    the tournament with a one-click reviewer toggle per league, plus
    any already-granted reviewer with no membership at all (external
    judges keep working exactly as before, the grant-by-email form
    stays as a fallback for exactly that case); new
    `RescueDocumentReviewConfigView` is the actual "review config" the
    user asked for -- one multi-select per scorable block, options
    limited to that league's granted reviewers; `document_config.html`
    (submission) and the Documents admin hub now show **grouped,
    separately-labelled "Submission:" and "Review:"** action links
    instead of one undifferentiated row, so the two configuration
    surfaces read as independent at a glance, not coupled.
    `RescueDocumentReviewFormView`/`RescueDocumentReviewQueueView`
    filter questions/status to the current reviewer's assigned block(s)
    via `_assigned_block_ids`, with a host override (sees every block
    regardless, unchanged) and a **backward-compatible adoption
    fallback**: a league with zero block assignments at all behaves
    exactly as before (every granted reviewer sees every block) --
    block assignment activates per league only once a host actually
    uses the new Review Config screen, so existing reviewer grants
    never silently lose access the moment the feature ships. A reviewer
    granted access but not yet given a block in an *adopted* league
    sees an empty, clearly-labelled "not assigned yet" state (soft
    degrade) rather than a 403 -- caught and fixed during this session
    when 4 pre-existing tests broke against an earlier, stricter
    (hard-403) version of this same feature; the softer fallback both
    fixed the regression and is the more correct product behavior.
    Verified end-to-end: DB-confirmed a real assignment persists via
    the Review Config form, the review form correctly scopes questions,
    and the queue/hub pages render without error, after an unrelated
    live-debugging detour (see "Debugging note" below). 31 new tests
    (6 model, 17 roster/config-view, 8 review-form/queue filtering)
    across `rescue/tests/test_documents.py` and
    `rescue/tests/test_document_review.py`, delegated to three parallel
    subagents that coordinated over IRC and caught the 403-regression
    themselves rather than silently working around it. Full
    `rescue/`+`core/` suite now 2892 passing (project-wide), same 2
    pre-existing unrelated `soccer/` failures, zero regressions.
  - **Debugging note, unrelated to the feature itself:** repeated
    magic-link re-logins during manual browser verification kept
    invalidating the *previous* session (Django's `login()` rotates/
    deletes the old session key on each call) -- every retry using a
    stale grabbed session cookie looked like a mystery auth failure
    until traced to the session table directly. Not a bug; a reminder
    that manual re-verification after a login should grab the session
    key fresh, once, and stop re-authenticating mid-troubleshooting.
- **Phase 2 (CMS import/backfill): built and tested, never run against
  live data.** `python manage.py import_cms --mongo-uri ... --competition-id
  ... --tournament-slug ... [--dry-run] [--strict]`
  (`rescue/management/commands/import_cms.py`) maps Competition/League/
  Team/Round/Field/Line+Maze-Map/Line+Maze-Run into existing scoreboard
  models (the target Tournament must already exist -- CMS's Competition
  has no region/dates/timezone for a command to sensibly invent). Every
  whole collection with no scoreboard-side model (documents, surveys,
  mail, reservations, short URLs, technical challenges, signage, CMS user
  accounts) is named in the run summary, never silently dropped;
  Simulation leagues are skipped the same way (no scoreboard Simulation
  map/run model yet). Idempotent (`external_ref["cms_team_id"]` / natural
  keys), transactional (`--dry-run` rolls back after printing what would
  commit), row-level failures skip-and-report by default or hard-abort
  under `--strict`. **No live Mongo instance was available in this
  environment** -- tested against `mongomock` seeded with fixtures built
  from the real schemas (10 tests: full import, idempotency, dry-run,
  unresolvable-reference handling both modes, provenance-stamping and
  its one-tournament-per-competition guard). Running it against a real
  CMS export is the next concrete step toward Phase 7.
- **Phase 6, decided this session:**
  - **Signage: retired, not ported.** Source (`routes/api/signage.js`,
    318 lines + `routes/signage.js` + JS + pug views) is a *global*
    (not tournament-scoped -- `signagedb.find({})` has no competition
    filter) file-slideshow CMS for on-site venue displays (sponsor
    logos/schedules cycling on a screen), backed by a flat
    `public/signage_content/` upload folder. Doesn't fit scoreboard's
    per-tournament model without a redesign, and a venue screen can
    already just project the scoreboard's own dashboard/ranking/
    schedule pages directly -- no unique competition-critical function
    identified beyond a generic slideshow. Revisit only if a concrete
    need surfaces.
  - **Backup (competition export/import zip): retired, not ported.**
    Source (`routes/api/backup.js` + `queue/backupQueue.js`, ~720 lines)
    is a BullMQ-backed Mongo-collection + uploaded-media zip
    exporter/importer -- bespoke disaster-recovery tooling for the old
    Mongo+filesystem storage layer. Scoreboard runs on Postgres, which
    has mature infra-level backup tooling (`pg_dump`/managed-provider
    snapshots) covering the actual disaster-recovery need. A
    hypothetical "clone one tournament's data to a new season" feature
    is a different, harder problem under Postgres's shared schema (no
    natural per-competition document boundary like Mongo has) and isn't
    justified by any source-schema requirement -- not attempted.
  - **ShortURL: ported** (small, ~187 lines total in the source) --
    `core/shorturl.py`, global superuser-only utility (list/create/edit/
    delete + click-count), `/s/<code>/` public redirect, sidebar entry
    gated on `is_superuser`. Verified live (curl 302).
  - Realtime (websocket live score/slot updates) and the standalone
    service map/simulation editors mentioned in the original Phase 6
    scope: still not started, not attempted this session.
- **Phase 7 (cutover): blocked** on running Phase 2's import command
  against a real CMS Mongo export at least once (built and
  `mongomock`-tested, never exercised against live data), plus the
  Score-entry gap below.

**Known gaps in what's built** (tracked so they aren't silently assumed
done):

- Map Editor: Line's tileset picker is a single hardcoded set, not the
  CMS's named `TileSet`/`TileType` catalog with per-competition physical-
  inventory counts (a real structural feature -- explored this session,
  scoped out as low value-to-effort relative to everything else); no maze
  `dice`/`parent` multi-map bundling.
- No per-victim tally (NL live/dead, WL rescueOrder) in the *ranking*
  display -- the judge scoring engine now computes and records this
  internally (`RescueRun.judge_log`) during scoring, but
  `rescue/ranking.py`'s standings table still only surfaces the
  aggregate score, not a victim-by-victim breakdown column.
- **Score entry UI has two paths for run stages, not one:** the original
  plain manually-typed `score`/`raw_score`/`time_seconds` form and the
  tile-by-tile judge UI for Line/Maze/Simulation. The judge UI is
  intentionally not pixel-parity with the source's tablet app (see the
  judge-scoring-engine bullet above for the explicit non-goals) but is a
  real, tested, working alternative. Technical Challenge (closed
  2026-08-01) is a separate, non-run stage type with its own dedicated
  score-entry table (`rescue:stage_technical_challenge`) -- not a third
  path on this list, since it never used the run-based score forms.

The old standalone migration status was:

- `compat_auth`: login/logout/me
- `competitions`: Round, Field, Competition, CompetitionLeague
- `shorturl`: URL-shortener admin API
- `cms_users`: user management and per-competition grants
- `signage`: signage playlists and content-file manager
- `devdemo`: throwaway browser login page

Those items must be re-evaluated against scoreboard's existing core before
porting. In particular, standalone `Competition`, `Team`, `User`, auth, and URL
decisions conflict with scoreboard's `Tournament`, `Team`, `User`,
`TournamentMembership`, `/t/<slug>/`, and magic-link login conventions.

## Lessons retained from the standalone migration

Keep these Django/Postgres lessons for every scoreboard port:

- `full_clean(exclude=[...])` skips uniqueness checks involving excluded fields.
  If a unique constraint includes a field, do not exclude that field and then
  assume `full_clean()` checked the constraint.
- Wrap every `full_clean()`/`.save()` pair that can hit `IntegrityError` in
  `transaction.atomic()`. Catching `IntegrityError` inside an outer test
  transaction can otherwise poison later assertions with
  `TransactionManagementError`.
- Mongoose refs were not enforced FKs. Django/Postgres FKs are real constraints,
  often deferrable until transaction commit. Add explicit existence checks where
  the user-facing error must be precise.
- Treat CMS ObjectIds as stable external identifiers. Preserve them in
  `external_ref` JSON or dedicated legacy-id fields so backfills, links, and
  exports can be reconciled.
- File side effects are part of the behavior. Creating/deleting CMS competitions
  and teams creates/deletes filesystem directories. In scoreboard these side
  effects need explicit storage services and tests; do not hide them in views.

## Scoreboard architecture decisions

### App boundary

Add Rescue functionality beside `soccer`, not inside it.

Preferred initial app boundary:

```
rcj-scoreboard/
  rescue/
    models.py
    urls.py
    urls_api.py
    services/
    tests/
  templates/rescue/
  static/...
```

Split into `rescue_line`, `rescue_maze`, and `rescue_simulation` only if the
models/views diverge enough that a single app becomes misleading.

Use `Stage.league_app` and `Stage.stage_type` for ownership:

- `league_app="rescue"` with stage types such as `line`, `maze`, `simulation`,
  `technical_challenge`, or
- separate app labels such as `rescue_line`, `rescue_maze`,
  `rescue_simulation`.

The first implementation slice must decide and record the exact vocabulary.

### URL placement

Mount Rescue HTML routes as a sibling of `core.tournament_urls` and
`soccer.urls` under `/t/<slug>/`:

```python
path("t/<slug:slug>/", include("rescue.urls")),
```

Mount APIs only when needed:

```python
path("api/v1/rescue/", include("rescue.urls_api")),
```

Do not port legacy CMS `/admin/:id/...` and `/api/...` paths as the default UI.
Keep them only for explicit compatibility bridges.

### Permission model

Use scoreboard permissions first:

- Tournament configuration: `HostRequiredMixin` / `can_edit_tournament`.
- Score/run entry: `EditorRequiredMixin` / `can_enter_results`.
- Public/member read pages: `PublicOrMemberMixin`.
- Authenticated visible pages with no extra role: `LoginRequiredVisibleMixin`.
- Member management: `can_manage_members`.

CMS roles that do not fit scoreboard's host/editor model must get an intentional
target model and tests. Candidate CMS roles:

- `VIEW`
- `JUDGE`
- `INTERVIEW`
- `ADMIN`
- numeric access levels `NONE=0`, `VIEW=1`, `JUDGE=5`, `ADMIN=10`,
  `SUPERADMIN=15`

Do not overload scoreboard `editor` if a CMS role has narrower or broader
rights.

### UI and navigation

Use scoreboard's shell:

- `templates/base.html`
- `templates/tournament/_base_tournament.html`
- `docs/DESIGN.md`
- `static/css/rcj-theme.css`

Update these target seams when Rescue routes exist:

- `rcj_scoreboard/urls.py`
- `core/context_processors.py`
  - `_TOURNAMENT_SCOPED_NAMESPACES` currently includes `tournament` and
    `soccer`.
- `templates/_sidebar.html`
- `tests/test_urls.py`
- `pyproject.toml` `testpaths`

Keep legacy Pug/static files as behavior references. Port UI behavior into
Django templates unless a compatibility bridge deliberately serves old assets.

## Source CMS functional surface

### Route map

Authoritative route mounts from `rcj-rescue-cms-migration/app.js`:

| Area | Source route(s) |
|---|---|
| Auth | `/api/auth`, `/login`, `/logout` |
| Competitions/leagues | `/api/competitions`, `/admin`, `/home` |
| Users/roles | `/api/users` |
| Teams | `/api/teams`, `/admin/:id/teams`, `/admin/:id/teams/bulk` |
| Rounds/fields | `/api/rounds`, `/api/fields`, `/admin/:id/rounds`, `/admin/:id/fields` |
| Maps | `/api/maps/line`, `/api/maps/maze`, `/admin/:id/:league/maps`, map editor pages |
| Runs | `/api/runs/line`, `/api/runs/maze`, `/api/runs/simulation`, line/maze/simulation judge/view/sign pages |
| Ranking | `/api/ranking`, ranking print/view pages |
| Documents/review | `/api/document`, `/document`, `/admin/:id/documents` |
| Registration | `/api/registration`, `/registration` |
| Survey | `/api/survey`, `/admin/:id/survey`, team survey pages |
| Reservation | `/api/reservation`, `/admin/:id/reservation`, team reservation pages |
| Cabinet | `/api/cabinet`, `/admin/:id/cabinet`, team cabinet pages |
| Mail | `/api/mail`, mail template/sent pages |
| Signage | `/api/signage`, `/signage` |
| Technical challenge | `/api/technicalChallenge` |
| Backup/restore | `/api/backup`, `/admin/:id/backup`, `/admin/restore` |
| Short URLs | `/api/short`, `/s/:shorted` |
| Service/editor/kiosk | `/service`, route file `routes/kiosk.js` exists but is not mounted in `app.js` |

### Admin view map from the old CMS

This is source surface area, not target routing:

```
GET /admin
  |- /admin/line/tilesets
  |- /signage/setting
  |- /admin/restore
  |- /admin/mailTemplates
  |- /admin/queues
  |- /admin/mongo
  |- /admin/short
  |- /admin/user
  \- /admin/:id

GET /admin/:id
  |- /admin/:id/teams
  |- /admin/:id/teams/bulk
  |- /admin/:id/rounds
  |- /admin/:id/fields
  |- /admin/:id/:league/games
  |- /admin/:id/:league/maps
  |- /admin/:id/settings
  |- /admin/:id/backup
  |- /admin/:id/documents
  |- /admin/:id/mails
  |- /admin/:id/registration
  |- /admin/:id/reservation
  |- /admin/:id/cabinet
  |- /admin/:id/survey
  \- /admin/:id/application
```

## Target data mapping

### Shared core mapping

| CMS model/field | Scoreboard target |
|---|---|
| `Competition` | `core.Tournament`; legacy ObjectId in `Tournament.external_ref["cms_competition_id"]`. |
| `Competition.name/description` | `Tournament.name/description`. |
| `Competition.logo/bkColor/color/message/preparation/publicToken/consentForm` | Rescue-specific tournament config model or JSON field; decide in Phase 0. |
| `Competition.leagues[]` | `core.League` plus Rescue config. Preserve CMS `league`, `num`, `mode`, `disclose`, `rule`. |
| `Round` | Prefer `core.StageRound`; add Rescue round/session model only if needed. |
| `Field` | Prefer `core.Venue`; reconcile availability because current availability is soccer-owned. |
| `Team` | `core.Team` plus Rescue team profile one-to-one or `external_ref` for CMS-specific values. |
| `Team.document.token/teamCode/docPublic/checkin/inspected/document answers` | Rescue self-service/team-document profile. |
| `User` | `core.User` plus `TournamentMembership` and any explicit Rescue role/grant model. |
| CMS password/salt | Do not port as active auth by default. Use magic-link login. Keep legacy user id in `User.external_ref` if importing. |

### Rescue-specific models

Candidate target model families:

- `RescueTournamentConfig`
  - tournament FK
  - logo/color/message/preparation/public token/consent form
  - registration/document feature switches that are not league-specific
- `RescueLeagueConfig`
  - league FK
  - source CMS league id
  - rescue type: line/maze/simulation
  - rule year/version
  - ranking mode
  - best-N `num`
  - disclose/public ranking flag
- `RescueTeamProfile`
  - team one-to-one
  - legacy team id
  - team code
  - document token
  - check-in/inspection/document-public/document-deadline/penalty
  - email list and members JSON with PII-aware access
- `RescueMap` or split `LineMap`/`MazeMap`
  - tournament/league/stage optional FKs
  - dimensions/duration/finished/name/rule metadata as columns
  - tile/cell grid as JSON
- `RescueRun` or split `LineRun`/`MazeRun`/`SimulationRun`
  - stage/stage_round/stage_entry/team/venue/map FKs
  - group/normalization group/status/started/showed-up/time/signature columns
  - detailed scored tile/cell state as JSON
  - score/raw_score/multiplier/adjustment columns
- `DocumentFormConfig`, `DocumentReview`, `Survey`, `SurveyAnswer`,
  `Reservation`, `ReservationSlot`, `ReservationBooking`, `MailMessage`,
  `MailAuthToken`, `SignagePlaylist`, `ShortURL`, backup metadata as needed.

### JSON vs column rule

Promote to real columns when the value is filtered, sorted, joined,
constrained, aggregated, permission-checked, or used in ranking. Keep as
`JSONField` when the UI reads/writes the whole tree and SQL never needs to
address subkeys.

Likely JSON:

- line map tiles
- maze map cells
- run tile/cell detail
- document form blocks/questions/options
- survey i18n/questions
- mail event timeline and rewritten URLs
- legacy raw-source snapshots for import auditing

Likely columns/FKs:

- tournament/league/stage/stage round/team/venue/map
- rule/ranking mode/disclose/normalization group
- score/raw score/multiplier/adjustment/status/started/time/signature
- team document token/code/public/deadline/penalty
- survey/reservation slot bookings
- mail delivery status/time/team

## Target phase ordering

### Phase 0: scoreboard integration baseline

Deliverable: a small target design decision set before feature work.

Decide and record:

- Rescue app boundary and app label(s).
- Rescue stage type vocabulary.
- URL namespace and route shape.
- `core.forms.StageForm` strategy, because current stage creation is
  soccer-oriented and hardcodes `league_app="soccer"`.
- Role mapping from CMS `VIEW/JUDGE/INTERVIEW/ADMIN` to scoreboard permissions
  or new Rescue grants.
- Legacy ObjectId storage strategy.
- Media path strategy under `MEDIA_ROOT`.
- Import/backfill preview/commit shape.
- Whether any old `/api/...` paths must be preserved temporarily.
- Whether realtime is required for run/signage/reservation, or polling is
  acceptable.

Acceptance:

- `rcj_scoreboard/urls.py` and `tests/test_urls.py` plan is clear.
- `pyproject.toml` `testpaths` impact is clear.
- Existing soccer routes/tests remain unaffected by the design.


### Phase 0 decisions recorded 2026-07-09

- **App boundary:** single `rescue` Django app beside `soccer`.
- **Stage vocabulary:** `Stage.league_app="rescue"` with stage types `line`,
  `maze`, `simulation`, and `technical_challenge`. Source CMS league ids such
  as `LineNL` remain import/config data, not `Stage.stage_type` values.
- **HTML routing:** scoreboard-native tournament routes mount under
  `/t/<slug>/rescue/`, `/t/<slug>/leagues/<abbrev>/rescue/`, and
  `/t/<slug>/leagues/<abbrev>/stages/<pk>/rescue/`.
- **API routing:** no `/api/v1/rescue/` mount until a concrete CMS API slice
  needs it; avoid an empty compatibility surface.
- **Stage creation:** keep `core.forms.StageForm` soccer-owned because it
  writes `SoccerStageConfig`; create Rescue stages through app-specific Rescue
  views/forms that set `league_app="rescue"` and do not create soccer config.
- **Roles:** initial shell uses scoreboard visibility/host permissions
  (`PublicOrMemberMixin` and `HostRequiredMixin`). Narrow CMS `VIEW`, `JUDGE`,
  and `INTERVIEW` grants will get explicit Rescue models only when a slice
  needs rights that do not match host/editor/viewer.
- **Legacy IDs:** preserve CMS ObjectIds in existing `external_ref` JSON where
  available (`Tournament`, `Team`) and dedicated Rescue config/profile fields
  where the ID belongs to Rescue-only data.
- **Media:** new CMS-derived uploads stay under `MEDIA_ROOT/rescue/...` and are
  served only by authorization-checked Django views.
- **Import/backfill:** use a preview/commit flow following the CatiGoal import
  pattern; commits must be idempotent on legacy ObjectId and must not overwrite
  local scoreboard edits without an explicit conflict rule.
- **Realtime:** polling/page refresh is the default until a run, signage, or
  reservation slice proves WebSockets are required.

### Phase 1: Rescue app shell and core seams

Deliverable: empty-but-wired Rescue app integrated into scoreboard.

Scope:

- Create/add the Rescue app in `rcj-scoreboard`.
- Add app config to `INSTALLED_APPS`.
- Mount tournament-scoped Rescue URLs and, if needed, `/api/v1/rescue/`.
- Add namespace to `core.context_processors._TOURNAMENT_SCOPED_NAMESPACES`.
- Add minimal templates extending `_base_tournament.html`.
- Add factories/test scaffolding.
- Adjust stage creation so non-soccer stages can be created without breaking
  soccer.

Acceptance:

- A host can reach a Rescue landing page for a tournament/league/stage.
- Existing soccer/core URL tests still pass.
- Permission tests prove private slug non-leak behavior.

### Phase 2: CMS import foundations and shared objects

Deliverable: source CMS competitions/users/teams/leagues can be represented in
scoreboard without duplicate core systems.

Scope:

- Import/map CMS `Competition` to `Tournament`.
- Import/map CMS `Competition.leagues[]` to `League` plus Rescue league config.
- Import/map CMS `Team` to `Team` plus Rescue team profile.
- Import/map CMS users to `User` plus scoreboard memberships and Rescue grants.
- Map `Round`/`Field` to `StageRound`/`Venue` or explicit Rescue models based
  on Phase 0 decisions.
- Preserve legacy ObjectIds and tokens.

Acceptance:

- Preview/commit import test covers duplicate legacy IDs and stable mappings.
- Team PII is not exposed to public/anonymous users.
- Host/editor/view/judge/interview role decisions have tests.

### Phase 3: Rescue maps, runs, scoring, and ranking

Deliverable: Line/Maze/Simulation operational scoring can run in scoreboard.

Scope:

- Port Line/Maze map schemas and invariants.
- Port Line/Maze/Simulation run schemas and invariants.
- Port score calculators/rule-year dispatch.
- Port ranking modes:
  - `SUM_OF_BEST_N_GAMES`
  - `MEAN_OF_NORMALIZED_BEST_N_GAMES`
  - `MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT`
  - `GAMES_DOCUMENT_CHALLENGE`
- Port public disclosure behavior.
- Add score entry and result views/APIs using scoreboard permissions.

Acceptance:

- Map edits are blocked after started runs.
- Runs enforce one team per round and same-tournament/team/field/map
  relationships.
- Ranking tests cover best-N, normalization group, time tiebreaks, adjustments,
  and `disclose=false`.
- Score entry is editor-allowed and configuration is host-only.

### Phase 3a: Competition Operations Dashboard (validated live, 2026-07-11)

Deliverable: the CMS "admin console" surface for one competition — Teams,
Rounds, Fields, per-league Maps + Map Editor, schedule creation, and run
overview — reproduced in `rcj-scoreboard` with UI parity to the source CMS,
not a generic re-imagination of it.

**Provenance.** This section was written after running the actual source CMS
locally (`node server.js` in `rcj-rescue-cms-1/`, Mongo `rcj-cms` DB, Redis,
default account `admin`/`adminpass`) and driving it with a real browser
against the seeded competition **RoboCup2025 Salvador**
(`_id = 684d24235af6f7dc45cc15e1`, leagues `Line`, `Maze`, `Erebus`
(Simulation), ~90 teams, ~700 runs, real maps). Every field name, label,
icon, and validation message below was read from the running app or its
Pug/Angular source, not inferred. The competition id the request originally
named (`6a23f8ff78473f34bd8a593e`) does not exist in the seeded local DB;
`684d24235af6f7dc45cc15e1` was used instead because it has real data.

#### A. Competition admin dashboard (`/admin/:competitionid`)

Source: `routes/admin.js:44-57` → `views/admin/competition.pug`.

Card-grid layout, four sections, in this exact order:

| Section | Cards | Target |
|---|---|---|
| **Common** | Teams · Rounds · Fields (icon + name + one-line description) | `/admin/:id/teams`, `/admin/:id/rounds`, `/admin/:id/fields` |
| **Leagues** | One large gradient hero card per league (photo background, colored top bar per league type, league name, **Maps** + **Runs** pill buttons) | `/admin/:id/:leagueId/maps`, `/admin/:id/:leagueId/games` |
| **Tools** | Document Submission · Booking · Cabinets · Questionnaire | out of scope for this phase (Phase 4/5) |
| **Management** | Settings · Backup | out of scope for this phase (existing `tournament:edit`-adjacent) |

Leagues-card details (screenshot-matched, this is the UI the user wants
reproduced exactly):

- Card top bar color = league accent (green/blue/orange in the seeded data).
- Background = a faint isometric render of the league's field, dimmed.
- Simulation card has **no Maps button** — only **Runs**. This mirrors the
  source: `games.pug:468,498,596,613,639,652` all gate map-only UI behind
  `ng-hide/ng-show="league.type == 'simulation'"`.
- Maps button is a neutral/dark pill; Runs button is filled in the league's
  accent color.

Target: rework `rcj-scoreboard`'s tournament dashboard
(`templates/tournament/dashboard.html`) to this card grid, OR add a
Rescue-specific dashboard reachable from `rescue:landing` /
`rescue:league` — **decide which** before implementing (see Decision D1
below); the screenshot the user supplied is the competition-level page, one
level above League, so the natural target is the **tournament dashboard**,
with the "Leagues" grid becoming the existing league list re-skinned as
hero cards instead of the current text-row list.

#### B. Teams / Rounds / Fields — separate, competition-scoped, flat CRUD

Source models (`rcj-rescue-cms-1/models/competition.js:271-279,375-383`):

```js
roundSchema = { competition: ObjectId (required), name: String (required) }
fieldSchema  = { competition: ObjectId (required), name: String (required) }
```

**Critical fact, validated live:** Round and Field are **competition-wide**,
not per-league and not per-stage. The same `R1`/`F1` is shared by Line, Maze,
and Simulation runs in one competition (`/admin/:id/rounds` and
`/admin/:id/fields` have no league selector at all — screenshots confirm
flat lists `R1..R8, R4V2` / `F1..F4` with zero league scoping). Uniqueness is
enforced only within the competition (`roundSchema.pre('save')` /
`fieldSchema.pre('save')`).

**This contradicts the interim models already added this session**
(`rcj-scoreboard/rescue/models.py`: `RescueField` is `stage`-scoped, unique
per `(stage, name)`). That was a reasonable guess before live validation but
is now known to be wrong relative to source behavior. **Decision D2** below
records the fix; do not silently rewrite it as part of this planning pass —
get sign-off first, since `RescueRun.field`/`RescueRun` tests already depend
on the stage-scoped shape.

UI (both Rounds and Fields pages are the same template, screenshot-matched):

```
[+ Add {round|field}]  <- collapsible: one text input + "Add {round|field}" button

ROUNDS|FIELDS
┌──────────────────────────────┐
│ NAME                OPERATION│
│ R1 / F1                Delete│
│ R2 / F2                Delete│
│ ...                          │
└──────────────────────────────┘
```

No edit-in-place; rename is delete+recreate in the source CMS (acceptable to
keep as-is unless the user asks otherwise).

Teams page (`/admin/:id/teams`, source `routes/admin.js:95-105`, list
columns Team code/Team/Region/Contact/Operation, filters by team
code/name/region and league checkboxes, plus a **Bulk registration** link to
a CSV-only importer at `/admin/:id/teams/bulk` — 3-step
download-template/edit/upload flow, distinct from the Runs generator in
section D) is already scoped by the existing scoreboard `core.Team` +
`TeamForm`; only the multi-league filter chips and the CSV bulk importer are
net-new relative to what scoreboard has today.

#### C. Maps — per-league list, creation bound to the Map Editor

Source: `routes/admin.js:495-542` →
`views/admin/maps.pug` (list) + `views/admin/mapEditor/{line,maze}_{rule}.pug`
(editor, one Pug/JS pair per rule year — `line_2025.pug`, `line_2025E.pug`,
`line_2026.pug`, `line_2026E.pug`, and the Maze equivalents).

**Maps list** (`/admin/:id/:leagueId/maps`):

```
[🖨 Print]  [+ Create a new map]

☐  MAP NAME                          DELETE
☐  🗺 M1-1                              🗑
☐  🗺 M1-2                              🗑
...
```

- Checkbox-select rows → bulk print/export.
- Clicking a row name navigates straight into the Map Editor for that map
  (`/admin/:id/:leagueId/mapEditor/:mapid`) — there is **no separate
  "create map" form**. "Create a new map" opens a **blank Map Editor**
  (`/admin/:id/:leagueId/mapEditor`, no `:mapid`) with an auto-generated
  placeholder name ("Awesome Testbana" style, click the pencil icon to
  rename) and a 1×1 grid. **This is exactly the "Map creation should be
  bound to map editor" requirement** — confirm the target implementation
  keeps this one-screen flow, not a name/dimensions modal followed by a
  redirect.
- Maze maps additionally group by a `parent` field for multi-level "dice"
  maps (`maps.js` Angular controller groups by `parent`); none of the seeded
  Maze maps in this competition used it, so the grouped-list UI could not be
  re-validated live — port from `views/admin/maps.pug` source, flag as
  unverified-by-screenshot.

**Map Editor** — full UI inventory (validated against `line_2026.pug` +
live `M1-1` and a fresh blank map; Maze rule pages add victim/obstacle
fields but share the same chrome):

| Zone | Control | Behavior / source |
|---|---|---|
| Header | Map name | Inline-editable text input + pencil icon, `hero_title_container` |
| Header | Breadcrumb | Home / Admin / Competition / `{League} Maps` / Editor |
| Header right | **SAVE** group | Save (disk) `saveMap()`; **Save As** (copy icon) opens a modal: new name + target-competition dropdown — maps can be duplicated **across competitions** |
| Header right | **JSON** group | Export JSON (`export()`), Import JSON (file picker) |
| Toolbar | **DIMENSIONS** | Height/levels (`fa-layer-group`, stepper, drives floor count) · Width (`fa-arrows-alt-h`, stepper) · Length (`fa-arrows-alt-v`, stepper) — exactly `lineMap.js` schema fields `height/width/length` |
| Toolbar | Live Victim capsule | Heart icon, click-to-expand stepper, count of live victims to auto-place/score |
| Toolbar | Dead Victim capsule | Skull icon, click-to-expand stepper |
| Toolbar | Duration capsule | Clock icon, click-to-expand stepper, seconds — schema `duration` (default 480) |
| Toolbar | Finished toggle | Clipboard-check icon, `finished = !finished`, schema `finished` boolean gating map for use in runs |
| Toolbar | Calculate Max Score | Calculator icon, `openMaxScore()` — opens a computed max-score modal for the current tile layout |
| Left rail | Reset view | Expand-arrows icon, `centerMap()` |
| Left rail | Undo / Redo | `Ctrl+Z` / `Ctrl+Y`, disabled when stack empty |
| Left rail | Floor tabs | `F0`, `F1`, ... vertical switcher for multi-level maps (height > 1) |
| Canvas | Tile grid | HTML `<table class="map-table-editor">` of 60×60px `<td>` cells inside a large-padding scroll-aligner `div` (`padding: 100vh 100vw`) so the grid can be panned; each cell hosts an `<img>` tile (150×150 source PNGs from `/images/tiles/tile-N.png`) at the placed rotation |
| Canvas | Selection tools | Contextual toolbar on multi-select: Rotate Group, Copy Group, Delete Group |
| Right rail | Tileset picker | "SELECT TILE SET" header with live count badge (87 for Default(2022)); tileset dropdown (multiple named sets exist); a scrollable palette grid of tile thumbnails, each showing its walkable-path/tile-index badges; drag tile onto canvas to place, click-and-rotate on canvas to rotate |
| Below canvas | **Advanced tools and output** (collapsible) | Output Content: Map Images vs Score Sheets (radio cards) · File Format: PDF/PNG · Paper Size: A4/Letter · **Generate PDF** button |
| Validation | Start-tile warning | Red banner "No start position set" (`startNotSet()`) blocks nothing visibly but flags an incomplete map |

This is a genuinely large canvas/grid editor — treat it as its own
sub-phase (3a-3 below), not something to build alongside the dashboard
cards. Recommend an SVG or `<canvas>`-based grid in the target (rather than
reproducing the 60px `<td>`-per-cell table + giant scroll-padding trick,
which is fragile — it is also the thing that produced a blank-looking
screenshot for the real `M1-1` map during this validation pass until the
viewport was scrolled/inspected; the DOM was correct, the initial
scroll-to-content behavior was not reliable at this viewport size).

#### D. Runs: split "create schedule" from "edit runs", per the request

The source CMS conflates these into one page
(`/admin/:id/:leagueId/games`, `views/admin/games.pug`) with an inline "Add
run" mini-form above a single giant table (validated: 700+ rows rendered at
once for this competition, ~15,000px tall — this is exactly the "clutter"
the user flagged). **Do not port that combined shape.** Split into two
screens:

**D1. Schedule creation — Bulk Registration
(`/admin/:id/:leagueId/games/bulk`, `views/admin/games_bulk.pug` +
`public/javascripts/admin/games_bulk.js`)**

Two tabs, both produce `LineRun`/`MazeRun`/`SimulationRun` rows in bulk —
**this, not the single-run mini-form, is the primary path to schedule a
competition** and is what the request means by "look at the generator in
bulk registration":

- **CSV Import** tab: Step 1 download an Excel/CSV template; Step 2 the page
  lists every valid Round/Team/Map/Field name plus the required start-time
  format so the operator can fill the file correctly offline; Step 3 upload
  + preview + execute.
- **Generator** tab (the actual algorithm, `games_bulk.js:92-260`):
  - Multi-select chips (all pre-populated, removable) for **Teams**,
    **Rounds**, **Fields**, **Maps**.
  - Numeric config: **Days**, **Slot minutes**, **Small break multiplier**,
    **Lunch minutes**, **Start time** (datetime-local).
  - **Schedule Mode** dropdown, two options (`games_bulk.js:93,153`):
    1. `Scrambled / Rotating Normalization Groups` (default) — every team
       plays every selected map exactly once; each field hosts a different
       map per round; teams rotate across fields/maps round to round.
    2. `Fixed Map / Fixed Normalization Group` — every field/team plays the
       same map and normalization group within a round; fields are purely
       parallel lanes, not distinct maps.
  - Hard validation, both enforced client-side before generation (verified
    live by triggering both):
    1. *"Number of selected rounds must match number of selected maps."*
    2. *"For a valid schedule, the number of rounds must be divisible by the
       number of selected fields."*
  - **Generate Schedule** button renders a **preview table** (Round / Team
    name / Map name / Field name / Start Time / Normalization Group ID) —
    verified live: 8 rounds × 4 fields × 24 teams → 192 previewed rows,
    correctly staggered by `slot minutes` and rotating maps/fields per the
    chosen mode.
  - A disclaimer notes teams/maps/fields/timing should be reviewed before
    commit.
  - **Execution** button (separate from "Generate Schedule") is the actual
    commit step — this two-step preview/commit shape is exactly the pattern
    scoreboard already uses for CatiGoal import and Swiss round generation;
    reuse that pattern, not a bespoke one.

**D2. Run overview — read-first, editor-scoped inline edit**

Split the existing `games.pug` list into a dedicated, filterable, non-form
overview:

- Header actions: Field monitor/signage link (hidden for Simulation), Print,
  Ranking; Scoresheet generation (hidden for Simulation) opens a
  paper-size/type modal, does not navigate away.
- Filter drawer: by Round (chip toggles), Field (chip toggles), Team code,
  Team name.
- Table columns: Start time, Round, Team code, Team, Field, **Map (hidden
  for Simulation)**, Normalization group id, Score, **Adj.** (inline-editable
  percentage — the only field editable directly in the list; toggled via an
  Edit-mode button), Time, Status (color-coded pill), row actions.
- Row actions (dropdown): Generate scoresheet (hidden for Simulation),
  **View**, **Judge**, **Sign**, **Manual input**, **Status reset**,
  **Delete**. These open the rule-year-specific scoring pages
  (`view/{type}_{rule}.pug`, `judge/{type}_{rule}.pug`,
  `manual/input/{type}_{rule}.pug`, `sign/{type}_{rule}.pug`) — those are
  Phase 3's existing "score entry" scope, unchanged by this section; this
  section only fixes the **list/browse/edit-metadata** page around them.
- Bulk select + delete, and an XLSX schedule export, exist on the list
  toolbar (`fa-file-excel`).

Net effect: Runs get a **run overview** (browse/filter/light edit) fed by a
**separate schedule generator** (bulk creation), matching the request
exactly — no more "enter a run with a score" as the primary creation path.

#### E. Decisions to make before implementing (record here once settled)

- **D1 — Dashboard placement.** Rework `tournament/dashboard.html` into the
  card grid (Common/Leagues/Tools/Management) directly, vs. a
  `rescue`-namespaced dashboard reached from the existing sidebar "Rescue"
  link. The supplied screenshot is a *competition-level* (tournament-level)
  page, and Soccer has no equivalent concept of Rounds/Fields/Maps, so the
  cleanest read is: **tournament dashboard gains Common (Teams/Rounds/Fields)
  unconditionally, and Leagues render as hero cards; Soccer leagues keep
  their existing text-row entry (no Maps/Runs pills), Rescue Line/Maze/OnStage
  leagues get the hero-card treatment with league-type-appropriate pills.**
  Needs sign-off, not just inference.
- **D2 — Round/Field scope fix.** Promote `RescueField` (and add
  `RescueRound`, replacing ad hoc `core.StageRound` reuse for manual rounds)
  to **tournament-scoped**, not stage-scoped, matching source behavior in
  §B. `RescueRun.round`/`RescueRun.field` FKs and their `clean()` stage-match
  checks need to change from "must belong to this stage" to "must belong to
  this tournament." This directly affects the interim models/forms/views
  added earlier this session under `rcj-scoreboard/rescue/`; do not change
  them without confirming this reading is correct, since it also changes the
  uniqueness constraint shape (`(tournament, name)` not `(stage, name)`).
- **D3 — Maps stay stage/league-scoped.** Unlike Round/Field, Maps are
  legitimately per-league in the source (`lineMap.js:34`,
  `/admin/:id/:leagueId/maps`). Scoreboard's existing `RescueMap` being
  stage-scoped is consistent with that (a league's "Main competition" stage
  owns its maps) — no change needed here.
- **D4 — Map Editor tech stack.** Table-of-`<td>` DOM grid (source) vs.
  canvas/SVG grid (recommended target, see §C). Decide before Phase 3a-3.
- **D5 — Schedule generator reuse.** Confirm whether to model this after
  scoreboard's existing Swiss-round generator preview/commit pattern
  (`soccer/fixtures/swiss.py`, `core/swiss_round_views.py`) structurally, or
  as a Rescue-owned service module. Recommend the former for consistency.

#### F. Suggested sub-phase breakdown

| Sub-phase | Scope | Depends on |
|---|---|---|
| 3a-1 | Tournament dashboard card grid + Teams/Rounds/Fields CRUD (tournament-scoped, per D2) | D1, D2 |
| 3a-2 | Maps list per league/stage + "Create new map" → blank editor redirect (no editor internals yet) | D3 |
| 3a-3 | Map Editor MVP: grid, tileset palette, dimensions, save/duplicate, JSON export/import | D4 |
| 3a-4 | Map Editor advanced: floors, victim/duration capsules, max-score calculator, PDF/PNG/scoresheet generation | 3a-3 |
| 3a-5 | Bulk Registration: CSV import + Generator (both modes), preview/commit | D5 |
| 3a-6 | Run overview: filter/browse/inline-adjustment-edit/status/bulk actions (scoring sub-pages stay Phase 3 scope) | 3a-5 |

#### G. Source reference index

| Feature | Route | Template | Controller JS | Model |
|---|---|---|---|---|
| Dashboard | `GET /admin/:id` | `admin/competition.pug` | — | `Competition` |
| Rounds | `GET /admin/:id/rounds` | `admin/round.pug` | `admin/round.js` | `models/competition.js:271` |
| Fields | `GET /admin/:id/fields` | `admin/field.pug` | `admin/field.js` | `models/competition.js:375` |
| Teams | `GET /admin/:id/teams` | `admin/team.pug` | `admin/team.js` | `models/competition.js` (`teamSchema`) |
| Teams bulk | `GET /admin/:id/teams/bulk` | `admin/team_bulk.pug` | `admin/team_bulk.js` | — |
| Maps list | `GET /admin/:id/:leagueId/maps` | `admin/maps.pug` | `admin/maps.js` | `models/lineMap.js`, `models/mazeMap.js` |
| Map Editor | `GET /admin/:id/:leagueId/mapEditor[/:mapid]` | `admin/mapEditor/{line,maze}_{rule}.pug` | `admin/mapEditor/{line,maze}_{rule}.js` | `models/lineMap.js`, `models/mazeMap.js` |
| Runs list | `GET /admin/:id/:leagueId/games` | `admin/games.pug` | `admin/games.js` | `models/lineRun.js`, `models/mazeRun.js`, `models/simRun.js` |
| Bulk registration | `GET /admin/:id/:leagueId/games/bulk` | `admin/games_bulk.pug` | `admin/games_bulk.js` | same run models |
| Scoring sub-pages | `/{line,maze}/{view,judge,input,check,sign}/:runid` | `view*/`, `judge/`, `manual/{input,check}/`, `sign/` per-rule templates | rule-specific JS | same run models |

### Phase 4: documents, review, registration, and team self-service

Deliverable: teams can register/self-serve, submit documents/files, and be
reviewed inside scoreboard.

Scope:

- Registration pass-code/email verification flow.
- Team document token pages.
- Document form config and answer storage.
- File upload/download under auth-checked views.
- Review assignment/comments, including `INTERVIEW` role mapping.
- Document-score integration for ranking modes that need it.
- MailAuth-like TTL token behavior for registration verification.

Acceptance:

- Deadlines/enable flags/public-token behavior match source CMS where retained.
- Team-token access cannot cross teams/tournaments.
- Reviewers see only assigned teams/questions.
- File paths are not guessable public media URLs.
- Document ranking integrates penalties and review weights.

### Phase 5: survey, reservation, cabinet, and mail

Deliverable: CMS self-service operations beyond documents work in scoreboard.

Scope:

- Survey config, targeting, answer submission, re-edit/fixed/deadline rules,
  survey file answers.
- Reservation config, slots, capacity, booking/cancel, admin override.
- Cabinet file repository with team-token and host access.
- Mail templates, delivery queue, link/open tracking, sent mail views, and team
  inbox.

Acceptance:

- Survey/reservation target team/league constraints are tested.
- Reservation capacity is transaction-safe.
- Cabinet access logs are preserved or intentionally replaced.
- Mail events and rewritten URL tokens are persisted.

### Phase 6: signage, short URLs, backup/restore, realtime, service editors

Deliverable: lower-frequency operations are ported or explicitly retired.

Scope:

- Signage playlist/media/display/refresh.
- Short URL redirect/admin.
- Backup export and restore import.
- Realtime replacement for run updates, field monitors, signage, reservation
  where still required.
- Service map/simulation editors.
- Kiosk decision: source route file exists but is not mounted in `app.js`; either
  port with evidence of use or mark retired.

Acceptance:

- Backup export includes the canonical source data set and media directories.
- Restore has a preview/destructive-confirm path.
- Realtime/polling behavior is tested at the service/view level.
- Retired source features are explicitly listed with evidence.

### Phase 7: cutover and validation

Deliverable: scoreboard can replace CMS for the migrated functionality.

Scope:

- Mongo -> Postgres/data/media backfill.
- Legacy URL compatibility or redirects, if required.
- Operator smoke tests for host, editor/judge, reviewer/interview, team token,
  and public viewer flows.
- Deployment media/queue/realtime environment variables documented in the
  target repo when actually introduced.

Acceptance:

- A seeded CMS competition can be imported and run through maps/runs/ranking and
  self-service flows.
- No source feature in the inventory is silently missing: each is migrated,
  intentionally retired with evidence, or blocked by a named prerequisite.

## Cutover infrastructure

The old plan assumed Express and a standalone Django service running side by
side with shared sessions and reverse-proxy path splits. That is no longer the
default target.

Default target:

- `rcj-scoreboard` is the Django deployment.
- CMS data is imported/backfilled into scoreboard models.
- Existing scoreboard auth/session handling remains authoritative.
- Any temporary Express coexistence is a migration bridge, not the architecture.

Bridge decisions, only if needed:

- Legacy route proxying for old clients or static assets.
- Redirects from old CMS URLs to `/t/<slug>/...`.
- One-off export/import commands for MongoDB and filesystem directories.
- Temporary compatibility APIs that preserve old response shapes.

## Verification discipline

Every phase must include targeted tests before it is marked integrated:

- model invariants
- service calculations
- view permissions
- file access
- import/backfill behavior
- old-vs-new behavior comparisons for critical source contracts

Run targeted pytest commands for the changed app/files. Do not rely on the old
standalone backend's tests as proof of scoreboard behavior.

## Phase 4/5: Self-Service Operations — concrete plan (researched 2026-07-11)

Deliverable: the CMS's team-facing self-service surface — registration,
document submission + review, questionnaires, and the file "cabinet" — plus
the admin mailing tool that notifies teams about all of it. This section
replaces Phase 4/5's previous scope-bullet-only text with a concrete,
source-verified plan at Phase 3a's rigor.

**Provenance.** Read directly from `rcj-rescue-cms-1/` (live 2026-rules CMS),
not `rcj-rescue-cms-migration/`: full read of `routes/api/{document,survey,
cabinet,mail,registration,ranking,teams,competitions}.js`, `routes/{document,
admin,mypage}.js`, `models/{competition,document,survey,mail,user}.js`,
every relevant Pug template and Angular controller, `helper/authLevels.js`,
`config/pass.js`. Cross-checked against `rcj-scoreboard/core/{models,forms,
scopes,mixins}.py`, `soccer/{models,inspection_views,inspection_photos}.py`
(the established private-file-serving pattern: `RobotPhoto` +
`RobotPhotoServeView`), and `core/{team_import_views,csv_import}.py` (an
**already-built** generic CSV team importer, see §A).

### Cross-cutting decision: one shared team self-service token

`Team.document.token` in the source is **not document-specific** — it is the
single bearer secret gating five subsystems' team-facing routes: document
submission, survey, reservation, cabinet, and the `/mypage` dashboard that
link them together. It is a permanent 32-char random string, generated once
at team creation, never rotated, never expiring (only the *content* deadline
gates editability, not token validity).

**Decision (binding for every sub-slice below): design this once.** Add
`RescueTeamProfile` (new model, `rescue/models.py`, one-to-one with
`core.Team`, **not** a field on `core.Team` itself — self-service is
Rescue-specific, `core.Team` is shared with `soccer`):

```python
class RescueTeamProfile(models.Model):
    team = models.OneToOneField(Team, on_delete=models.CASCADE, related_name="rescue_profile")
    access_token = models.CharField(max_length=43, unique=True, db_index=True)  # secrets.token_urlsafe(32)
    created_at = models.DateTimeField(auto_now_add=True)
```

A tournament-scoped, unauthenticated "team portal" URL namespace consumes it:

```
/t/<slug>/rescue/team/<int:team_pk>/<str:token>/            portal home ("mypage" equivalent)
/t/<slug>/rescue/team/<int:team_pk>/<str:token>/document/    document submission
/t/<slug>/rescue/team/<int:team_pk>/<str:token>/survey/<id>/ survey answer
/t/<slug>/rescue/team/<int:team_pk>/<str:token>/cabinet/     cabinet read-only view
```

Gated by exact `access_token` match against `RescueTeamProfile` (mirrors the
source's exact-string-compare, no hashing needed — matches magic-link's own
precedent of a random unguessable token as the entire security boundary) —
**not** `core.User`/`TournamentMembership` login, since CMS teams have no
scoreboard account and requiring one would be a real scope increase past
parity. Add an explicit **regenerate token** action for hosts (source has no
equivalent — a leaked link is permanent there; this is a deliberate
hardening, not silent parity).

`RescueTeamProfile` rows are created lazily (`get_or_create`) the first time
any self-service feature needs one for a team — teams created through
scoreboard's existing `TeamCreateView`/CSV import do **not** need a profile
until a host enables document submission, a survey targets them, etc.

### A. Teams & bulk registration — mostly already done

Scoreboard already has a complete, **stricter** Team CRUD + CSV bulk-import
stack that is functionally equivalent to (but not a literal copy of) the CMS
flow: `core/team_views.py`, `core/team_import_views.py`,
`core/csv_import.py`, `templates/team/*.html` — atomic commit, per-row
validation, upsert-by-name, all already tested. **Net-new work is narrow:**

1. Multi-league filter chips (Team code / Team / Region text + per-league
   checkboxes) on `templates/team/list_all.html`, which currently has none.
2. `Team.team_code` — CMS filters/sorts/inline-edits a `teamCode` field with
   no scoreboard equivalent; promote to a real column (JSON-vs-column rule:
   it's filtered and sorted). No uniqueness constraint in source; do not add
   one unless a host-facing need (kiosk check-in) demands it later.
3. Self-registration (pass-code + email verification, source:
   `routes/api/registration.js`, 2-step `POST /auth` → `POST /reg`, 30-minute
   TTL verification link) — this is the one genuinely new piece. Target:
   `RescueRegistrationConfig` (tournament+league scoped: `enabled`,
   `pass_code`, `deadline`) + a public 2-step view pair
   (`RescueRegistrationRequestView` sends a verification email via the Mail
   slice below; `RescueRegistrationConfirmView` consumes a short-lived token
   — reuse Django's `django.core.signing.TimestampSigner`, not a DB row with
   a manual TTL sweep — and creates the `Team` + `RescueTeamProfile`).
4. Do **not** port: `docPublic`/`checkin` (dead fields, confirmed unused
   anywhere in the source), the "Reset Kiosk" button (references an
   undefined function, dead UI), the CSV importer's Shift_JIS decoding,
   unbounded row count, or non-atomic partial-failure commit (regressions,
   not features — scoreboard's existing importer is already better).

### B. Cabinet — team file repository

Simplest slice: **no Mongoose model in the source at all** — files are
listed live off the filesystem, zero metadata persisted (no size, uploader,
or timestamp anywhere; same-name re-upload silently overwrites). Two folder
kinds share one flat namespace: per-**league** ("bulk distribution", visible
to every team in that league) and per-**team** ("individual distribution").

Target: model storage exactly on `soccer.RobotPhoto` +
`RobotPhotoServeView`/`RobotPhotoUploadView`/`RobotPhotoDeleteView`
(`soccer/models.py:2019-2087`, `soccer/inspection_views.py:424-451`) instead
of a live filesystem listing:

```python
class CabinetFile(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="cabinet_files")
    league = models.ForeignKey(League, on_delete=models.CASCADE, null=True, blank=True, related_name="cabinet_files")
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True, related_name="cabinet_files")
    file = models.FileField(upload_to=cabinet_file_path)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True, default="")
    size = models.PositiveBigIntegerField(default=0)          # new vs. source — never persisted there
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [CheckConstraint(check=(Q(league__isnull=False, team__isnull=True) |
                                                Q(league__isnull=True, team__isnull=False)),
                                        name="cabinetfile_exactly_one_of_league_or_team")]
```

Host views: browse (league/team folder picker, mirrors the two-grid admin
page), upload/delete (`HostRequiredMixin` — source gates cabinet at
`ACCESSLEVELS.ADMIN` only, no lesser tier). Team-portal view (read-only,
`Q(league=team.league) | Q(team=team)` merged queryset — one query instead
of the source's two client-side fetches). **Deliberate improvements over
source, not silent parity:** real upload size/type limits (source has none
beyond a bypassable client hint), collision-safe storage filenames (Django's
default `FileSystemStorage` already does this — keep `original_name` as the
display name), `post_delete` signal storage cleanup (reuse the `RobotPhoto`
pattern) instead of the source's three-different-route ad hoc `fs.unlink`.

### C. Document submission — team-facing form (review/scoring is a separate, larger sub-slice)

Source form config is a real JSON tree per league (`Competition.documents.
leagues[].blocks[]`, one row per league, 8 question types:
`input/select/scale/picture/movie/pdf/zip/run` — `run` is review-only,
7 apply to the team form). Zero server-side answer/upload validation in the
source (Quirk: total-map-overwrite PUT, multer with no `limits`/`fileFilter`
anywhere) — deliberate target hardening, not parity.

```python
class RescueDocumentConfig(models.Model):
    """One row per (tournament, league) -- confirmed flat in source, no stage concept."""
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="rescue_document_configs")
    league = models.OneToOneField(League, on_delete=models.CASCADE, related_name="rescue_document_config")
    enabled = models.BooleanField(default=False)
    default_deadline = models.DateTimeField(null=True, blank=True)
    max_length = models.PositiveIntegerField(null=True, blank=True)
    blocks = models.JSONField(default=list)   # [{block_id, title, color, questions:[{question_id, type, title, required, max_length, scale, options}]}]

class RescueTeamDocument(models.Model):
    """One-to-one with RescueTeamProfile -- per-team document submission state."""
    profile = models.OneToOneField(RescueTeamProfile, on_delete=models.CASCADE, related_name="document")
    enabled = models.BooleanField(default=True)
    public = models.BooleanField(default=False)
    deadline = models.DateTimeField(null=True, blank=True)   # per-team override; falls back to RescueDocumentConfig.default_deadline
    penalty_percent = models.PositiveSmallIntegerField(default=0)
    answers = models.JSONField(default=dict)   # {question_id: answer_value}

class RescueDocumentFile(models.Model):
    document = models.ForeignKey(RescueTeamDocument, on_delete=models.CASCADE, related_name="files")
    question_id = models.CharField(max_length=64)
    file = models.FileField(upload_to=rescue_document_file_path)
    original_name = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [UniqueConstraint(fields=["document", "question_id"], name="rescuedocumentfile_one_per_question")]
```

Views: `RescueDocumentConfigView` (host, builder — one screen, question
list editable inline, matches the source's autosave-on-blur pattern closely
enough with a plain Save button instead); team-portal `RescueDocumentFormView`
(GET renders blocks + current answers; POST validates `required`/`type`/
`max_length` server-side — the hardening decision — and file uploads go
through per-question-type extension/size allowlists: picture 5MB
image/*, movie 500MB video/mp4, pdf 20MB application/pdf, zip 50MB
application/zip, matching the source's own (client-only) caps as the
starting server-side numbers).

**Explicitly deferred, not silently dropped:** the reviewer scoring half
(`review`/`reviewed`/`assigned` pages, the `INTERVIEW` role, the
Olympic-trimmed-mean `getDocumentScore()` algorithm feeding
`MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT`/
`GAMES_DOCUMENT_CHALLENGE` ranking modes) is a genuinely separate,
large sub-slice — see "Known gaps" below. Submission must exist before
review can be tested meaningfully, so it comes first.

### D. Survey / Questionnaire

```python
class Survey(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="surveys")
    leagues = models.ManyToManyField(League, blank=True, related_name="targeted_surveys")
    teams = models.ManyToManyField(Team, blank=True, related_name="targeted_surveys")
    enabled = models.BooleanField(default=False)
    opens_at = models.DateTimeField()
    deadline = models.DateTimeField()
    allow_reedit = models.BooleanField(default=False)
    i18n = models.JSONField(default=list)
    questions = models.JSONField(default=list)   # [{question_id, type, title, description, scale, options:[{key,label}], teamvote_leagues}]

class SurveyAnswer(models.Model):
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="answers")
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="survey_answers")
    fixed = models.BooleanField(default=False)
    answers = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        constraints = [UniqueConstraint(fields=["survey", "team"], name="surveyanswer_one_per_team")]

class SurveyFileAnswer(models.Model):
    answer = models.ForeignKey(SurveyAnswer, on_delete=models.CASCADE, related_name="files")
    question_id = models.CharField(max_length=64)
    file = models.FileField(upload_to=survey_answer_file_path)
    class Meta:
        constraints = [UniqueConstraint(fields=["answer", "question_id"], name="surveyfileanswer_one_per_question")]
```

Question types: `explanationOnly` (no input), `input` (rich text),
`select`, `scale`, `file`, `teamVote` — the last stores a **`Team` FK**, not
the source's fragile display-string ("teamCode name"), a deliberate fix.
Targeting is `leagues` OR `teams`; **fix the source's "both empty matches no
one even if enabled" trap** — treat both-empty as "target the whole
tournament" (behavior change, worth it — the source shape is a footgun, not
a feature). Gating is three independent, server-validated conditions exactly
as in source: `opens_at` (visibility), `deadline` (write cutoff, hosts
bypass), `allow_reedit`/`fixed` (resubmission lock — first full submission
sets `fixed=True` unless `allow_reedit`; a file-only upload before the real
submit leaves `fixed=False` so teams can draft). **Fix the source's own
bug**: gate the team-portal page render on `opens_at` too, not just the API
(source shows a broken-looking editable shell before the survey opens).

### E. Mail

Source: per-recipient `mail` row (bulk send to N teams = N rows), Bull/Redis
queue (`mailQueue`, 1 job type `'send'`, global 1-msg/sec rate limit),
href-rewrite click tracking + 1×1-pixel open tracking, a flat-file
admin-editable template pool (10 files, 6 are system-triggered
`_`-prefixed and undeletable-in-UI, 4 are pure compose-time picks with no
programmatic trigger).

**Scoreboard has no async task runner today** (no Celery/RQ/django-q in
`pyproject.toml`; the one existing send site, `core/auth_views.py`'s
magic-link email, is synchronous). Recommend: **ship synchronous sending
first** (acceptable at tournament team-count scale, matches the existing
precedent exactly) with the exact same tracked-row/status-history shape as
the source, and treat a background queue as a documented follow-up rather
than a blocker — do not silently drop tracking/history to avoid the queue
decision.

```python
class OutboundEmail(models.Model):
    """core, not rescue -- generic per-Tournament infra, zero Rescue-run coupling."""
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        OPENED = "opened", "Opened"
        CLICKED = "clicked", "Clicked"
        ERROR = "error", "Error"
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="outbound_emails")
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    tracking_token = models.CharField(max_length=43, unique=True, db_index=True)
    to_email = models.EmailField()
    subject = models.CharField(max_length=255)
    html_body = models.TextField()
    plain_body = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED)
    reserved_for = models.DateTimeField(null=True, blank=True)
    click_map = models.JSONField(default=dict)     # {token: original_url}
    events = models.JSONField(default=list)        # [{time, event}]
    created_at = models.DateTimeField(auto_now_add=True)

class MailTemplate(models.Model):
    """DB-backed (not files) -- preserves the source's runtime-admin-editable
    workflow, which is the entire reason mail_templates.pug exists."""
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, null=True, blank=True, related_name="mail_templates")  # null = built-in/system
    name = models.CharField(max_length=120)
    subject = models.CharField(max_length=255)
    html_body = models.TextField()
    is_system = models.BooleanField(default=False)   # replaces the source's `name.startswith('_')` convention
```

Views: compose (host, team picker with the same filter-chip pattern as §A +
Teams list, template pick, `${var}` preview, send-now/schedule-later),
sent-log (status-colored table, detail modal), template manager
(`HostRequiredMixin` — **tighten** the source's over-broad global-admin gate
to per-tournament `can_edit_tournament`, a deliberate, documented behavior
change per Decision D-Mail-6 below). Click/open tracking: two small
unauthenticated views keyed by `tracking_token`, ported close to verbatim
(this part of the source is straightforward and correct). **Do not port**
the source's `mailAttachment/` CID mechanism (writes a URL string, not
bytes, then reads it back as UTF-8 text — a confirmed bug, not a feature);
leave embedded images as external `<img src>` URLs instead.

### F. Decisions recorded (binding unless revisited)

- **Token model**: one `RescueTeamProfile.access_token` shared by every
  self-service surface (§ cross-cutting decision above). Not per-subsystem.
- **`RescueDocumentConfig`/`Survey` scope**: `(Tournament, League)`, not
  `Stage` — source has no stage concept, config is flatly per-league.
- **Question/block identity**: every JSON-tree question/block gets a
  server- or client-minted stable string id (UUID4 hex is fine) at creation
  time — required for `answers`/`comments` to address them at all. Fixes the
  source's option-identity bugs (`moveOption` swapping only the label,
  `optionN`-by-position colliding after delete+add cycles) by construction.
- **Server-side validation**: document/survey answer and file-upload
  validation is added server-side (required/type/max_length/extension/size)
  — the source has essentially none. Explicit hardening, not parity.
- **Mail queue**: synchronous send now; background queue is a named,
  deferred follow-up, not a blocker.
- **Mail template storage**: DB-backed `MailTemplate`, not flat files —
  preserves the admin-editable-at-runtime workflow that's the point of the
  source feature.
- **Permission tightening**: every "global CMS-admin flag, independent of
  per-competition access" gate found in the source (mail send/templates,
  cabinet, teams-admin API) collapses onto scoreboard's existing
  `HostRequiredMixin`/`can_edit_tournament` — do not invent a scoreboard
  equivalent of the source's redundant/inconsistent global-admin layer.
- **Deferred to a later pass, tracked not forgotten**: Document review
  scoring (`INTERVIEW` role, `review`/`reviewed`/`assigned` pages,
  `getDocumentScore()`'s trimmed-mean algorithm — needed to unblock the two
  document-dependent ranking modes already noted as a gap); Reservation
  (slot booking, not requested in this pass); self-registration's exact
  token-TTL implementation choice (signed token vs. DB row + sweep).

### G. Quirks catalogue (record, do not silently reproduce or silently fix)

- CMS's `Team.document.deadline` is Mongoose-typed `String` while the
  competition-wide default is `Number` — works via JS coercion, structurally
  inconsistent. Port as a real `DateTimeField`.
- `docPublic`/`checkin` top-level `Team` fields are write-only dead code.
- Three document routes (`do_interview`/`pub_interview`/`view_interview`)
  reference Pug templates that don't exist in the repo — confirmed dead,
  not ported.
- `authCompetitionRole()` throws instead of denying for a user with some
  competition grants but none for the one being checked — a real source
  bug, not reproduced (scoreboard's permission helpers already return
  bool, never raise, for this class of check).
- Cabinet's team-token folder override protects team folders but not league
  folders (any team token can browse any league's broadcast folder in the
  same tournament) — carried forward as acceptable (league folders are
  intentionally broadcast), team folders remain protected.

