# 01 Harvest Version Control

## 2026-08-10 - v0.1.0
- Added initial Harvest agent definition file: `agents/01-Harvest-Read-Jira.Agent.md`.
- Defined Sentinel step 1 role, input contract, analysis rules, and Temper handoff output schema.

## 2026-08-11 - v0.2.0
- Populated `Prompts/01-Harvest-Read-Jira.prompt.md` with a working Start Harvest prompt wired to agent `01-Harvest-Read-Jira`.
- Added Harvest browser wizard script: `Scripts/Harvest-wizard.cjs` (ported from trial and adapted to Sentinel paths).
- Adapted wizard behavior to Harvest-only scope by removing Temper auto-handoff logic.
- Added Harvest output scaffold folder and documentation: `01-Harvest-Jira-Summaries/README.md`.

## 2026-08-11 - v0.2.1
- Reworked `Agents/01-Harvest-Read-Jira.Agent.md` into a wizard-first operational runbook aligned to current Sentinel setup.
- Aligned folder and runtime references with existing files (`Scripts`, `Prompts`, `01-Harvest-Jira-Summaries`, `%TEMP%` state files).
- Explicitly constrained flow to Harvest-only (no automatic Temper startup).

## 2026-08-11 - v0.2.2
- Updated splash image loading in `Scripts/Harvest-wizard.cjs` to source images from `C:/Users/ADolder/Pictures/Sentinel`.
- Added fallback behavior: if `Harvest.png` is missing, automatically use the first supported image in that folder.

## 2026-08-11 - v0.2.3
- Reduced splash lower-right `AI generated` image size to 25% of previous size.
- Removed visible framing styles around splash logos so both images blend directly into the yellow page background.

## 2026-08-11 - v0.2.3
- Added lower-right splash image on Harvest splashscreen using `AI generated` assets from `C:/Users/ADolder/Pictures/Sentinel`.
- Applied visual blend treatment for both splashscreen Acto logo (upper-left) and lower-right image so white backgrounds merge with the page yellow tone.

## 2026-08-11 - v0.2.4
- Increased lower-right splash `AI generated` logo size slightly for better visibility.
- Updated splash logo blend mode to improve white-background integration with the yellow page background while keeping both logos borderless.

## 2026-08-11 - v0.2.5
- Increased lower-right splash `AI generated` logo to 2x its previous size.
- Updated blend treatment to better merge the logo background with the splash yellow (`#faf8ec`) so white areas no longer stand out.

## 2026-08-11 - v0.2.6
- Updated Harvest splashscreen display time from `600000 ms` to `3000 ms` in `Scripts/Harvest-wizard.cjs`.

## 2026-08-11 - v0.2.7
- Updated Harvest splashscreen display time from `3000 ms` to `5000 ms` in `Scripts/Harvest-wizard.cjs`.

## 2026-08-11 - v0.2.8
- Added shared splashscreen standard config: `Scripts/splashscreen-standard.json`.
- Updated `Scripts/Harvest-wizard.cjs` to load splash timing, colors, blend modes, and image selection from the shared standard file.
- Established this file as the baseline configuration for every future Sentinel splashscreen.

## 2026-08-11 - v0.2.9
- Updated `Scripts/Harvest-wizard.cjs` wizard form so the `Volgende` button is hidden by default.
- `Volgende` is now only shown when the Jira input matches a valid issue format (for example `RB-1234`).

## 2026-08-11 - v0.2.10
- Updated Chrome startup in `Scripts/Harvest-wizard.cjs` to prevent the restore-pages warning after restart.
- The dedicated Harvest Chrome profile is now reset on each wizard launch.
- Added Chrome launch flags to suppress first-run/default-browser/session-crash restore prompts during wizard runs.
