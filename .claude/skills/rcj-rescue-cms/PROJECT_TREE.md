# RCJ Rescue CMS Project Tree

Generated: 2026-07-09

This tree is intended as context for future coding tasks (finding paths quickly).
It is derived from `git ls-files --cached --others --exclude-standard`, so anything
matched by `.gitignore` (node_modules, cabinet/, backup/, documents/, tmp/, logs/,
public/components, fonts/, etc.) is excluded automatically -- regenerate the same
way to keep this in sync with .gitignore.

A directory's file listing is collapsed to a `[N files - extensions]` summary line
when it has more than 20 files AND those files are predominantly
generated/binary assets (images, fonts, db files, vendor bundles) -- source-heavy
directories (routes, views, js, etc.) are always listed in full regardless of size.

```text
.
├── .claude/
│   └── skills/
│       ├── cms-migration/
│       │   ├── MIGRATION_PLAN.md
│       │   └── SKILL.md
│       └── rcj-rescue-cms/
│           ├── scripts/
│           │   └── generate_project_tree.py
│           ├── PROJECT_TREE.md
│           └── SKILL.md
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── feature_request.yml
│   │   └── general_issue.yml
│   ├── workflows/
│   │   ├── build.yml
│   │   └── codeql-analysis.yml
│   └── pull_request_template.md
├── backend/
│   ├── cms_migration/
│   │   ├── __init__.py
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── cms_users/
│   │   ├── migrations/
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── compat_auth/
│   │   ├── management/
│   │   │   └── commands/
│   │   │       └── create_default_admin.py
│   │   ├── migrations/
│   │   │   ├── 0001_initial.py
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── auth.py
│   │   ├── models.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── competitions/
│   │   ├── migrations/
│   │   │   ├── 0001_initial.py
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── devdemo/
│   │   ├── migrations/
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── shorturl/
│   │   ├── migrations/
│   │   │   ├── 0001_initial.py
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── signage/
│   │   ├── migrations/
│   │   │   ├── 0001_initial.py
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── manage.py
│   └── requirements.txt
├── config/
│   ├── db.js
│   ├── logger.js
│   └── pass.js
├── db/
│   ├── diagnostic.data/
│   │   ├── metrics.2021-02-04T05-46-00Z-00000
│   │   ├── metrics.2021-02-04T05-49-06Z-00000
│   │   ├── metrics.2021-02-08T19-03-05Z-00000
│   │   ├── metrics.2021-02-13T20-05-24Z-00000
│   │   ├── metrics.2021-02-14T20-09-40Z-00000
│   │   ├── metrics.2021-02-14T20-36-43Z-00000
│   │   ├── metrics.2021-02-15T16-31-09Z-00000
│   │   ├── metrics.2021-02-15T16-42-37Z-00000
│   │   ├── metrics.2021-02-15T16-59-24Z-00000
│   │   ├── metrics.2021-02-15T17-12-36Z-00000
│   │   ├── metrics.2021-02-15T17-23-19Z-00000
│   │   ├── metrics.2021-02-15T17-44-26Z-00000
│   │   └── metrics.interim
│   ├── journal/
│   │   ├── WiredTigerLog.0000000012
│   │   └── WiredTigerLog.0000000013
│   └── [66 files - .bson, .lock, .turtle, .wt, listing omitted]
├── doc/
│   ├── css/
│   │   └── style.css
│   ├── img/
│   │   ├── favicon.ico
│   │   ├── glyphicons-halflings-white.png
│   │   └── glyphicons-halflings.png
│   ├── locales/
│   │   ├── ca.js
│   │   ├── de.js
│   │   ├── es.js
│   │   ├── fr.js
│   │   ├── it.js
│   │   ├── locale.js
│   │   ├── nl.js
│   │   ├── pl.js
│   │   ├── pt_br.js
│   │   ├── ru.js
│   │   ├── zh.js
│   │   └── zh_cn.js
│   ├── utils/
│   │   ├── handlebars_helper.js
│   │   └── send_sample_request.js
│   ├── vendor/
│   │   ├── path-to-regexp/
│   │   │   ├── LICENSE
│   │   │   └── index.js
│   │   ├── prettify/
│   │   │   └── [31 files - .css, .js, listing omitted]
│   │   ├── bootstrap-responsive.min.css
│   │   ├── bootstrap.min.css
│   │   ├── bootstrap.min.js
│   │   ├── diff_match_patch.min.js
│   │   ├── handlebars.min.js
│   │   ├── jquery.min.js
│   │   ├── lodash.min.js
│   │   ├── polyfill.js
│   │   ├── prettify.css
│   │   ├── require.min.js
│   │   ├── semver.min.js
│   │   └── webfontloader.js
│   ├── api_data.js
│   ├── api_data.json
│   ├── api_project.js
│   ├── api_project.json
│   ├── index.html
│   ├── main.js
│   └── table-style-guide.md
├── docker/
│   ├── mongodb.repo
│   ├── nginx.conf
│   ├── nginx.repo
│   └── start.sh
├── fonts/
│   └── .gitignore
├── helper/
│   ├── lineSSR/
│   │   ├── 2026.js
│   │   └── index.js
│   ├── mazeSSR/
│   │   ├── 2026.js
│   │   └── index.js
│   ├── scoreCalculatorRules/
│   │   ├── 2025.js
│   │   ├── 2025E.js
│   │   ├── 2026.js
│   │   └── 2026E.js
│   ├── scoreSheetPDFLineRules/
│   │   ├── 2025.js
│   │   └── 2026.js
│   ├── scoreSheetPDFMazeRules/
│   │   ├── 2025.js
│   │   └── 2026.js
│   ├── authLevels.js
│   ├── crypto.js
│   ├── initRunData.js
│   ├── lineMapPDF.js
│   ├── mailSender.js
│   ├── mazeFill.js
│   ├── mazeMapPDF.js
│   ├── pathFinder.js
│   ├── query-helper.js
│   ├── ruleDetector.js
│   ├── scoreCalculator.js
│   ├── scoreSheetPDFLine2.js
│   ├── scoreSheetPDFMaze2.js
│   ├── scoreSheetPDFUtil.js
│   └── scoreSheetUtil.js
├── models/
│   ├── competition.js
│   ├── document.js
│   ├── lineMap.js
│   ├── lineRun.js
│   ├── mail.js
│   ├── mazeMap.js
│   ├── mazeRun.js
│   ├── reservation.js
│   ├── shortURL.js
│   ├── simRun.js
│   ├── survey.js
│   └── user.js
├── public/
│   ├── fonts/
│   │   ├── inter/
│   │   │   ├── Inter-Bold.ttf
│   │   │   └── Inter-Regular.ttf
│   │   └── outfit/
│   │       ├── Outfit-Black.ttf
│   │       ├── Outfit-Bold.ttf
│   │       ├── Outfit-ExtraBold.ttf
│   │       ├── Outfit-Light.ttf
│   │       ├── Outfit-Regular.ttf
│   │       └── Outfit-SemiBold.ttf
│   ├── images/
│   │   ├── cognitive_rings/
│   │   │   └── [100 files - .png, listing omitted]
│   │   ├── cognitive_targets/
│   │   │   └── [3125 files - .png, listing omitted]
│   │   ├── curvedWall/
│   │   │   └── [21 files - .png, listing omitted]
│   │   ├── dice/
│   │   │   ├── 1.png
│   │   │   ├── 2.png
│   │   │   ├── 3.png
│   │   │   ├── 4.png
│   │   │   ├── 5.png
│   │   │   ├── 6.png
│   │   │   └── undefined.png
│   │   ├── evacZone/
│   │   │   ├── green_lv1.png
│   │   │   ├── green_lv1_a.png
│   │   │   ├── green_lv2.png
│   │   │   ├── green_lv2_a.png
│   │   │   ├── red_lv1.png
│   │   │   ├── red_lv1_a.png
│   │   │   ├── red_lv2.png
│   │   │   └── red_lv2_a.png
│   │   ├── leagues/
│   │   │   ├── Line.png
│   │   │   ├── LineNL.png
│   │   │   ├── Maze.png
│   │   │   ├── MazeNL.png
│   │   │   ├── line.png
│   │   │   ├── maze.png
│   │   │   └── simulation.png
│   │   ├── letter_victims/
│   │   │   ├── harmed.png
│   │   │   ├── stable.png
│   │   │   └── unharmed.png
│   │   ├── mapimage/
│   │   │   ├── bump1.png
│   │   │   ├── bump2.png
│   │   │   ├── bump3.png
│   │   │   ├── bump4.png
│   │   │   ├── bump5.png
│   │   │   ├── down.png
│   │   │   ├── obstacle.png
│   │   │   ├── ramp.png
│   │   │   ├── start.png
│   │   │   ├── start2.png
│   │   │   └── up.png
│   │   ├── ranking/
│   │   │   ├── 1.png
│   │   │   ├── 2.png
│   │   │   ├── 3.png
│   │   │   ├── Maze-ranking.png
│   │   │   ├── NL-ranking.png
│   │   │   └── WL-ranking.png
│   │   ├── tiles/
│   │   │   └── [98 files - .png, listing omitted]
│   │   └── [138 files - .gif, .ico, .jpg, .json, .png, .xml, listing omitted]
│   ├── javascripts/
│   │   ├── admin/
│   │   │   ├── documents/
│   │   │   │   └── reviewStatus.js
│   │   │   ├── gamesPrint/
│   │   │   │   ├── line_2025.js
│   │   │   │   ├── line_2025E.js
│   │   │   │   ├── line_2026.js
│   │   │   │   ├── line_2026E.js
│   │   │   │   ├── maze_2025.js
│   │   │   │   ├── maze_2026.js
│   │   │   │   ├── simulation_2025.js
│   │   │   │   └── simulation_2026.js
│   │   │   ├── mapEditor/
│   │   │   │   ├── line_2025.js
│   │   │   │   ├── line_2025E.js
│   │   │   │   ├── line_2026.js
│   │   │   │   ├── line_2026E.js
│   │   │   │   ├── maze_2025.js
│   │   │   │   ├── maze_2025E.js
│   │   │   │   ├── maze_2026.js
│   │   │   │   └── maze_2026E.js
│   │   │   ├── competition.js
│   │   │   ├── competition_backup.js
│   │   │   ├── competition_settings.js
│   │   │   ├── field.js
│   │   │   ├── games.js
│   │   │   ├── games_bulk.js
│   │   │   ├── home.js
│   │   │   ├── maps.js
│   │   │   ├── round.js
│   │   │   ├── team.js
│   │   │   └── team_bulk.js
│   │   ├── cabinet/
│   │   │   ├── admin.js
│   │   │   └── file.js
│   │   ├── document/
│   │   │   ├── admin.js
│   │   │   ├── assigned.js
│   │   │   ├── form.js
│   │   │   ├── form_editor.js
│   │   │   ├── form_preview.js
│   │   │   ├── publicFiles.js
│   │   │   ├── result.js
│   │   │   ├── review.js
│   │   │   ├── review_editor.js
│   │   │   ├── reviewed.js
│   │   │   └── team_admin.js
│   │   ├── judge/
│   │   │   ├── line_2025.js
│   │   │   ├── line_2025E.js
│   │   │   ├── line_2026.js
│   │   │   ├── line_2026E.js
│   │   │   ├── maze_2025.js
│   │   │   ├── maze_2025E.js
│   │   │   ├── maze_2026.js
│   │   │   ├── maze_2026E.js
│   │   │   ├── simulation_2025.js
│   │   │   └── simulation_2026.js
│   │   ├── manual/
│   │   │   ├── line_2025.js
│   │   │   ├── line_2026.js
│   │   │   ├── maze_2025.js
│   │   │   └── maze_2026.js
│   │   ├── mypage/
│   │   │   └── my.js
│   │   ├── ranking/
│   │   │   ├── line_2025.js
│   │   │   ├── line_2026.js
│   │   │   ├── line_2026E.js
│   │   │   ├── maze_2025.js
│   │   │   ├── maze_2026.js
│   │   │   ├── maze_2026E.js
│   │   │   ├── simulation_2025.js
│   │   │   └── simulation_2026.js
│   │   ├── registration/
│   │   │   ├── authError.js
│   │   │   ├── form.js
│   │   │   ├── settings.js
│   │   │   └── top.js
│   │   ├── reservation/
│   │   │   ├── admin.js
│   │   │   ├── form.js
│   │   │   ├── list.js
│   │   │   └── settings.js
│   │   ├── sign/
│   │   │   ├── line_2025.js
│   │   │   ├── line_2025E.js
│   │   │   ├── line_2026.js
│   │   │   ├── line_2026E.js
│   │   │   ├── maze_2025.js
│   │   │   ├── maze_2025E.js
│   │   │   ├── maze_2026.js
│   │   │   ├── maze_2026E.js
│   │   │   ├── simulation_2025.js
│   │   │   └── simulation_2026.js
│   │   ├── signage/
│   │   │   ├── clock.js
│   │   │   ├── editor.js
│   │   │   ├── field_view.js
│   │   │   ├── files.js
│   │   │   ├── game_monitor.js
│   │   │   └── setting.js
│   │   ├── sim_editor/
│   │   │   ├── sim_editor.2025.js
│   │   │   └── sim_editor.2026.js
│   │   ├── survey/
│   │   │   ├── answers.js
│   │   │   ├── edit.js
│   │   │   ├── form.js
│   │   │   └── list.js
│   │   ├── technicalChallenge/
│   │   │   └── scoring.js
│   │   ├── access_denied.js
│   │   ├── admin_restore.js
│   │   ├── admin_short.js
│   │   ├── admin_user.js
│   │   ├── competition_home.js
│   │   ├── deflate.js
│   │   ├── dummy.json
│   │   ├── home.js
│   │   ├── inflate.js
│   │   ├── inspection.js
│   │   ├── jquery.slideToUnlock.js
│   │   ├── line_competition.js
│   │   ├── login.js
│   │   ├── lvl-uuid.js
│   │   ├── mail_home.js
│   │   ├── mail_sent.js
│   │   ├── mail_template_editor.js
│   │   ├── mail_templates.js
│   │   ├── main_signage.js
│   │   ├── makeQR.js
│   │   ├── maze_competition.js
│   │   ├── mypage.js
│   │   ├── opencv.js
│   │   ├── pathFinder.js
│   │   ├── scanner.js
│   │   ├── simulation_competition.js
│   │   ├── table_dropdown_overflow.js
│   │   ├── team_home.js
│   │   ├── tileset_admin.js
│   │   └── translate_config.js
│   ├── lang/
│   │   ├── en.json
│   │   └── ja.json
│   ├── signage_content/
│   │   ├── boot.html
│   │   ├── logo.png
│   │   ├── rankingMaze.png
│   │   ├── rankingNL.png
│   │   ├── rankingWL.png
│   │   └── refresh.html
│   ├── sounds/
│   │   ├── click.mp3
│   │   ├── click2.mp3
│   │   ├── error.mp3
│   │   ├── info.mp3
│   │   └── timeup.mp3
│   ├── stylesheets/
│   │   ├── admin/
│   │   │   ├── mapEditor/
│   │   │   │   ├── line_modern.css
│   │   │   │   ├── maze_edit.css
│   │   │   │   └── maze_modern.css
│   │   │   ├── final_ranking.css
│   │   │   └── live_ranking.css
│   │   ├── common/
│   │   │   ├── modern_components.css
│   │   │   ├── modern_editor.css
│   │   │   ├── modern_layout.css
│   │   │   ├── modern_list.css
│   │   │   └── modern_modal.css
│   │   ├── competition_premium.css
│   │   ├── error_premium.css
│   │   ├── fonts.css
│   │   ├── fredrik.css
│   │   ├── home_premium.css
│   │   ├── judge.css
│   │   ├── maze.css
│   │   ├── my_premium.css
│   │   ├── mypage_premium.css
│   │   ├── navbar_premium.css
│   │   ├── scanner_modern.css
│   │   ├── sim_edit.css
│   │   ├── slideToUnlock.css
│   │   ├── stg.css
│   │   ├── style-login.css
│   │   ├── style.css
│   │   └── toggle-switch.css
│   ├── templates/
│   │   ├── sim_editor/
│   │   │   ├── custom_room_4_modal.2025.html
│   │   │   ├── custom_room_4_modal.2026.html
│   │   │   ├── sim_editor_modal.2025.html
│   │   │   └── sim_editor_modal.2026.html
│   │   ├── line_editor_modal.html
│   │   ├── line_judge_modal.html
│   │   ├── line_view_modal.html
│   │   ├── maze_cognitive_target_modal_2026.html
│   │   ├── maze_editor_modal.html
│   │   ├── maze_editor_modal_2025.html
│   │   ├── maze_editor_modal_2025E.html
│   │   ├── maze_editor_modal_2026.html
│   │   ├── maze_editor_modal_2026E.html
│   │   ├── maze_judge_modal_2026.html
│   │   ├── maze_view_modal_2025.html
│   │   ├── maze_view_modal_2026.html
│   │   ├── tile.html
│   │   └── tile4Image.html
│   ├── tmp/
│   │   ├── run_bulk.csv
│   │   └── team_bulk.csv
│   ├── manifest.json
│   └── robots.txt
├── queue/
│   ├── backupQueue.js
│   └── mailQueue.js
├── rcjj-scoring/
│   ├── 1.png
│   ├── 2.png
│   ├── 3.png
│   ├── 4.png
│   ├── 5.png
│   ├── 6.png
│   └── 7.png
├── routes/
│   ├── api/
│   │   ├── auth.js
│   │   ├── backup.js
│   │   ├── cabinet.js
│   │   ├── competitions.js
│   │   ├── document.js
│   │   ├── fields.js
│   │   ├── lineMaps.js
│   │   ├── lineRuns.js
│   │   ├── mail.js
│   │   ├── mazeMaps.js
│   │   ├── mazeRuns.js
│   │   ├── ranking.js
│   │   ├── registration.js
│   │   ├── reservation.js
│   │   ├── rounds.js
│   │   ├── shortURL.js
│   │   ├── signage.js
│   │   ├── simRuns.js
│   │   ├── survey.js
│   │   ├── teams.js
│   │   ├── technicalChallenge.js
│   │   └── users.js
│   ├── admin.js
│   ├── document.js
│   ├── home.js
│   ├── kiosk.js
│   ├── line.js
│   ├── login.js
│   ├── maze.js
│   ├── mypage.js
│   ├── registration.js
│   ├── service.js
│   ├── shortURL.js
│   ├── signage.js
│   └── simulation.js
├── scoresheet_generation/
│   ├── line/
│   │   ├── after_final.png
│   │   ├── after_finalE.png
│   │   ├── base2024.png
│   │   ├── checkpoint.png
│   │   ├── checkpointE.png
│   │   ├── element.png
│   │   ├── obstacle.png
│   │   ├── ramp.png
│   │   ├── speedbump.png
│   │   └── start.png
│   └── maze/
│       └── [31 files - .png, listing omitted]
├── templates/
│   ├── documentForm/
│   │   ├── InternationalCompetition.json
│   │   ├── Line.json
│   │   └── Maze.json
│   ├── mail/
│   │   ├── Submission of technical documents.html
│   │   ├── Your personal page is now available!.html
│   │   ├── _Document Evaluation Reminder and Status Update.html
│   │   ├── _Email Verification.html
│   │   ├── _Team registration completed.html
│   │   ├── _Welcome to RCJ CMS – Your Account Information.html
│   │   ├── _チーム登録完了.html
│   │   ├── _メール認証.html
│   │   ├── テクニカルドキュメントの提出について.html
│   │   └── マイページのご案内.html
│   └── reviewForm/
│       └── .keep
├── tools/
│   └── cognitive_targets_generator/
│       ├── generate_cognitive_targets.py
│       ├── generate_letter_victims.py
│       └── generate_ring_layers.py
├── views/
│   ├── admin/
│   │   ├── documents/
│   │   │   └── reviewStatus.pug
│   │   ├── gamesPrint/
│   │   │   ├── line_2025.pug
│   │   │   ├── line_2025E.pug
│   │   │   ├── line_2026.pug
│   │   │   ├── line_2026E.pug
│   │   │   ├── maze_2025.pug
│   │   │   ├── maze_2025E.pug
│   │   │   ├── maze_2026.pug
│   │   │   ├── maze_2026E.pug
│   │   │   ├── simulation_2025.pug
│   │   │   └── simulation_2026.pug
│   │   ├── mapEditor/
│   │   │   ├── line_2025.pug
│   │   │   ├── line_2025E.pug
│   │   │   ├── line_2026.pug
│   │   │   ├── line_2026E.pug
│   │   │   ├── maze_2025.pug
│   │   │   ├── maze_2025E.pug
│   │   │   ├── maze_2026.pug
│   │   │   └── maze_2026E.pug
│   │   ├── rankingPrint/
│   │   │   ├── line_2025.pug
│   │   │   ├── line_2025E.pug
│   │   │   ├── line_2026.pug
│   │   │   ├── line_2026E.pug
│   │   │   ├── maze_2025.pug
│   │   │   ├── maze_2025E.pug
│   │   │   ├── maze_2026.pug
│   │   │   ├── maze_2026E.pug
│   │   │   ├── simulation_2025.pug
│   │   │   └── simulation_2026.pug
│   │   ├── competition.pug
│   │   ├── competition_backup.pug
│   │   ├── competition_settings.pug
│   │   ├── field.pug
│   │   ├── games.pug
│   │   ├── games_bulk.pug
│   │   ├── home.pug
│   │   ├── maps.pug
│   │   ├── round.pug
│   │   ├── team.pug
│   │   └── team_bulk.pug
│   ├── cabinet/
│   │   ├── admin.pug
│   │   └── file.pug
│   ├── document/
│   │   ├── admin.pug
│   │   ├── assigned.pug
│   │   ├── embed_video.pug
│   │   ├── form.pug
│   │   ├── form_editor.pug
│   │   ├── form_preview.pug
│   │   ├── public_files.pug
│   │   ├── result.pug
│   │   ├── review.pug
│   │   ├── reviewStatus.pug
│   │   ├── review_editor.pug
│   │   ├── reviewed.pug
│   │   └── team_admin.pug
│   ├── includes/
│   │   ├── common_component.pug
│   │   ├── footer.pug
│   │   ├── head.pug
│   │   ├── language_modal.pug
│   │   ├── layout.pug
│   │   ├── login_modal.pug
│   │   ├── modern_layout.pug
│   │   ├── navbar.pug
│   │   └── signage_layout.pug
│   ├── judge/
│   │   ├── line_2025.pug
│   │   ├── line_2025E.pug
│   │   ├── line_2026.pug
│   │   ├── line_2026E.pug
│   │   ├── maze_2025.pug
│   │   ├── maze_2025E.pug
│   │   ├── maze_2026.pug
│   │   ├── maze_2026E.pug
│   │   ├── simulation_2025.pug
│   │   └── simulation_2026.pug
│   ├── manual/
│   │   ├── check/
│   │   │   ├── line_2025.pug
│   │   │   ├── line_2026.pug
│   │   │   ├── maze_2025.pug
│   │   │   └── maze_2026.pug
│   │   └── input/
│   │       ├── line_2025.pug
│   │       ├── line_2026.pug
│   │       ├── maze_2025.pug
│   │       └── maze_2026.pug
│   ├── mypage/
│   │   ├── my.pug
│   │   └── profile.pug
│   ├── ranking/
│   │   ├── include/
│   │   │   ├── line_2025.pug
│   │   │   ├── line_2025E.pug
│   │   │   ├── line_2026.pug
│   │   │   ├── line_2026E.pug
│   │   │   ├── maze_2025.pug
│   │   │   ├── maze_2025E.pug
│   │   │   ├── maze_2026.pug
│   │   │   ├── maze_2026E.pug
│   │   │   ├── simulation_2025.pug
│   │   │   └── simulation_2026.pug
│   │   ├── line_2025.pug
│   │   ├── line_2025E.pug
│   │   ├── line_2026.pug
│   │   ├── line_2026E.pug
│   │   ├── maze_2025.pug
│   │   ├── maze_2025E.pug
│   │   ├── maze_2026.pug
│   │   ├── maze_2026E.pug
│   │   ├── simulation_2025.pug
│   │   └── simulation_2026.pug
│   ├── registration/
│   │   ├── authError.pug
│   │   ├── close.pug
│   │   ├── form.pug
│   │   ├── settings.pug
│   │   └── top.pug
│   ├── reservation/
│   │   ├── admin.pug
│   │   ├── form.pug
│   │   ├── list.pug
│   │   └── settings.pug
│   ├── sign/
│   │   ├── line_2025.pug
│   │   ├── line_2025E.pug
│   │   ├── line_2026.pug
│   │   ├── line_2026E.pug
│   │   ├── maze_2025.pug
│   │   ├── maze_2025E.pug
│   │   ├── maze_2026.pug
│   │   ├── maze_2026E.pug
│   │   ├── simulation_2025.pug
│   │   └── simulation_2026.pug
│   ├── signage/
│   │   ├── ranking/
│   │   │   ├── line_2025.pug
│   │   │   ├── line_2025E.pug
│   │   │   ├── line_2026.pug
│   │   │   ├── line_2026E.pug
│   │   │   ├── maze_2025.pug
│   │   │   ├── maze_2025E.pug
│   │   │   ├── maze_2026.pug
│   │   │   └── maze_2026E.pug
│   │   ├── clock.pug
│   │   ├── editor.pug
│   │   ├── field_view.pug
│   │   ├── files.pug
│   │   ├── game_monitor.pug
│   │   └── setting.pug
│   ├── sim_editor/
│   │   ├── sim_editor_2025.pug
│   │   └── sim_editor_2026.pug
│   ├── survey/
│   │   ├── answers.pug
│   │   ├── edit.pug
│   │   ├── form.pug
│   │   └── list.pug
│   ├── technicalChallenge/
│   │   └── scoring.pug
│   ├── view/
│   │   ├── common/
│   │   │   ├── line_2025.pug
│   │   │   ├── line_2025E.pug
│   │   │   ├── line_2026.pug
│   │   │   ├── line_2026E.pug
│   │   │   ├── maze_2025.pug
│   │   │   ├── maze_2025E.pug
│   │   │   ├── maze_2026.pug
│   │   │   └── maze_2026E.pug
│   │   ├── line_2025.pug
│   │   ├── line_2025E.pug
│   │   ├── line_2026.pug
│   │   ├── line_2026E.pug
│   │   ├── maze_2025.pug
│   │   ├── maze_2025E.pug
│   │   ├── maze_2026.pug
│   │   ├── maze_2026E.pug
│   │   ├── simulation_2025.pug
│   │   └── simulation_2026.pug
│   ├── view_iframe/
│   │   ├── line_2025.pug
│   │   ├── line_2025E.pug
│   │   ├── line_2026.pug
│   │   ├── line_2026E.pug
│   │   ├── maze_2025.pug
│   │   ├── maze_2025E.pug
│   │   ├── maze_2026.pug
│   │   └── maze_2026E.pug
│   ├── access_denied.pug
│   ├── admin_restore.pug
│   ├── admin_short.pug
│   ├── admin_user.pug
│   ├── competition_home.pug
│   ├── error.pug
│   ├── home.pug
│   ├── inspection.pug
│   ├── line_competition.pug
│   ├── login.pug
│   ├── mail_home.pug
│   ├── mail_sent.pug
│   ├── mail_template_editor.pug
│   ├── mail_templates.pug
│   ├── main_signage.pug
│   ├── maze_competition.pug
│   ├── scanner.pug
│   ├── service_home.pug
│   ├── shortURL404.pug
│   ├── simulation_competition.pug
│   ├── team_home.pug
│   └── tileset_admin.pug
├── .bowerrc
├── .dockerignore
├── .eslintrc.js
├── .gitignore
├── .prettierrc.js
├── CONTRIBUTING.md
├── Dockerfile
├── Gruntfile.js
├── LICENSE
├── README-JP.md
├── README.md
├── app.js
├── bower.json
├── docker-compose.override.yml
├── docker-compose.yml
├── leagues.json
├── mongo_express_config.js
├── package-lock.json
├── package.json
├── process.env
├── process.json
├── season_preparation_guide.md
└── server.js
```
