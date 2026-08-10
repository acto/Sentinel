---
name: "Start Harvest"
description: "Start 01-Harvest-Read-Jira to analyze Jira input and produce the Harvest handoff package for Sentinel step 2."
argument-hint: "Provide Jira context or a Jira key (for example RB-1234)."
agent: "01-Harvest-Read-Jira"
---

Start Sentinel Harvest for Jira intake and requirement normalization.

${input}

Pass this input to the 01-Harvest-Read-Jira agent.
