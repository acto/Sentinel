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

## 2026-08-11 - v0.2.30
- Added reusable workspace skill `Fetch JIRA items` at `.github/skills/fetch-jira-items/SKILL.md`.
- Captured standardized Harvest Jira fetch rules for root item + sub-items, description ordering, and attachment inclusion.
- Documented guardrails for partial sub-item fetch failures with `childIssueErrors`.

## 2026-08-11 - v0.2.31
- Added prompt `Prompts/02-Harvest-Fetch-Jira-Items.prompt.md` to start Harvest Jira fetch with explicit `fetch-jira-items` skill guidance.
- Wired prompt to agent `01-Harvest-Read-Jira` and standardized input hint for Jira key plus optional context.

## 2026-08-11 - v0.2.32
- Moved skill file `Fetch JIRA items` from `.github/skills/fetch-jira-items/SKILL.md` to `97_Skills/fetch-jira-items/SKILL.md`.

## 2026-08-11 - v0.2.33
- Reverted the skill location change to preserve VS Code/Copilot skill autoload behavior.
- Moved `Fetch JIRA items` back to `.github/skills/fetch-jira-items/SKILL.md`.
- Removed temporary `97_Skills` skill location.

## 2026-08-11 - v0.2.34
- Updated `Scripts/Harvest-wizard.cjs` Analyze step to explicitly position the first validation as Definition of Ready (DoR)-focused.
- Updated DoR warning text in summary to reference only DoR criteria and DoR status file wording.
- Added DoR section metadata (`sourceSection: Definition of Ready (DoR)`) to the generated DoR check payload.

## 2026-08-11 - v0.2.35
- Updated `Scripts/Harvest-wizard.cjs` DoR check to evaluate both Jira descriptions and the text content of selected (`aangevinkte`) attachments.
- Added attachment evidence extraction for text-based files (`txt`, `md`, `json`, `xml`, `yaml`, `csv`, and similar text MIME types).
- Extended selected attachment payload with `contentUrl` and `mimeType` so DoR analysis can download and parse selected Jira attachments.
- Added DoR evidence metadata (`descriptionsUsed`, `selectedAttachments`, `extractedAttachmentTexts`, `skippedAttachments`, `failedAttachments`) to `jira-dor-check.json`.

## 2026-08-11 - v0.2.36
- Updated `Scripts/Harvest-wizard.cjs` DoR logic with a separate check for the presence of acceptance criteria, in addition to the existing Given/When/Then format check.
- Added explicit checklist item `Acceptance Criteria aanwezig` and retained format-specific validation as `Acceptance Criteria format (Given/When/Then)`.

## 2026-08-11 - v0.2.37
- Updated `Scripts/Harvest-wizard.cjs` DoR checklist to merge acceptance checks into one block: `Acceptatie Criteria`.
- The single block now reports both sub-results: presence of acceptance criteria and Given/When/Then format coverage.

## 2026-08-11 - v0.2.38
- Updated `Instructions/01-Harvest-DoR-DoD.instructions.md` wording to prefer Playwright (instead of `testwise-playwright`) in the AI assistance guidance.

## 2026-08-11 - v0.2.39
- Updated `Scripts/Harvest-wizard.cjs` DoR `Acceptatie Criteria` note output to show two separate lines:
- `Aanwezigheid: ...`
- `Format (Given/When/Then): ...`

## 2026-08-11 - v0.2.40
- Updated Harvest analyze flow to generate both checks after clicking `Analyseren`: DoR check and a second testability check.
- Added testability check generation in `Scripts/Harvest-wizard.cjs` using `Instructions/01-Harvest-test-istqb.instructions.md` as source reference.
- Replaced primary check page route with `http://127.0.0.1:3133/pre-check` (legacy `/dor-check` kept as alias for compatibility).
- Updated pre-check UI to display results of both checks on one page: `DoR check` and `Testbaarheid check`.

## 2026-08-11 - v0.2.41
- Added reusable Harvest analysis skill `jira-items-analyse` at `.github/skills/jira-items-analyse/SKILL.md`.
- Captured the post-`Analyseren` flow contract: DoR check first, testability check second, both shown on one combined `pre-check` page.
- Documented required evidence sources (descriptions + selected attachments) and output artifacts for both checks.

## 2026-08-11 - v0.2.42
- Added prompt `Prompts/03-Harvest-Jira-Items-Analyse.prompt.md` to explicitly start the Jira items analysis phase with skill `jira-items-analyse`.
- Wired prompt to agent `01-Harvest-Read-Jira` with guidance for combined pre-check execution (DoR + testability).

## 2026-08-11 - v0.2.43
- Removed dedicated skill prompts `Prompts/02-Harvest-Fetch-Jira-Items.prompt.md` and `Prompts/03-Harvest-Jira-Items-Analyse.prompt.md`.
- Kept skill definitions available via `.github/skills` without separate start prompts.

## 2026-08-11 - v0.2.44
- Updated `Scripts/Harvest-wizard.cjs` so clicking `Doorgaan` on `pre-check` now generates an uitgebreide Jira samenvatting before opening `Samenvatting`.
- Summary generation now includes root/sub-item descriptions, selected attachments (including image-aware classification), and Jira comments.
- Added explicit `Pre-check aandachtspunten (niet voldaan)` section in the summary so failed DoR/Testbaarheid criteria stay prominent.

