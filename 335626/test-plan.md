# TPI Test Plan: Migrate workspace MCP servers to `.mcp.json`

## Source

- TPI issue: https://github.com/microsoft/vscode/issues/335626
- Linked implementation: https://github.com/microsoft/vscode/pull/334369
- Official MCP documentation: https://code.visualstudio.com/docs/agent-customization/mcp-servers
- Platform: Windows 11, local workspace; remote/dev-container coverage is conditional on an available target.
- TPI assignees: `@Yoyokrazy`, `@kycutler`, `@aeschli`

## Feature summary

The Agent Customizations editor can migrate eligible workspace MCP server
configurations from `.vscode/mcp.json` to a workspace-root `.mcp.json`. The
migration is intended to preserve JSONC comments and formatting, move only
selected and exactly representable servers, avoid destination conflicts, and
make migrated servers directly discoverable by the active Agent Host harness.

The implementation uses optimistic concurrency rather than an atomic two-file
transaction. It revalidates the source, destination, active session, and
working-directory roots around writes. The destination is written first, then
the selected source entries are removed. Existing wrapped (`mcpServers`) and
flat root configurations are supported.

## Environment

- Installed VS Code Insiders: `1.138.0-insider`
- Installed commit: `7b7e49c83affacfac726040280da69b4999f3e01`
- Latest published Windows x64 user version: `1.138.0-insider`
- Node.js: `v24.18.0`
- npm: `11.16.0`
- Playwright: declared as dev dependency, `^1.63.0`
- Renderer CDP endpoint: `127.0.0.1:9222` (free during planning)
- Extension-host inspector endpoint: `127.0.0.1:9333` (free during planning)
- Isolated user data: `335626/user-data-dir`
- Isolated extensions: `335626/extensions-dir`
- Disposable workspace: `335626/workspace`

Before execution, confirm the About dialog displays the same Insiders version
and commit. Testing requires a signed-in Copilot account with Agent Host access,
workspace trust, network access for the `npx` MCP package, and the active Agent
Host harness.

User settings in the isolated profile:

```jsonc
{
  "chat.customizations.mcpServerMigration.enabled": true,
  "chat.mcp.access": "all"
}
```

The initial `.vscode/mcp.json` fixture will exactly match the TPI issue. No root
`.mcp.json` will exist initially.

## Extracted TPI requirements and coverage

| Requirement | Planned tests |
| --- | --- |
| Show migratable servers and source/destination clearly | T1 |
| Exclude a server whose workspace-variable configuration cannot be represented unchanged | T1 |
| Move only the selected compatible server | T2 |
| Preserve unselected and unsupported source entries | T2, T3, T4 |
| Preserve source comments and surrounding JSONC formatting | T2, T4 |
| Create root `.mcp.json` without overwriting data | T2 |
| Continue offering an eligible unselected server | T2 |
| Discover and run the migrated server through the active Agent Host | T3 |
| Merge into an existing root file while preserving entries, comments, and formatting | T4 |
| Avoid conflicting destination entries | T4, T6 |
| Revalidate stale source data and report cancellation/failure accurately | T5 |
| Route multi-root migrations to the owning workspace and report cross-root conflicts | T6 |
| Use remote workspace paths rather than accidental local paths, when a remote target is available | T7 |

## Planned tests

### T1 - Candidate discovery, presentation, and keyboard operation

- Origin: TPI
- Priority: P0

Actions:

1. Launch the isolated Insiders instance, trust the disposable workspace, apply
   the required settings, create the TPI source fixture, and verify there is no
   root `.mcp.json`.
2. Open the Agents window, start and select an Agent Host session for the
   folder, run **Chat: Open Customizations**, and open **Migrate MCP Servers**.
3. Inspect candidate rows, source/destination text, initial selection, focus,
   and accessible labels.
4. Navigate the candidate list and toggle a checkbox using only the keyboard,
   then restore the initial selection.

Expected:

- `migrate-me` and `leave-me` are listed and selected.
- `uses-workspace-variable` is not offered.
- The source is `.vscode/mcp.json` and the destination is the workspace-root
  `.mcp.json`; no user-profile or unrelated local path is shown.
