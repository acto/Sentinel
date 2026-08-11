---
name: "Start Fetch JIRA items"
description: "Fetch Jira intake data for Harvest using the fetch-jira-items skill (root item, sub-items, descriptions, and attachments)."
argument-hint: "Provide a Jira key (for example RB-1234) and optional intake context."
agent: "01-Harvest-Read-Jira"
---

Start Sentinel Harvest Jira fetch.

${input}

Use the fetch-jira-items skill for normalized Jira intake:
- fetch root item
- fetch sub-items from fields.subtasks
- show Root item and Sub item(s) in Opgehaald
- show Beschrijving with root first and only sub-items that have a description
- include attachments from root and sub-items in Bijlagen

Then continue with the standard Harvest analysis flow in 01-Harvest-Read-Jira.
