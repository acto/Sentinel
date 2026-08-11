---
name: fetch-jira-items
description: "Use when fetching Jira intake data for Sentinel Harvest, including root item details, sub-items, descriptions, and attachments for review and analysis. Triggers on: fetch jira, jira ophalen, harvest intake, root item, sub-items, bijlagen."
---

# Fetch JIRA items

## Purpose
Use this skill to run a consistent Jira fetch flow for Sentinel Harvest.
It standardizes what data is collected and how it is presented for confirmation.

## Input
- Jira key in issue format (for example `RB-1234`)
- Optional user context that narrows scope

## Required Fetch Scope
1. Fetch the root Jira item.
2. Detect child issues from `fields.subtasks` on the root item.
3. Fetch each detected sub-item.
4. Do not fetch linked issues unless explicitly requested.

## Required Output Data
Produce a normalized structure with:
- `jiraKey`
- `fetchedAt`
- `rootIssue`
- `childIssueKeys`
- `childIssues`
- optional `childIssueErrors`

## UI/Review Rules
In the fetch review page:
1. Section `Opgehaald`:
- Show `Root item:` first.
- Show `Sub item(s):` under root item as plain lines (no bullets).
2. Section `Beschrijving`:
- Show root item description first.
- Then show sub-item descriptions per item label.
- Omit sub-items without a description.
3. Section `Bijlagen`:
- Include attachments from root item and sub-items.
- Keep include/exclude checkboxes for each attachment.

## Guardrails
- Never invent Jira content.
- Separate missing-data warnings from confirmed facts.
- If sub-item fetch partially fails, keep root result and include error details in `childIssueErrors`.

## Notes
This skill improves consistency and repeatability of Harvest intake.
It does not directly speed up Jira network latency, but it typically improves stability of outcomes by enforcing one deterministic fetch pattern.