- Candidate names, checkboxes, migration action, and confirmation controls are
  keyboard reachable and expose meaningful accessible names.

Evidence:

- Screenshot of the candidate view.
- Accessibility snapshot of candidate rows and controls.
- Browser console errors, page errors, and failed requests.
- Relevant renderer, window, and Agent Host logs.

### T2 - Selective migration, confirmation, and JSONC preservation

- Origin: TPI
- Priority: P0

Actions:

1. Clear `leave-me`, leaving only `migrate-me` selected.
2. Select **Migrate**, verify the confirmation identifies the one selected
   server and correct source/destination, then cancel once.
3. Verify cancellation changed neither file, repeat the migration, and confirm.
4. Verify the success notification reports one migrated MCP server.
5. Compare `.vscode/mcp.json` and the newly created root `.mcp.json` with their
   pre-migration state.
6. Return to **Migrate MCP Servers**.

Expected:

- Cancellation makes no file changes and does not show success.
- Root `.mcp.json` contains `migrate-me`.
- `migrate-me` is removed from `.vscode/mcp.json`.
- `leave-me` and `uses-workspace-variable` remain byte-for-byte unchanged
  within their entries.
- The source comment and surrounding JSONC formatting remain.
- `leave-me` is still offered for migration.

Evidence:

- Screenshots of confirmation, success notification, both resulting files, and
  the refreshed candidate list.
- Before/after fixture copies or diffs.
- Console and relevant VS Code logs.

### T3 - Agent Host discovery and harmless tool execution

- Origin: TPI
- Priority: P0

Actions:

1. Restart the active Agent Host session, or create a new session for the same
   folder.
2. Open the MCP Servers section in Agent Customizations.
3. Verify `migrate-me` is discovered from the root `.mcp.json`.
4. Ask the agent: `Use the migrate-me MCP server to echo migration works`.
5. Approve only the expected harmless tool invocation if approval is requested.
6. Re-open `.vscode/mcp.json`.

Expected:

- The server is attributed to the root workspace configuration.
- The `echo` tool runs and returns `migration works`.
- `leave-me` still exists in `.vscode/mcp.json`; harness discovery does not
  remove or migrate source entries.

Evidence:

- Screenshots of MCP discovery, tool call, output, and unchanged source entry.
- Agent Host debug logs and relevant MCP/Agent Host VS Code logs.
- Console errors and failed requests.

### T4 - Existing destination merge and destination conflict safety

- Origin: TPI plus implementation-risk coverage
- Priority: P0

Actions:

1. Add compatible `merge-me` to `.vscode/mcp.json`.
2. Add a comment and unrelated `existing-root` server to an existing wrapped
   root `.mcp.json`.
3. Migrate only `merge-me`.
4. Verify both files and their formatting.
5. Add a source server whose name already exists in the destination with a
   different configuration, refresh the migration view, and attempt migration
   if the candidate remains actionable.

Expected:

- `merge-me` is added without changing the existing root entry, root comment,
  or surrounding formatting.
- `merge-me` is removed from the source.
- Unselected and unsupported source entries remain unchanged.
- A non-equivalent destination-name conflict is excluded or blocked with clear
  feedback; neither conflicting entry is overwritten or removed.

Evidence:

- Screenshots of candidate, confirmation, conflict feedback, and final files.
- Before/after fixture copies or diffs.
- Console and relevant VS Code logs.

### T5 - Stale source, cancellation, and accurate partial-failure reporting

- Origin: Exploratory
- Priority: P1
- Charter: Probe optimistic-concurrency and result-reporting boundaries without
  manufacturing unrelated process failures.
- Bound: 20 minutes or three controlled attempts, whichever comes first.

Actions:

1. Prepare a compatible candidate and open its confirmation.
2. Change or remove that source entry immediately before confirming.
3. Confirm and inspect both files and user feedback.
4. Repeat with two selected candidates and make one stale before confirmation.
5. If the UI exposes an in-progress cancellation action, cancel during
   execution; otherwise record that this path is not user-accessible.

Expected/hypothesis:

- Stale configuration is not written to the destination and is not removed
  from the source.
