# Test Result: Inventory Reload Regression

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Variation: `inventory-reload-regression`
- Origin: **Exploratory**
- Status: **Passed**
- VS Code channel: Insiders
- Version: `1.139.0-insider`
- Commit: `046944034292b5479b4e9a50ad1a508033ffb64f`
- Platform: Windows

## Environment and prerequisites

- Isolated root: `inventory-reload-regression/`
- Renderer endpoint: `http://127.0.0.1:49333`
- Extension-host endpoint: `http://127.0.0.1:49334`
- Fresh fixture: `https://github.com/aeschli/vscode-customization-migration-test.git`
- Harness selected in Chat: **Copilot**
- Initial backing files: `.github/agents/agent-one.agent.md` and
  `.github/agents/agent-two.agent.md`

## Hypothesis and expected result

After one rename, one creation, one deletion, and one window reload, the
Customizations Agents inventory and Chat agent dropdown should exactly match
the backing files. No stale names, duplicate entries, wrong sources, or broken
editors should remain.

## Steps performed

1. Started the latest resolved isolated Insiders build and verified both
   debugger endpoints.
2. Initialized the fresh fixture in the isolated workspace and selected the
   Copilot harness.
3. Confirmed exactly `agent-one` and `agent-two` in Customizations and Chat.
4. Changed the `agent-two.agent.md` frontmatter name to `agent-two-new`.
5. Created `agent-three.agent.md`.
6. Deleted `agent-one.agent.md`.
7. Compared both UI inventories after every mutation.
8. Ran **Developer: Reload Window** once and reacquired the workbench page.
9. Compared both inventories and backing files after reload.
10. Opened both survivors from Customizations and selected both from Chat.

## Actual result

- Initial: both surfaces showed exactly `agent-one` and `agent-two`.
- After rename: both showed exactly `agent-one` and `agent-two-new`.
- After create: both showed exactly `agent-one`, `agent-two-new`, and
  `agent-three`.
- Before reload after delete: both showed exactly `agent-two-new` and
  `agent-three`.
- After reload: both still showed exactly `agent-two-new` and `agent-three`.
- `agent-one` and stale `agent-two` were absent after reload.
- No duplicate entries were observed.
- The final backing files were exactly `agent-two.agent.md` (frontmatter name
  `agent-two-new`) and `agent-three.agent.md`.
- Each survivor opened its expected backing file and could be selected in Chat.

The post-reload comparison completed 123,577 ms after measured initial
discovery, within the approved 300,000 ms bound.

## Evidence

- [Playwright inventory and count observations](./observations.json)
- [Raw post-reload observations](./post-reload-observations.json)
- [Timing](./timing.json)
- [Browser console evidence](./console.json)
- [Initial Customizations](./screenshots/initial-customizations.png)
- [Initial Chat dropdown](./screenshots/initial-chat-dropdown.png)
- [After rename Customizations](./screenshots/after-rename-customizations.png)
- [After rename Chat dropdown](./screenshots/after-rename-chat-dropdown.png)
- [After create Customizations](./screenshots/after-create-customizations.png)
- [After create Chat dropdown](./screenshots/after-create-chat-dropdown.png)
- [Before reload Customizations](./screenshots/before-reload-customizations.png)
- [Before reload Chat dropdown](./screenshots/before-reload-chat-dropdown.png)
- [After reload Customizations](./screenshots/after-reload-customizations.png)
- [After reload Chat dropdown](./screenshots/after-reload-chat-dropdown.png)
- [Survivors opened and selected](./screenshots/survivors-opened-and-selected.png)

The captured console contains unrelated fixture MCP catalog 404s and generic
reload warnings. No message names `agent-one`, `agent-two-new`, `agent-three`,
or reports a custom-agent discovery error. Searches of the original logs also
found no related entries:

- `user-data-dir/logs/20260917T104717/window1/renderer.log`
- `user-data-dir/logs/20260917T104717/window1/exthost/exthost.log`
- `user-data-dir/logs/20260917T104717/window1/exthost/GitHub.copilot-chat/GitHub Copilot Chat.log`

## Deviations

- `git clone <url> .` rejected the existing empty workspace directory, so the
  same repository was initialized at the workspace root with `git init`,
  `git fetch --depth 1 origin main`, and `git checkout -b main FETCH_HEAD`.
- After reload, `Ctrl+Shift+P` was consumed while the restored terminal panel
  held focus. The same run continued without repeating any lifecycle action,
  using F1 to open the global command palette. This was an automation-focus
  issue, not an inventory discrepancy.
- Fixture mutations were made through Node filesystem APIs while Playwright
  observed every resulting UI transition. The approved backing files and
  mutation count were preserved.

## Issues to report

None.

## Teardown

See [teardown confirmation](./teardown-confirmation.md).
