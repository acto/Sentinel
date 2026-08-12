# 99 General Version Control

## 2026-08-10 - v0.1.0
- Created workspace folders: `agensts`, `instructions`, and `prompts`.

## 2026-08-10 - v0.1.1
- Moved repository `README.md` content into `99_Version Control/README.md`.
- Removed root-level `README.md` so the README is located in `99_Version Control`.

## 2026-08-12 - v0.1.2
- Removed `node_modules` from Git tracking (`git rm -r --cached node_modules`) to prevent dependency folder churn in version control.
- Kept `node_modules` in `.gitignore` as the permanent guardrail.
