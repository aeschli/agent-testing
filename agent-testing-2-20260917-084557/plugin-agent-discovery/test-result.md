# Test Result: Plugin-Contained Agent Discovery

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Variation: `plugin-agent-discovery`
- Origin: TPI
- Status: **Failed**
- Tested channel: Insiders
- VS Code version: `1.139.0-insider`
- VS Code commit: `046944034292b5479b4e9a50ad1a508033ffb64f`
- Architecture: `x64`
- Initial renderer endpoint: `http://127.0.0.1:50430`
- Initial extension-host endpoint: `http://127.0.0.1:50431`
- Relaunch renderer endpoint: `http://127.0.0.1:61456`
- Relaunch extension-host endpoint: `http://127.0.0.1:61458`

## Environment and prerequisites

- Windows host.
- Isolated `workspace/`, `user-data-dir/`, `shared-data-dir`, and
  `extensions-dir` under this variation root.
- Dependencies prepared with `npm install`.
- The prescribed launcher validated the latest `insiders` channel and reused
  the current cached build. Stable VS Code was not used.
- Copilot authentication and the `GPT-5.6 Sol` model were visible.
- The generated plugin was added only through this variation's isolated
  profile and was never published externally.

## Commands

```powershell
npm install
npm run start-vscode -- --root-dir "C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\plugin-agent-discovery"
$env:ORCHESTRATION_STARTED_AT='2026-09-17T07:36:51.3203337Z'
$env:TEST_ROOT_DIR='C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\plugin-agent-discovery'
$env:VSCODE_CDP_ENDPOINT='http://127.0.0.1:50430'
node "$env:TEST_ROOT_DIR\test-script.mts"
npm run start-vscode -- --root-dir "C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\plugin-agent-discovery"
$env:VSCODE_CDP_ENDPOINT='http://127.0.0.1:61456'
node "$env:TEST_ROOT_DIR\verify-after-reload.mts"
```

The second launch reused the same isolated profile to verify persistence after
a clean process restart.

## Expected result

VS Code creates a valid Agent Plugins 1.0 package, installs and enables it only
in the isolated profile, and exposes its agent in Copilot Customizations and
the Chat picker with an unambiguous Plugins source. Opening the plugin entry
shows the packaged copy read-only.

## Steps and actual results

1. Created a valid Workspace agent named `plugin-agent`.
   - Copilot Customizations discovered it exactly once in Workspace.
   - Evidence: [Workspace agent](screenshots/01-workspace-agent-copilot.png).
2. Ran **Create Plugin** under the Local customization harness, selected only
   `plugin-agent.agent.md`, chose **Agent Plugin**, entered
   `tpi-agent-plugin`, and saved under `workspace/`.
   - Evidence:
     [Selected plugin resource](screenshots/02-create-plugin-agent-selected.png).
3. Verified the generated structure:
   - `workspace/tpi-agent-plugin/plugin.json` uses
     `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, name
     `tpi-agent-plugin`, and version `1.0.0`.
   - `workspace/tpi-agent-plugin/com.github.copilot/agents/plugin-agent.agent.md`
     exists and exactly matches the selected Workspace source.
4. Used **Install from Source** with the generated local folder.
   - The isolated Local Plugins page showed `Installed 1`,
     `tpi-agent-plugin`, source `Local`, and the enabled toggle.
   - Evidence:
     [Installed and enabled](screenshots/03-plugin-installed-isolated-profile.png).
5. Switched to Copilot and checked Customizations and Chat before and after a
   clean relaunch of the same isolated profile.
   - **Failed:** Copilot's Plugins sidebar count was `1`, but its Agents page
     exposed only Workspace and User. There was no Plugins group or plugin
     entry to open.
   - **Failed:** the Copilot Chat picker showed two identical
     `plugin-agent` rows without source labels.
   - Evidence:
     [Copilot Agents after relaunch](screenshots/04-copilot-agents-after-reload.png),
     [duplicate Copilot Chat rows](screenshots/05-copilot-chat-after-reload.png).
6. Switched to Local Customizations to isolate the affected surface.
   - Local Agents correctly showed separate Workspace and Plugins groups.
   - Opening the Plugins copy resolved to the generated packaged file.
   - Its Monaco textarea reported `readOnly: true` and had no editable
     contenteditable region.
   - Evidence:
     [read-only plugin copy](screenshots/06-local-plugin-agent-read-only.png).
7. Disabled only `tpi-agent-plugin`.
   - Its isolated-profile toggle changed from `aria-checked=true` to
     `aria-checked=false`.
   - Evidence: [test plugin disabled](screenshots/07-test-plugin-disabled.png).

## Console and log evidence

- Initial measured-run console/page-error/request-failure capture:
  [console.json](console.json) — empty (`[]`).
- Clean-relaunch console capture:
  [post-reload-console.json](post-reload-console.json) — empty (`[]`).
- Structured initial observations:
  [observations.json](observations.json).
- Structured relaunch and cleanup observations:
  [post-reload-observations.json](post-reload-observations.json).
- Original extension-host log:
  `user-data-dir/logs/20260917T103852/window1/exthost/exthost.log`.
- Relevant safe excerpt:
  [plugin activation](vscode-logs/20260917T103852/window1/exthost/plugin-activation.log).

No plugin parsing or agent-discovery error explained the UI inconsistency.
Unrelated Git, marketplace, authentication, embeddings-cache, and deprecation
messages were not copied into the evidence set.

## Timing

- Automation start: `2026-09-17T08:31:14.895Z`
- Final verification end: `2026-09-17T08:43:06.789Z`
- Automation and recovery duration: `711,894 ms` (11m 51.894s)
- Orchestration start: `2026-09-17T07:36:51.320Z`
- Total orchestration duration: `3,975,469 ms` (1h 6m 15.469s)
- Evidence: [timing.json](timing.json).

The orchestration duration includes bounded selector discovery, clean fixture
resets, the measured creation/install pass, restart recovery verification, and
isolated-profile cleanup.

## Deviations and decisions

- Copilot's empty-workspace **New Agent** picker reported
  `No agent source folders found`. The valid Workspace agent was therefore
  created directly at the standard `.github/agents` path with exclusive file
  creation; all discovery, plugin generation, install, and assertions were
  performed through Playwright against the workbench.
- The full **Create Plugin** and Plugins management UI was available under the
  Local harness. The test used that UI to generate/install, then switched to
  Copilot for the required product assertions.
- The isolated process was closed and relaunched with the prescribed launcher
  after a reload left customization commands unavailable. The clean relaunch
  preserved the plugin and reproduced the product failure.
- The generated Workspace agent and plugin source are retained as test
  evidence. The installed plugin was disabled only in the isolated profile.

## Issues to report

- [Copilot shows duplicate plugin agent without source distinction](reported-issues/duplicate-plugin-agent-in-copilot.md).
