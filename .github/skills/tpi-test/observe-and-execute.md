# Observe and execute VS Code with Playwright

Use these instructions only after the test plan is approved and
`start-vscode` has launched the isolated VS Code Insiders instance. Use the
renderer endpoint printed by the launcher or recorded in
`<root-dir>/launch-metadata.json`. Treat the recorded extension-host endpoint
as the initial endpoint only; the extension host can select a different port
after **Developer: Reload Window**.

## Unattended Execution

For agent-driven execution, create `<root-dir>/test-script.mts`. Import the
shared helpers from
`.github/skills/tpi-test/playwright-workbench-utils.mts` and connect using the
renderer endpoint printed by `start-vscode`.

Use a two-stage workflow:

1. Explore the current workbench structure just long enough to identify
   accessible names and stable selectors. Record selector discoveries, but do
   not count this as the measured test run.
2. Reset the fixture to its approved initial state, persist the script, then
   run that script from start to finish while collecting evidence and timing.

Do not leave exploratory mutations in the measured fixture. Record both the
automation duration and total orchestration duration; the short persisted
script runtime does not represent selector-discovery and reset time.
Wrap longer actions in `runStep` so the script emits `[tpi] START`, `PASS`,
and `FAIL` progress markers with durations.

Do not call `page.pause()` or `workbench.pause()` in an unattended script. Use
accessibility roles, labels, and stable `data-*` attributes instead of deeply
nested CSS selectors.

Use Playwright directly over the existing CDP connection. A Playwright MCP
server can help with interactive exploration, but do not make it a prerequisite
for unattended execution. Let `start-vscode` own VS Code startup, profile
cloning, debugger ports, and cleanup; do not launch another browser or VS Code
instance from the script.

Do not use fixed sleeps to decide when VS Code is ready. Use
`locator.waitFor()` or a bounded polling helper to wait for the smallest
observable condition that proves the next step can proceed, such as a visible
control, an open dialog, expected editor text, or the complete contents of a
dynamic list. Include the last observed state in timeout errors. Small delays
are acceptable only for animation or screenshot stabilization after readiness
is established.

Scope locators to the relevant view, dialog, quick pick, menu, or editor.
Prefer accessible roles and names, then stable `data-*` attributes or
workbench classes. Avoid full-page `innerText()` assertions, which can match
hidden or stale content. For collections, verify required entries, absent
entries, and duplicates.

After **Developer: Reload Window**, workspace changes, or window-management
commands, do not assume the original `Page` remains valid. Keep the CDP
connection open, reacquire the non-closed page whose URL contains
`workbench.html`, wait for a known workbench control, and reattach console and
error listeners if the page was replaced.

`runCommand` uses F1 after dismissing transient UI, then clicks the one
quick-pick option whose visible label exactly matches the requested command.
Do not replace this with `Ctrl+Shift+P` or an unqualified Enter: a restored
terminal can consume the shortcut, and the palette can include an
`Ask in Chat` result.

Use the shared helpers for:

- `runCommand` to invoke workbench commands;
- `clickExactQuickPickOption` for non-command quick picks;
- `selectQuickPickCheckbox` for tree-style pickers such as **Create Plugin**;
- `reacquireWorkbench` after reload or page replacement;
- `visibleElementCount`, `visibleTexts`, and `waitForInventory` for scoped
  collection assertions;
- `visibleCustomizationNames` and `waitForCustomizationInventory` when rows
  include both a name and description;
- `activeModalEditorUri` to prove the backing file of a customization opened
  in the modal editor;
- `captureScreenshot` with `transient: true` for menus and context views that
  a normal Playwright screenshot dismisses;
- `prepareHandoffSignal` and `waitForHandoffSignal` when an OS-native dialog
  must be completed outside renderer CDP;
- `EvidenceRecorder` for console, page-error, and failed-request evidence;
- `runStep` for step-specific failure context and screenshots;
- `writeRunTiming` for automation and orchestration timing.

`waitForInventory` treats every `present` value as exactly one visible entry,
so it also detects duplicates. Use `exact` when the complete inventory is a
requirement and `absent` for deleted or invalid entries.

Capture `ORCHESTRATION_STARTED_AT` before selector exploration. After resetting
the fixture, run the persisted script with the launcher's renderer endpoint:

```powershell
$env:ORCHESTRATION_STARTED_AT = (Get-Date).ToUniversalTime().ToString('o')
# Perform bounded selector exploration, then reset the fixture.
$env:TEST_ROOT_DIR = (Resolve-Path '<test-root-dir>').Path
$env:VSCODE_CDP_ENDPOINT = '<renderer endpoint printed by start-vscode>'
node <test-root-dir>\test-script.mts
```

Example skeleton:

