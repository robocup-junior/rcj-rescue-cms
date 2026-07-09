# RCJ Rescue CMS Project UI Skill

Use this skill for future UI/admin-page work in this repository.

## Purpose

Preserve project-specific UI decisions so future tasks do not need to rediscover them from scratch.

## Admin table/list standard

The full admin table/list style guide lives in `doc/table-style-guide.md` — read that
file for the canonical `.base-table*` markup, grid-column conventions, and the
multi-action dropdown pattern. Don't duplicate its content here; extend it there and
just note new decisions in this file as they come up.

Quick pointers:

- Canonical style is `.base-table*` in `public/stylesheets/common/modern_list.css`. Visual reference: the Maps admin list.
- Bulk/widget-level actions go in `.modern-card-header`, never in the table header (which is column labels + select-all only).
- **Use the `.dropdown.table-action-dropdown` pattern whenever a row has more than one action** — this applies even to small/simple tables. Example: `views/admin/round.pug` and `views/admin/field.pug` have a single delete action (plain `.btn-table-action` button is fine there), but `views/admin/competition_settings.pug`'s authority table collapsed 5 separate Bootstrap buttons (`btn-secondary`/`btn-info`/`btn-primary`/`btn-success`/`btn-outline-warning`) per row into one dropdown — don't try to force many actions into distinct colored buttons, the modern system only really has neutral/`.primary`/`.danger`.
- Converted so far to `.base-table`: `views/admin/team.pug`, `views/document/team_admin.pug`, `views/document/reviewStatus.pug`, `views/admin/round.pug`, `views/admin/field.pug`, `views/admin/competition_settings.pug` (authority table).

## Wide tables vs. the default content container

`views/includes/modern_layout.pug` wraps `block main_content` in a `.maps-container`
div (`max-width: 1200px; margin: 0 auto;` in `modern_layout.css`). Any page with a
table wider than that (grid `min-width` on the base-table) needs to opt out by
setting a local var in `block vars`:

```pug
block vars
  - var contentContainerStyle = "max-width: 100%;"
```

See `views/document/reviewStatus.pug` for a working example. Without this, a wide
`.base-table` just gets clipped/scroll-boxed inside the 1200px container.

## Status/role chips

For a compact colored status or role indicator in a table cell, use a small
pill-shaped `<span>` with a border + tinted background in the accent color, e.g.
`.authority-chip` + a `.chip-*` variant class scoped in the page's own `append css`
block (see `views/admin/competition_settings.pug`'s authority table: chips for
Super/Admin/Judge/View/No-access roles, and a yellow `chip-interview` chip with a
`fa-check-square` icon that's only rendered when the flag is true — no chip at all
otherwise, don't render an empty/disabled chip).

Note: `views/admin/games.pug` already has a `span.badge.badge-pill` status chip for
line-run status — that one is deliberately tiny (default Bootstrap badge sizing) and
was judged too small for a table meant to be scanned at a glance. Don't copy that
one; use the bigger/bolder pill style described above instead
(`padding: 0.4rem 0.9rem`, `border-radius: 2rem`, `font-weight: 800`).

Chips in a column should be left-aligned, not centered — grid items default to
`justify-self: stretch`, which is fine, but if you add a page-specific CSS rule to
widen a role/status column, also add `justify-self: start; text-align: left;`
scoped to that column's cell class so the chip doesn't drift/center as the column
grows.

## Project tree reference

`.claude/skills/rcj-rescue-cms/PROJECT_TREE.md` is a generated file listing, meant
to make finding paths fast without grepping the whole repo. It's built from
`git ls-files --cached --others --exclude-standard`, so it automatically respects
`.gitignore` — no manual exclude list to maintain. Directories with more than 20
files are collapsed to a one-line summary *only* when those files are predominantly
generated/binary assets (images, fonts, db files, vendor bundles); source-heavy
directories (routes, views, js, etc.) are always listed in full regardless of size,
so it stays useful for "where does X live" questions.

Regenerate it after large file-adds/removals with:

```
python3 .claude/skills/rcj-rescue-cms/scripts/generate_project_tree.py
```

(One known oddity: `db/` is tracked in git despite being local MongoDB runtime data
(WiredTiger files) — it's not gitignored, so it still shows up in the tree, just
collapsed since it's binary. Worth flagging to the user if it comes up; not fixed
here since it wasn't part of the ask.)
