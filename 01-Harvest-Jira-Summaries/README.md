# 01-Harvest-Jira-Summaries

This folder stores all Harvest output files per Jira key.

Conventions:
- Harvest writes summaries as `Harvest-<jiraKey>.md`.
- Companion metadata is written as `Harvest-<jiraKey>.meta.json`.
- Temper reads Harvest input from this folder, but does not write test plans here.
- This folder does not store generated test scripts or page objects.