- Feedback distinguishes complete success, complete failure, and any partial
  result; one failure is not presented as complete success.
- Unaffected entries remain safe. Any retained newly created destination is
  reported rather than silently treated as rollback success.

Evidence:

- Timed screenshots, before/after file copies, notification text, trace logs,
  and Agent Host/renderer logs.

Stopping condition:

- Stop after stale single-entry and mixed-selection outcomes are observed, plus
  one cancellation attempt if the action exists.

### T6 - Multi-root ownership and cross-root name conflict

- Origin: Exploratory
- Priority: P1
- Charter: Verify routing and conflict behavior across two local workspace
  folders.
- Bound: 25 minutes or completion of the two scenarios.

Actions:

1. Create two disposable child folders and open them as a multi-root workspace.
2. Put a uniquely named compatible source server in each folder.
3. Verify displayed destinations and migrate each server.
4. Verify each server lands only in its owning folder's `.mcp.json`.
5. Reset the fixture, define the same server name in both roots, and attempt
   migration.

Expected/hypothesis:

- Source and destination labels identify the owning workspace folder.
- Unique servers are routed to their own roots without cross-folder edits.
- Same-name cross-root ambiguity is blocked with a clear conflict message and
  no files are overwritten or incorrectly cleaned up.

Evidence:

- Screenshots, workspace file tree, before/after fixture copies, notifications,
  console output, and relevant logs.

Stopping condition:

- Stop after unique routing and duplicate-name conflict have each produced one
  stable outcome.

### T7 - Remote or dev-container path routing

- Origin: Exploratory
- Priority: P2, conditional
- Charter: Repeat the selective happy path in one available remote environment
  and verify URI/path routing.
- Bound: 20 minutes after a remote workspace is connected.

Actions:

1. If an already usable remote or dev-container target is available in the
   isolated profile, create the source fixture there.
2. Start an Agent Host session, open migration, and inspect displayed paths.
3. Migrate one compatible server and inspect the remote files.

Expected/hypothesis:

- Source and destination refer to the remote workspace.
- No accidental local path is displayed or written.
- Selective migration and preservation match the local happy path.

Evidence:

- Screenshot of source/destination, remote file tree, resulting files, console
  output, and remote/Agent Host logs.

Stopping condition:

- Complete one remote happy path. Mark `Blocked` with the unavailable
  prerequisite if no suitable target is available; do not install or configure
  unrelated infrastructure solely for this P2 case.

## Execution order

`T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7`

T1-T4 cover the complete local TPI workflow. T5-T7 then probe concurrency,
multi-root routing, and remote routing without changing the core fixtures
during the primary verification.

## Observation and artifacts

Each test will use an unattended Playwright script that connects to the
isolated workbench with `chromium.connectOverCDP`. Scripts will prefer
accessibility roles, labels, and stable `data-*` attributes. No `page.pause()`
or interactive Playwright Inspector will be used.

For every item, capture:

- workbench screenshots at decision and result points;
- accessibility-visible labels and relevant workbench text;
- browser console messages, page errors, and failed requests;
- relevant logs from the current session under
  `335626/user-data-dir/logs`, preserving source-relative process paths;
- before/after configuration evidence without credentials or tokens.

Artifacts will be stored under:

```text
335626/tests/<test-item-name>/
  test.md
  screenshots/
  vscode-logs/
  console.log
  test-script.js
```

A final `335626/test-summary.md` will list each item as `Passed`, `Failed`, or
`Blocked`. The isolated Insiders window and any inspector sessions started by
this workflow will be closed after testing without terminating unrelated
processes.

## Known risks and cleanup

- The everything MCP server is fetched through `npx`; package/network failure
  can block T3 independently of migration correctness and will be reported
  separately.
- Agent Host availability, authentication, or service health can block
  discovery/tool execution even when file migration succeeds.
- Optimistic two-file updates are not atomic; all failure-path testing will use
  disposable fixtures and preserve exact before/after evidence.
- Remote coverage is conditional and may be blocked.
- Cleanup removes only fixtures created under `335626/workspace`, closes the
  isolated window, and leaves the evidence directory intact.
