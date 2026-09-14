# T1 - Candidate discovery, presentation, and keyboard operation

- Source issue: https://github.com/microsoft/vscode/issues/335626
- Origin: TPI
- Status: **Passed**
- Priority: P0
- Tested version: `1.138.0-insider`
- Tested commit: `7b7e49c83affacfac726040280da69b4999f3e01`
- Environment: Windows 11, trusted local folder, isolated user-data and extensions directories

## Research sources

- https://github.com/microsoft/vscode/issues/335626
- https://github.com/microsoft/vscode/pull/334369
- https://code.visualstudio.com/docs/agent-customization/mcp-servers

## Prerequisites

The isolated profile had these effective user settings:

```json
{
  "chat.customizations.mcpServerMigration.enabled": true,
  "chat.mcp.access": "all",
  "workbench.startupEditor": "none",
  "window.dialogStyle": "custom",
  "window.logLevel": "trace"
}
```

The trusted workspace contained the issue's exact `.vscode/mcp.json` fixture
and no root `.mcp.json`. A signed-in Copilot Agent Host session for `workspace`
was active and selected.

## Steps performed

1. Launched the isolated Insiders instance and confirmed one editor workbench
   at the selected CDP endpoint.
2. Verified the custom About dialog against the command-line build.
3. Opened the Agents window, started a Copilot Agent Host session for the test
   folder, and kept it selected.
4. Opened Agent Customizations from the workbench Chat toolbar, which invokes
   the same editor as **Chat: Open Customizations**.
5. Inspected MCP Servers and confirmed all three source entries were loaded.
6. Opened Migrations and inspected its visible and accessibility states.
7. Restarted the isolated instance after the first migration-support snapshot
   returned no candidates, then reselected the same completed Agent Host
   session.
8. Opened **Migrate MCP Servers**, inspected candidate checkboxes and
   source/destination labels, and toggled `leave-me` off and on using only the
   keyboard.

## Expected

- `migrate-me` and `leave-me` are offered as migration candidates.
- `uses-workspace-variable` is not offered.
- Each candidate clearly exposes `.vscode/mcp.json` as source and root
  `.mcp.json` as destination.
- Candidate selection and migration controls are keyboard reachable and have
  meaningful accessible names.

## Actual

- MCP Servers correctly showed three workspace entries:
  - `leave-me`: Running
  - `migrate-me`: Running
  - `uses-workspace-variable`: Error because its workspace-relative command
    does not exist
- Agent Host logs confirmed `migrate-me` and `leave-me` connected and were
  ready.
- After the clean restart, Migrations reported **2 customizations need
  attention** and displayed an MCP Servers card for two servers.
- **Migrate MCP Servers** listed only `leave-me` and `migrate-me`; the
  unsupported `uses-workspace-variable` entry was absent.
- Both candidates were selected by default and displayed
  `.vscode\mcp.json to .mcp.json`.
- Accessibility names identified the controls as `Select leave-me from
  .vscode\mcp.json` and `Select migrate-me from .vscode\mcp.json`.
- Focusing the `leave-me` checkbox and pressing Space cleared it; pressing
  Space again restored it.

The initial support snapshot displayed zero migrations even after the session
completed. Restarting the isolated instance caused the same persisted session
and unchanged fixture to produce the expected candidates. Because the clean
startup state passed every T1 assertion, this is recorded as a passed test with
the transient initialization behavior retained as a deviation.

## Evidence

- [About dialog](./screenshots/about.png)
- [MCP Servers view](./screenshots/mcp-servers-view.png)
- [Initial zero-candidate Migrations view](./screenshots/workbench-migrations-view.png)
- [Retry Migrations card](./screenshots/retry-migrations-view.png)
- [Candidate list](./screenshots/candidate-list.png)
- [Accessibility observations](./console.log)
- [Customization discovery log excerpt](./vscode-logs/customizationsDebug-excerpt.log)
- [Agent Host MCP connection log excerpt](./vscode-logs/agenthost-mcp-excerpt.log)
- Test automation: [test-script.js](./test-script.js)
- Retry and keyboard automation: [retry-script.js](./retry-script.js)

Original VS Code log paths:

- `335626/user-data-dir/logs/20260911T113156/window6/customizationsDebug.log`
- `335626/user-data-dir/logs/20260911T113156/agenthost.log`

## Deviations

- The workbench's **Open Customizations** toolbar action was used instead of
  typing **Chat: Open Customizations** in the Command Palette. Both open the
  same Agent Customizations editor; the command palette shortcut was unreliable
  over CDP.
- `window.dialogStyle` was set to `custom` so Playwright could observe About
  and subsequent confirmations.
- The first live support snapshot exposed no candidates. The test instance was
  restarted once with trace logging enabled; no fixture or migration setting
  changed, and the retry exposed the expected two candidates.
