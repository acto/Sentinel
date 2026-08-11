---
name: jira-items-analyse
description: "Use when analyzing fetched Jira intake data in Sentinel Harvest after clicking Analyseren, including pre-check evaluation of DoR criteria and ISTQB-based testability, with one combined pre-check result page. Triggers on: jira items analyse, analyseren, pre-check, dor check, testbaarheid check."
---

# Jira items analyse

## Purpose
Use this skill for the analysis phase after Jira items are fetched in Harvest.
It standardizes pre-check analysis before summary generation.

## Input
- Fetched Jira payload (`rootIssue`, `childIssues`)
- User-selected attachments from fetch-result
- Instruction sources:
  - `Instructions/01-Harvest-DoR-DoD.instructions.md`
  - `Instructions/01-Harvest-test-istqb.instructions.md`

## Mandatory Analysis Flow
1. Start analysis when the user clicks `Analyseren`.
2. Run DoR check first (Definition of Ready focus).
3. Run testability check second (ISTQB-based testability focus).
4. Show both outcomes on one combined pre-check page.
5. Only continue to summary after pre-check acknowledgement.

## DoR Check Rules
- Evaluate DoR criteria against:
  - Root + sub-item descriptions
  - Content of selected text-based attachments
- Include at minimum:
  - Functional Stability
  - Acceptatie Criteria (presence + Given/When/Then format)
  - Test Data
  - Access / IAM

## Testability Check Rules
- Evaluate testability using the ISTQB-oriented instruction context.
- Evaluate against descriptions plus selected text-based attachments.
- Include at minimum:
  - Test basis present
  - Verifiable expected outcome present
  - Test data context present
  - Risk/priority context present

## Output Contract
Generate and persist both check files:
- `%TEMP%/jira-dor-check.json`
- `%TEMP%/jira-testability-check.json`

Combined pre-check page should present:
- `DoR check` section
- `Testbaarheid check` section

Preferred route naming:
- `http://127.0.0.1:3133/pre-check`
- Keep legacy compatibility with `/dor-check` when needed.

## Guardrails
- Never invent Jira content.
- Distinguish found evidence vs missing evidence.
- If attachment content cannot be parsed (non-text type), mark it as skipped evidence.
- Allow continuation with warnings, but make risks explicit.
