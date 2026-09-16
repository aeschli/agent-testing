# Observe and execute VS Code with Playwright

Use these instructions only after the test plan is approved and
`start-vscode` has launched the isolated VS Code Insiders instance. Use the
renderer endpoint printed by the launcher.

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

Use the shared helpers for:

- `runCommand` to invoke workbench commands;
- `reacquireWorkbench` after reload or page replacement;
- `visibleElementCount`, `visibleTexts`, and `waitForInventory` for scoped
  collection assertions;
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