```typescript
import { join } from 'node:path';
import {
	connectToWorkbench,
	EvidenceRecorder,
	parseTimestamp,
	readRequiredEnvironment,
	reacquireWorkbench,
	runCommand,
	runStep,
	waitForInventory,
	writeRunTiming,
} from '../../.github/skills/tpi-test/playwright-workbench-utils.mts';

const rootDir = readRequiredEnvironment('TEST_ROOT_DIR');
const endpoint = readRequiredEnvironment('VSCODE_CDP_ENDPOINT');
const orchestrationStartedAt = parseTimestamp(
	readRequiredEnvironment('ORCHESTRATION_STARTED_AT'),
	'orchestration start',
);
const automationStartedAt = new Date();
const evidence = new EvidenceRecorder();
const { browser, workbench: initialWorkbench } =
	await connectToWorkbench(endpoint);
let workbench = initialWorkbench;
evidence.attach(workbench);

try {
	await runStep('Open customizations', workbench, join(rootDir, 'screenshots'), async () => {
		await runCommand(workbench, 'Chat: Open Customizations');
		// Scope rows to the visible dialog or view before asserting them.
		const rows = workbench.locator('[data-testid="customization-row"]');
		await waitForInventory(rows, { present: ['agent-one', 'agent-two'] });
	});

	await runCommand(workbench, 'Developer: Reload Window');
	workbench = await reacquireWorkbench(browser);
	evidence.attach(workbench);
} finally {
	await evidence.write(join(rootDir, 'console.json'));
	await writeRunTiming(
		join(rootDir, 'timing.json'),
		orchestrationStartedAt,
		automationStartedAt,
	);
	await browser.close();
}
```

The selector in the skeleton is illustrative; replace it with an observed
accessible locator or an actual stable `data-*` identifier. On failure, record
the failed step, awaited condition, last observed state, screenshot, and
console or page errors. Document reliance on coordinates, DOM-dispatched
events, or direct filesystem changes as execution deviations.

`EvidenceRecorder` captures warning and error console messages by default,
plus page errors and failed requests. Opt into additional console types only
when the approved plan requires them, and use its `shouldRecord` option to keep
the persisted evidence relevant. Query strings and fragments are removed from
recorded source URLs; still review evidence for sensitive values before
preserving it.

## Current customization selectors and labels

Prefer observed accessible roles and names. The following selectors were
verified against Insiders `1.139.0-insider` and should be rediscovered if the
UI changes:

- Harness buttons: `getByRole('button', { name: 'Local', exact: true })` and
  `getByRole('button', { name: 'Copilot', exact: true })`.
- Agents navigation: `getByRole('listitem', { name: /Agents, \d+ items/ })`.
- Customization names: `.ai-customization-list-item .item-name`, scoped to the
  relevant Workspace, User, Plugins, or Built-in group.
- Chat agents: `getByRole('menuitemcheckbox')`, scoped to the visible
  `.context-view`.
- The personal/global group is currently labeled **User**.
- The modal customization editor exposes its backing URI on
  `.monaco-modal-editor-block .monaco-editor[data-uri]`.
- **New Agent** uses separate location and filename quick picks. Verify the
  chosen source folder and resulting URI rather than relying only on the
  displayed agent name.

## Agent Plugin workflows

- **Create Plugin** uses a tree-style resource picker. Selecting an entry
  requires clicking the entry's separate `role=checkbox`; clicking its label
  alone does not select it. Use `selectQuickPickCheckbox`.
- **Install from Source** opens a text prompt named
  `owner/repo, git URL, or local folder path`. Enter the absolute local plugin
  folder; it is not the simple folder picker used for the plugin save
  location.
- Plugin management can appear under the Local harness even when the packaged
  customization is intended for Copilot. Test both the management surface and
  the target harness, and record missing source labels or groups as product
  behavior rather than silently switching expectations.
- If plugin activation is ambiguous after reload, close only the isolated
  window, relaunch the same root with `start-vscode`, and verify installed
  state before classification. The relaunch overwrites
  `launch-metadata.json`, so preserve earlier metadata first when both launches
  are evidence.

## Native dialog handoff

Renderer CDP cannot accept every OS-native dialog. For an approved workflow
that requires one:

1. Call `prepareHandoffSignal(<root-dir>/handoff/<step>.complete)`.
2. Emit the action through `runStep` and trigger the native dialog.
3. Call `waitForHandoffSignal` with a bounded timeout.
4. The runner foregrounds only the isolated VS Code window, completes the
   native dialog, and creates the exact signal file.
5. Resume with observable filesystem and workbench assertions.

Record the handoff as a deviation. Never use a fixed sleep or terminate
unrelated processes.

## Capture Evidence

Capture the evidence required by the approved plan, including:

- relevant workbench text and screenshots;
- browser console messages;
- page errors and failed requests;
- relevant VS Code logs from
  `<root-dir>/user-data-dir/logs`;
- timestamps;
- `<root-dir>/timing.json` containing automation and orchestration durations.

Identify the directory for the current VS Code session and preserve only
relevant log files or excerpts, such as window, renderer, extension-host,
shared-process, and extension-specific logs. Keep their relative source paths
so the producing process is clear.

Do not include unrelated log content, credentials, tokens, or other sensitive
values in test artifacts.
