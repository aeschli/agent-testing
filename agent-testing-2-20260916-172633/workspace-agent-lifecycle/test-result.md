# Test Result: Workspace agent lifecycle

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Test variation: `workspace-agent-lifecycle`
- Origin: **TPI**
- Status: **Passed**
- Tested channel: `insiders`
- VS Code Insiders version: `1.139.0-insider`
- VS Code Insiders commit: `c74ba73b780a4a33173c006e52560d61432f53d6`
- VS Code build date: `2026-09-16T04:43:54Z`
- Fixture repository: https://github.com/aeschli/vscode-customization-migration-test
- Fixture commit: `a418412d3bdf8aba1cc5ffb016624875528ec9db`
- Platform: Windows

## Expected result

The isolated fixture opens at its repository root; the Copilot harness exposes
the two initial Workspace agents; renaming, creating, and deleting Workspace
agents update the backing files, Agent Customizations inventory, and Chat agent
picker without stale or duplicate entries.

## Steps performed and actual result

1. Launched the latest resolved VS Code Insiders build with
   `npm run start-vscode -- --root-dir agent-testing-2-20260916-172633\workspace-agent-lifecycle`.
   Both the renderer endpoint (`http://127.0.0.1:50415`) and extension-host
   endpoint (`http://127.0.0.1:50416`) validated.
2. Cloned the fixture only into this variation's `workspace` directory and
   verified its HEAD and root `README.md`.
3. Opened the root `README.md` and selected the visible **Copilot** harness.
4. Opened **Agent Customizations** and selected **Agents**.
5. Verified that the initial Workspace inventory was exactly `agent-one` and
   `agent-two`, once each.
6. Opened `agent-two.agent.md`, changed only its frontmatter name to
   `agent-two-new`, and saved it.
7. Verified that Customizations and the Chat agent picker each showed
   `agent-two-new` once and no stale `agent-two`.
8. Created `agent-three` in `.github\agents`. VS Code generated a valid agent
   template and automatically selected the new agent in Chat.
9. Verified that Customizations and the Chat agent picker each showed
   `agent-three` once.
10. Deleted `agent-one` through its Customizations context menu and accepted
    the explicit confirmation:
    `Are you sure you want to delete 'agent-one.agent.md'?`
11. Verified the final Customizations and Chat inventories: `agent-two-new`
    and `agent-three` were each present once; `agent-one` and stale
    `agent-two` were absent.
12. Verified the final backing files: `agent-one.agent.md` was deleted,
    `agent-two.agent.md` retained its content with the renamed frontmatter,
    and `agent-three.agent.md` contained the generated valid template.

All authoritative checks in [test-observations.json](./test-observations.json)
passed.

## Evidence

- Root README: [readme-root.png](./screenshots/readme-root.png)
- Copilot harness selected:
  [copilot-harness-selected.png](./screenshots/copilot-harness-selected.png)
- Initial Workspace inventory:
  [initial-workspace-agents.png](./screenshots/initial-workspace-agents.png)
- Renamed agent in Customizations:
  [renamed-customizations.png](./screenshots/renamed-customizations.png)
- Renamed agent in Chat:
  [renamed-chat-dropdown.png](./screenshots/renamed-chat-dropdown.png)
- Created agent in Customizations:
  [created-customizations.png](./screenshots/created-customizations.png)
- Created agent in Chat:
  [created-chat-dropdown.png](./screenshots/created-chat-dropdown.png)
- Deletion confirmation:
  [deletion-confirmation.png](./screenshots/deletion-confirmation.png)
- Final Customizations inventory:
  [final-customizations.png](./screenshots/final-customizations.png)
- Final Chat inventory:
  [final-chat-dropdown.png](./screenshots/final-chat-dropdown.png)
- Persisted Playwright workflow: [test-script.mts](./test-script.mts)
- Browser console/page/request evidence: [console.json](./console.json)
- Run timing: [timing.json](./timing.json)

The authoritative run recorded no browser warning/error console messages, page
errors, or failed requests (`console.json` is an empty array). No relevant
product warning or error occurred, so no VS Code log excerpt was copied. The
original log session remains preserved at
`user-data-dir\logs\20260916T174143`.

## Timing

- Automation duration: `9,799 ms`
- Total orchestration duration, including selector discovery and clean resets:
  `1,484,608 ms` (24 minutes 44.608 seconds)
- Authoritative automation window:
  `2026-09-16T16:05:49.163Z` to `2026-09-16T16:05:58.962Z`

## Deviations

- The required two-stage workflow included bounded selector exploration before
  the authoritative run. Several automation attempts were reset because focus
  behavior in the modal customization editor and transient context views
  invalidated early selectors. Before every authoritative retry, the fixture
  was restored to the committed baseline. The final recorded run started from
  a clean fixture and completed end to end.
- The Chat agent picker was opened with its visible keyboard command
  (`Ctrl+.`) after selector discovery because tooltip context views made a
  generic `.context-view` selector ambiguous.
- `agent-three` was automatically selected by VS Code after creation, so its
  selectability was confirmed by both the selected Chat control and the agent
  picker inventory rather than by reselecting the already selected entry.
- No debugger attachment was required because the approved plan requested
  source-level evidence only if UI or log evidence could not establish the
  result.

## Issues to report

None.
