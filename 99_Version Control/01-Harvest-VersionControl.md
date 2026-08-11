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

## 2026-08-11 - v0.2.11
- Added initial MCP server config template: `.vscode/mcp.json`.
- Configured `servers.mcp-atlassian` with `npx.cmd -y mcp-atlassian` and required Jira env keys (`ATLASSIAN_BASE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`) for Harvest wizard Jira fetch.

## 2026-08-11 - v0.2.12
- Updated `.vscode/mcp.json` launch args for `mcp-atlassian` to include explicit package preloading via `npx.cmd -y -p jsdom -p mcp-atlassian mcp-atlassian`.
- This avoids startup failure on missing `jsdom` during Jira MCP server bootstrap.

## 2026-08-11 - v0.2.13
- Updated `Scripts/Harvest-wizard.cjs` so clicking `Volgende` now performs only one MCP action: fetch the entered Jira item (`read_jira_issue`).
- Removed extra fetch calls for underlying/linked items from the initial wizard step.
- Updated fetch result screen to show the retrieved Jira item payload only.

## 2026-08-11 - v0.2.14
- Increased MCP timeouts in `Scripts/Harvest-wizard.cjs` to reduce false `initialize` timeout failures during Jira fetch.
- Updated the fetch fail-safe window from 75s to 120s with clearer guidance for first-run `npx` startup delays.

## 2026-08-11 - v0.2.15
- Hardened MCP stdout frame parsing in `Scripts/Harvest-wizard.cjs` to accept both `\r\n\r\n` and `\n\n` header separators.
- Prevents `MCP timeout on initialize` when MCP server/proxy emits LF-only framed messages.

## 2026-08-11 - v0.2.16
- Added a resilience fallback in `Scripts/Harvest-wizard.cjs`: if Jira ophalen via MCP fails/timeouts, the same Jira item is fetched via Atlassian REST using the configured `ATLASSIAN_*` credentials.
- This keeps the `Volgende` flow functional and prevents hard stops on MCP initialize timeouts.

## 2026-08-11 - v0.2.17
- Updated fetch-result rendering in `Scripts/Harvest-wizard.cjs`.
- `Root item` now shows key plus title.
- Replaced `Jira itemdata` raw JSON block with `Beschrijving` (Jira description content).
- Added `Bijlagen` block with one line per attachment.

## 2026-08-11 - v0.2.18
- Added include/exclude checkboxes per attachment line in the `Bijlagen` block on fetch-result.
- Default behavior is checked (`meenemen`).
- On `Bevestigen`, selected attachment states are persisted to `jira-wizard-answers.json` as `selectedAttachments`.

## 2026-08-11 - v0.2.19
- Tweaked fetch-result `Opgehaald` row in `Scripts/Harvest-wizard.cjs`:
- Reduced spacing between `Root item:` label and its value.
- Updated label text from `Root item` to `Root item:`.

## 2026-08-11 - v0.2.20
- Updated fetch-result `Root item:` row in `Scripts/Harvest-wizard.cjs` to always render on a single line (no wrapping).
- Added horizontal overflow handling for very long titles.

## 2026-08-11 - v0.2.21
- Fixed overlapping text in the `Opgehaald` block by rendering `Root item:` and its value as one continuous inline row in `Scripts/Harvest-wizard.cjs`.
- Keeps long values readable with horizontal overflow instead of overlapping columns.

## 2026-08-11 - v0.2.22
- Updated the `Opgehaald` Root item row in `Scripts/Harvest-wizard.cjs` to wrap long text instead of using horizontal scroll.
- Ensures the full value is visible directly in the page without manual scrolling.

## 2026-08-11 - v0.2.23
- Adjusted the `Opgehaald` Root item row in `Scripts/Harvest-wizard.cjs` so the label `Root item:` never wraps to a second line.
- The value text still wraps over multiple lines when needed.

## 2026-08-11 - v0.2.14
- Updated `Scripts/Harvest-wizard.cjs` environment placeholder resolution so `${input:...}` values can resolve via Windows User environment variables when Process values are absent.
- This prevents false `MCP-config nog niet compleet` warnings after setting `ATLASSIAN_BASE_URL`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_TOKEN` at User scope.

## 2026-08-11 - v0.2.24
- Updated `Scripts/Harvest-wizard.cjs` to fetch sub-item issue data in addition to the root Jira item (MCP path and REST fallback path).
- Extended fetch output payload (`jira-fetched.json`) with `childIssueKeys`, `childIssues`, and optional `childIssueErrors`.
- Updated fetch-result UI to show a `Sub-items` section and include attachments from both root and sub-items in the confirmation payload.
- Expanded persisted `selectedAttachments` metadata in `jira-wizard-answers.json` with `issueKey` and `issueTitle`.

## 2026-08-11 - v0.2.25
- Updated `Agents/01-Harvest-Read-Jira.Agent.md` input contract to explicitly require retrieval of sub-item data when present.

## 2026-08-11 - v0.2.26
- Updated `Scripts/Harvest-wizard.cjs` fetch-result layout so sub-items are shown inside the `Opgehaald` block directly under `Root item:` as `Sub item(s):`.
- Removed the separate `Sub-items` section from fetch-result.
- Kept sub-item attachments included in the existing `Bijlagen` block.

## 2026-08-11 - v0.2.27
- Updated `Scripts/Harvest-wizard.cjs` so `Sub item(s):` entries in the `Opgehaald` block render as plain lines without bullet markers.

## 2026-08-11 - v0.2.28
- Updated `Scripts/Harvest-wizard.cjs` `Beschrijving` block to show item-scoped descriptions.
- `Root item` description is now always shown first.
- Added sub-item description sections labeled per sub-item, only when a sub-item description is present.
- Sub-items without a description are omitted from the `Beschrijving` block.

## 2026-08-11 - v0.2.29
- Updated `Scripts/Harvest-wizard.cjs` fetch-result primary action button label from `Bevestigen` to `Analyseren`.
