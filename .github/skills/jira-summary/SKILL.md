---
name: jira-summary
description: "Use when generating a Harvest Jira summary from fetched root/sub-items, comments, and selected attachments (including text extraction), then persisting summary artifacts. Triggers on: jira summary, samenvatting, harvest summary, bijlagen samenvatten, summary opstellen."
---

# Jira summary

## Purpose
Use this skill for the summary phase after pre-check in Harvest.
It standardizes how summary content is built from all available Jira sources and how outputs are saved.

## Input
- Fetched Jira payload (`rootIssue`, `childIssues`)
- Selected attachments from fetch-result
- Pre-check outcomes:
  - `%TEMP%/jira-dor-check.json`
  - `%TEMP%/jira-testability-check.json`

## Mandatory Summary Flow
1. Start summary generation only after pre-check acknowledgement.
2. Build one overkoepelende samenvatting using all available evidence:
- Root + sub-item descriptions
- Root + sub-item comments
- Extracted text from selected attachments
3. Keep pre-check failures visible in section `Pre-check aandachtspunten (niet voldaan)`.
4. Keep source transparency via section `Brondekking`.

## Attachment Extraction Rules
- Process only user-selected attachments (`include !== false`).
- Include text/document formats such as `md`, `txt`, `json`, `xml`, `csv`, `rtf`, `doc`, `docx`, `pdf`.
- Parse binary office formats with dedicated extraction where possible.
- Never include unreadable binary/archive gibberish (for example `PK...`) in summary output.
- Track `extracted`, `skipped`, and `failed` attachment handling explicitly.

## Output Contract
Persist summary artifacts in `01-Harvest-Jira-Summaries` as:
- `harvest-<JIRAKEY>.md`
- `harvest-<JIRAKEY>.meta.json`

Meta file must include at minimum:
- `harvestedAt`
- `jiraUpdated` (root issue updated timestamp)
- `children` (map of child key -> updated timestamp)

## UI Contract
On summary page:
1. Before confirmation:
- Show button `Bevestigen`.
2. After successful confirmation/save:
- Hide `Bevestigen`.
- Show button `Doorgaan`.
- Keep user on `/summary`.

## Guardrails
- Never invent Jira content.
- Clearly separate evidence-backed statements from missing-data warnings.
- Allow continuation with warnings, but keep risks explicit.
