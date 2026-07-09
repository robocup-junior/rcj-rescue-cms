# Admin Table Style Guide

## Base style

The canonical admin table/list style is the row-table pattern in `public/stylesheets/common/modern_list.css`:

- `.base-table`
- `.base-table-header`
- `.base-table-row`
- `.base-table-cell`
- `.base-table-selection`
- `.base-table-icon`
- `.base-table-name`
- `.base-table-actions`

The visual reference is the Maps admin list: compact rows, pale header, checkbox column, blue icon block, strong primary label, subtle separators, left accent line, and right-aligned row actions.

Use this pattern for interactive admin tables where rows have selection, editing, navigation, or per-row actions. Do not introduce a second row/table visual style for these widgets.

## Widget header actions

Bulk or widget-level actions belong in the surrounding widget header, not inside the table header.

Examples:

- bulk delete selected rows
- Reset Kiosk
- export/print actions for the whole widget
- widget-level toggles

The table header is only for column labels and select-all controls.

## Recommended structure

```pug
.modern-card.section-gap
  .modern-card-header
    .d-flex.justify-content-between.align-items-center.w-100
      div
        i.fas.fa-list
        | Widget title
      .btn-table-group
        div.btn-table-action
          i.fas.fa-toolbox
          | Widget action
  .modern-card-body.p-0
    .base-table
      .base-table-header
        .base-table-selection
          .custom-checkbox
        .base-table-cell
        .base-table-cell Name
        .base-table-cell.text-right Operation
      .base-table-row
        .base-table-selection
          .custom-checkbox
        .base-table-icon
          i.fas.fa-map-marked-alt
        .base-table-cell
          span.base-table-name Row name
        .base-table-actions
          .dropdown.table-action-dropdown
            button.btn-table-action.dropdown-toggle(type='button', data-toggle='dropdown')
              | Action
            .dropdown-menu.dropdown-menu-right
              button.dropdown-item(type='button')
                i.fas.fa-pen
                | Edit
```

## Operation column actions

When an operation column has more than one action, use the existing dropdown action button style. Do not add page-specific button CSS for this case.

```pug
.base-table-actions
  .dropdown.table-action-dropdown
    button.btn-table-action.dropdown-toggle(type='button', data-toggle='dropdown', aria-haspopup='true', aria-expanded='false')
      | {{"common.action" | translate}}
    .dropdown-menu.dropdown-menu-right
      button.dropdown-item(type='button')
        i.fas.fa-pen
        | {{"common.edit" | translate}}
```

## Page-specific columns

Define page-specific grid columns by scoping to the page table class:

```css
.teams-base-table .base-table-header,
.teams-base-table .base-table-row {
  grid-template-columns: 40px 36px minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(8rem, auto);
}
```

Keep the base row visuals in `modern_list.css`; only column widths and page-specific edit controls should live in page CSS.

## Editing rows

Inline edit controls should stay inside their row cells. If a row can edit collection fields, such as multiple email addresses, show explicit add/remove controls inside the relevant cell and keep row-level operations behind the existing `.dropdown.table-action-dropdown` action button.
