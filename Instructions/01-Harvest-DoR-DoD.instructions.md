---
description: "Use when reviewing, planning, or validating test automation work against project quality standards. Defines Definition of Ready (DoR) and Definition of Done (DoD) for Thinkwise E2E tests."
applyTo: "tests/**/*.spec.ts"
---

# Test Automation Standards: Testwise & Playwright

Apply these standards when developing and validating all Thinkwise E2E tests in this project.

## 1. Definition of Ready (DoR) - Ready to Start
*Before writing any scripts, verify that:*
- [ ] **Functional Stability:** The feature is fully configured in the Software Factory and works correctly in the Universal UI.
- [ ] **Acceptance Criteria:** Clear Gherkin steps (Given/When/Then) are present for the intended test paths.
- [ ] **Test Data:** The required dataset (records, users, roles) is identified and available in the test environment.
- [ ] **Access:** The correct IAM permissions are assigned to the test user.

## 2. Definition of Done (DoD) - Ready for Delivery
*A test script is only considered "Done" when it meets all of the following:*

### Scripting & Structure
- [ ] **Screen Settings:** The test enforces a fullscreen viewport (1920x1080) to ensure consistent rendering of the Universal UI (menus, action bars).
- [ ] **Page Object Model (POM):** Logic and locators are separated from test scripts; screens are defined in reusable Page Objects.
- [ ] **Robust Selectors:** Use only Testwise helpers or stable aria-labels. NEVER use fragile CSS paths or XPath.
- [ ] **Assertions:** The test contains at least one functional `expect` (e.g. validating a process message, status change, or grid value).
- [ ] **No Hard Waits:** Do not use `page.waitForTimeout()`. Use Playwright's auto-waiting or Testwise synchronisation functions instead.

### Execution & Quality
- [ ] **Local Run:** The test passes consistently on the local machine in both headless and headed mode.
- [ ] **Failure Analysis:** On failure, the test automatically captures screenshots and traces for use in the Playwright Trace Viewer.
- [ ] **Clean-up:** The test leaves the environment in a usable state and avoids unnecessary database pollution.
- [ ] **Code Review:** Scripts have been reviewed for readability, reusability, and compliance with these standards.

## 3. Specific Instructions for AI Assistance
- Always apply `await` syntax for all Playwright and Testwise actions.
- When generating code: prefer Playwright library methods for grid interactions and the action bar.
- When setting up new tests, always enforce the viewport setting to 1920x1080.
- Immediately flag if a request does not appear to meet the DoR or DoD rules above.
