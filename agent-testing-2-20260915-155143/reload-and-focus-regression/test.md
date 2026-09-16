# Test result: Reload and focus regression

- **Source issue:** https://github.com/aeschli/agent-testing/issues/2
- **Test item:** `reload-and-focus-regression`
- **Origin:** Exploratory
- **Status:** Passed
- **Insiders channel:** insiders
- **Version:** 1.138.0-insider
- **Commit:** `7debcd0e2acdea1c52de81bf9ee1620444407dda`
- **Build date:** 2026-09-15T07:24:32Z

## Research and hypothesis

Sources were the approved `../test-plan.md`, the issue, fixture repository,
VS Code custom-agent documentation, and implementation paths listed in the
plan. The hypothesis was that saved workspace-agent changes would be
rediscovered after reload without stale/duplicate entries and that primary
controls would expose meaningful names and keyboard focus.

## Environment and prerequisites

- Windows; isolated root:
  `agent-testing-2-20260915-155143/reload-and-focus-regression`
- Fixture cloned only into `workspace/` from
  https://github.com/aeschli/vscode-customization-migration-test.git
- Launcher endpoints: renderer `http://127.0.0.1:60798`; extension host
  `http://127.0.0.1:60800`
- Workspace trusted; root `README.md` present.
- Cloned profile verified signed in as `aeschli (GitHub)`.
- Visible harness label selected: **Copilot**.

## Steps performed

1. Launched the latest resolved Insiders build with the approved isolated root.
2. Verified the fixture, authentication, Chat, and initial `agent-one` and
   `agent-two` entries.
3. Selected Copilot and opened Customizations using keyboard operation. The
   harness, Customizations, and Chat-agent controls exposed meaningful labels.
4. Opened `agent-two`, changed its frontmatter name to `agent-two-new` in
   Monaco using keyboard editing, and saved.
5. Created `agent-three` through Workspace **New Agent** and selected
   `.github\agents`.
6. Removed `agent-one` and verified pre-reload Customizations and Chat state.
7. Ran **Developer: Reload Window** once and waited eight seconds.
8. Verified each surviving name exactly once in Chat and Customizations,
   selected each from Chat, and opened each backing file from Customizations.

## Expected result

Before and after reload, `agent-two-new` and `agent-three` appear once in both
UI surfaces; `agent-two` and `agent-one` are absent. Surviving entries open the
correct files. Workflow controls have meaningful accessible labels and visible
keyboard focus, with no attributable console/log errors.

## Actual result

The expected synchronized state was observed before and after reload. Both
surviving agents selected and opened correctly. The stale names were absent.
The Chat agent selector (`Agent`) and **Open Customizations** had accessible
names and visible focus after reload. Focus order was usable; the Agents
sidebar is a focusable list using active-descendant semantics rather than a
directly focusable row.

No browser console messages or page errors were captured during reload/final
verification (`console.log` is empty). No lifecycle-related VS Code errors
were found. Two unrelated Node `url.parse()` deprecation messages existed at:

- `user-data-dir/logs/20260915T161200/window1/renderer.log`
- `user-data-dir/logs/20260915T161200/main.log`

## Deviations

Playwright could open the `agent-one` context menu, but its transient **Delete**
item did not invoke through CDP using locator, keyboard, coordinate, or
dispatched clicks. To preserve the bounded charter, the backing
`.github/agents/agent-one.agent.md` file was removed directly and file-watcher
synchronization was tested. This is an automation deviation, not considered a
reportable product defect without manual reproduction.

## Evidence

- [Harness keyboard focus](screenshots/01-harness-keyboard-focus.png)
- [Initial Agents view](screenshots/02-agents-initial-focus.png)
- [Delete interaction capture](screenshots/03-delete-confirmation.png)
- [Pre-reload Customizations](screenshots/04-pre-reload-agents.png)
- [Pre-reload Chat dropdown](screenshots/05-pre-reload-chat-dropdown.png)
- [Post-reload Chat dropdown](screenshots/06-post-reload-chat-dropdown.png)
- [Post-reload Customizations](screenshots/07-post-reload-agents.png)
- [Accessibility observations](accessibility-observations.json)
- [Playwright script](test-script.js)
- [Browser console capture](console.log)

## Issues to report

None. `reported-issues/` is intentionally empty.