## 2026-08-11 - v0.2.45
- Updated `Scripts/Harvest-wizard.cjs` summary generation to produce synthesized summaries instead of copying raw source text verbatim.
- Added condensed source-driven sections for descriptions, comments, and attachment content with ranked kernpunten.
- Added explicit source coverage counters and retained prominent pre-check afwijkingen in the summary output.

## 2026-08-11 - v0.2.46
- Updated `Scripts/Harvest-wizard.cjs` status header in generated summaries to remove `Root item` and `Sub-items` fields.
- Changed `Aangemaakt` timestamp formatting from UTC ISO to locale-aware local time including detected timezone label.

## 2026-08-11 - v0.2.47
- Fixed attachment evidence selection in `Scripts/Harvest-wizard.cjs` so summary generation no longer drops selected attachments due to an `include` filter mismatch.
- Extended text attachment detection to include common document types (`pdf`, `doc`, `docx`, `rtf`, `html`) so document content can be considered for text extraction.

## 2026-08-11 - v0.2.48
- Updated `Scripts/Harvest-wizard.cjs` to generate one `Overkoepelende samenvatting` based on all available sources (beschrijvingen, opmerkingen, bijlage-tekstextracten) instead of multiple separate summary blocks.
- Added explicit `Brondekking` output that lists how many attachments were extracted and which attachment files were actually verwerkt, plus skipped/failed reasons.

## 2026-08-11 - v0.2.49
- Expanded `Overkoepelende samenvatting` in `Scripts/Harvest-wizard.cjs` with a larger evidence window and extra depth for test preparation.
- Added structured `Verdieping voor testontwerp` subsections with source-driven signals for scope, acceptance/assertions, testdata/toegang, and risico's/afhankelijkheden.

## 2026-08-11 - v0.2.50
- Reworked attachment extraction in `Scripts/Harvest-wizard.cjs` to read payloads as binary buffers and parse DOCX/PDF content with dedicated libraries.
- Added binary-gibberish guard to prevent unreadable archive/binary content (e.g. `PK...`) from entering the summary text.
- Added explicit parser-related skip/fail reasons (`docx-parser-missing`, `pdf-parser-missing`, `docx-parse-failed`, `pdf-parse-failed`, `binary-content`).

## 2026-08-11 - v0.2.51
- Updated `Scripts/Harvest-wizard.cjs` to show `Aangemaakt` in local date-time format without appending timezone text (e.g. removed `(Europe/Berlin)`).
- Removed the testscenario/testscript checkpoint subsection from `Verdieping voor testontwerp` to keep this phase focused on test basis input for testplan preparation.

## 2026-08-11 - v0.2.52
- Improved readability of `Pre-check aandachtspunten (niet voldaan)` in `Scripts/Harvest-wizard.cjs` by rendering each finding as a header line with indented detail lines.
- Preserved multi-line note details (for example `Aanwezigheid` and `Format (Given/When/Then)`) as separate readable sub-bullets.

## 2026-08-11 - v0.2.53
- Updated `Pre-check aandachtspunten` formatting in `Scripts/Harvest-wizard.cjs` to show standalone heading lines and tab-indented `•` detail lines for clearer visual alignment.
- Added spacing between findings so DoR and Testbaarheid items are easier to scan.

## 2026-08-11 - v0.2.54
- Tightened `Pre-check aandachtspunten` formatting in `Scripts/Harvest-wizard.cjs` by removing empty lines between heading lines and bullet details, and between bullet groups.

## 2026-08-11 - v0.2.55
- Updated markdown rendering in `Scripts/Harvest-wizard.cjs` so `•` detail lines are displayed with explicit left indentation for improved readability under pre-check headings.

## 2026-08-11 - v0.2.56
- Updated `Scripts/Harvest-wizard.cjs` so clicking `Bevestigen` now persists the current summary to a timestamped markdown file in `01-Harvest-Jira-Summaries`.
- Added confirmation state handling so the summary page reloads with `Bevestigen` hidden and `Doorgaan` shown after successful save.
- Added `/summary-continue` endpoint for post-confirm continuation from the summary page.

## 2026-08-11 - v0.2.57
- Adjusted summary persistence to match the ActoForge format: fixed filenames `harvest-<JIRAKEY>.md` and `harvest-<JIRAKEY>.meta.json` in `01-Harvest-Jira-Summaries`.
- Implemented `.meta.json` content with `harvestedAt`, root `jiraUpdated`, and `children` updated timestamps sourced from fetched Jira data.

## 2026-08-11 - v0.2.58
- Added new skill `.github/skills/jira-summary/SKILL.md` to standardize Harvest summary generation from descriptions, comments, and selected attachments including extraction guardrails.
- Documented summary persistence contract in the skill for `harvest-<JIRAKEY>.md` and `harvest-<JIRAKEY>.meta.json` plus required metadata fields.

## 2026-08-11 - v0.2.59
- Restored missing skill files under `.github/skills` after branch alignment moved to a commit state without the skill directory.
- Recreated `fetch-jira-items`, `jira-items-analyse`, and `jira-summary` skill definitions.

## 2026-08-12 - v0.2.60
- Fixed prompt frontmatter in `Prompts/01-Harvest-Read-Jira.prompt.md` by changing `agent: "01-Harvest-Read-Jira"` to the valid built-in `agent: "agent"`.
- Resolved the prompt validation problem: `Unknown agent '01-Harvest-Read-Jira'`.
