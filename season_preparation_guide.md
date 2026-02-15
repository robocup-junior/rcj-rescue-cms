# RCJ Rescue CMS - New Season Preparation Guide

This document outlines the general steps required to prepare the RCJ Rescue CMS for a new competition season. This guide can be used as a reference when preparing for future seasons (e.g., preparing 2027 season after this year is 2026).

## Overview

The RCJ Rescue CMS maintains support for the current and previous year's competition rules. Each season requires updating the system to support the new rules while removing support for rules that are more than 2 years old.

## General Steps for New Season Preparation

### 1. Update Package Version
- Update the version in `package.json` to reflect the new season (e.g., from "26.x.x" to "27.0.0-alpha.0")

### 2. Update League Configuration
- Modify `leagues.json` to replace the oldest supported season with the new season
- The system typically supports the current and previous year (e.g., when adding 2027, keep 2027 and 2026, remove 2025 support)

### 3. Create New Rule Files
- Create new rule implementation files by copying from the previous year:
  - Copy scoring calculation rules (e.g., copy `2025.js` to `2027.js`)
  - Copy PDF generation rules for line/maze competitions
  - Copy other rule-specific helper files

### 4. Update JavaScript Files
- Create new JavaScript files for the new season by copying from previous years:
  - Copy admin interface files (map editor, game print, etc.)
  - Copy judge interface files
  - Copy manual input files
  - Copy ranking display files
  - Copy signage files
  - Copy simulation editor files

### 5. Create New Template Files
- Create new Pug template files for the new season by copying from previous years:
  - Copy view templates for all interfaces (admin, judge, manual, ranking, etc.)
  - Update templates as needed to reference the new season
  - Add any new modal or component templates if required

### 6. Update System Logic
- Update any system logic that references specific season numbers
- Modify rule check conditions in helper functions to include the new season
- Update initialization and configuration files to recognize the new season

### 7. Remove Outdated Support
- Remove rule implementation files for seasons that are more than 2 years old
- Delete outdated template files for unsupported seasons
- Remove any JavaScript files no longer needed

### 8. Test Implementation
- Verify all interfaces work with the new season rules
- Test scoring calculations for accuracy
- Confirm all admin and judge features function properly
- Validate PDF generation and other output formats

## Key Principles

1. **Maintain 2-Year Support**: The system should always support the current and previous season only
2. **Conservative Changes**: Start by copying existing implementations rather than building from scratch
3. **Consistency**: Ensure all parts of the system (UI, logic, templates) are updated consistently
4. **Documentation**: Update any documentation to reflect the new season support

## Files Commonly Updated

- `package.json` - version updates
- `leagues.json` - league and rule configuration
- `helper/scoreCalculatorRules/` - scoring logic for each season
- `helper/scoreSheetPDF*Rules/` - PDF generation rules
- `public/javascripts/` - frontend logic for different interfaces
- `views/` - template files for various pages
- `routes/` - API endpoints that may need season-specific handling

## Important Notes

- Always maintain the same file naming conventions (e.g., `2027.js`, `line_2027.js`, `line_2027.pug`)
- Back up the system before making season updates
- Test thoroughly across all supported competition types (line, maze, simulation)
- Update any season-specific constants or configurations

## Reference Implementation

For a concrete example of how to implement a new season, refer to the 2026 season implementation commit:
https://github.com/robocup-junior/rcj-rescue-cms/commit/9afe809b6e4f7ddf768c14d3e2ac8963dd79dfc4