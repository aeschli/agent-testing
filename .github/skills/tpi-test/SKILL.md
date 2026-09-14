---
name: tpi-test
description: "Test a GitHub TPI issue against the latest VS Code Insiders build. Use when given a GitHub issue URL that contains manual test-plan items requiring Playwright workbench observation, screenshots, console evidence, or extension-host debugging."
---

# TPI Test

The required input is
- a GitHub issue URL that describes what to test in VS Code
- a textual description of the test scenario.

If you get a textual description of the test scenario, the create a issue in this repository (https://github.com/aeschli/agent-testing). Check with the user before proceeding to ensure that the issue accurately reflects the intended test scenario.

If no textual description is provided, ask the user to supply one before proceeding.

## Phase 1: Read the Issue

1. Validate that the input is a GitHub issue URL and extract its owner, repository, and numeric issue number.
2. Set the issue number for the current PowerShell session:

	 ```powershell
	 $env:TPI_ID = '<repo-name>-<TPI_ID>'
	 ```

3. Fetch the issue title, body, and relevant comments with an available GitHub tool or the GitHub API. If the issue is private and cannot be read, ask the user to authenticate through the available GitHub integration; never request or print a token.
4. Identify each explicit test item, its expected behavior, prerequisites, and any platform or configuration constraints. Preserve the source issue URL in the test plan.
5. Build enough feature context to design tests beyond the literal TPI steps. Research relevant release notes, official documentation, linked issues or pull requests, source code, existing tests, settings, commands, and related behavior. Prefer primary sources and record the links or repository paths used. Do not treat assumptions or third-party descriptions as product requirements.
6. From the issue and research, identify the feature's user goal, supported variations, state transitions, integration points, likely failure modes, and areas affected by the change. Clearly distinguish documented behavior from exploratory hypotheses.

## Phase 2: Prepare the Environment

### Verify VS Code Insiders

On Windows, compare the installed version with the latest published version:

```powershell
$installedVersion = (code-insiders --version | Select-Object -First 1).Trim()
$latestVersion = (Invoke-RestMethod 'https://update.code.visualstudio.com/api/update/win32-x64-user/insider/latest').productVersion
$installedVersion
$latestVersion
```

If the versions differ, run:

```powershell
winget upgrade --id Microsoft.VisualStudioCode.Insiders --exact --force --accept-source-agreements --accept-package-agreements
```

Run both version checks again after the upgrade. If `code-insiders`, `winget`, or the update API is unavailable, or the versions still differ, stop and report the blocker instead of claiming that the latest build was tested.

### Create Isolated Directories

Create these directories beneath the current workspace without deleting existing evidence:

```text
<$env:TPI_ID>/
	workspace/
	user-data-dir/
	extensions-dir/
	tests/
```

Reuse an existing issue directory only when continuing the same test run. Otherwise, ask before overwriting files from an earlier run.

### Reserve Debug Ports

Use renderer port `9222` and extension-host port `9333` by default. Before launch, verify that neither port is already listening:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 9222,9333 -ErrorAction SilentlyContinue
```

If either port is occupied, do not attach to it blindly. Select unused local ports, update all later commands consistently, and set `VSCODE_CDP_ENDPOINT` to the selected renderer endpoint. Keep the endpoints on `127.0.0.1`; debugger access permits control of the corresponding process and must not be exposed to an untrusted network.

### Install Playwright

If Playwright is not already declared in this project's `package.json`, install it:

```powershell
npm install --save-dev playwright
```

## Phase 3: Write the Plan and Stop for Approval

Design a focused set of tests rather than mechanically copying the issue steps. The approved plan must fully cover every explicit TPI requirement and also include relevant exploratory testing of the feature. Consider these dimensions and include the ones that could reveal meaningful defects:

- primary workflow and expected successful outcome;
- meaningful input, file-type, language, setting, or configuration variations;
- boundary, empty, invalid, unavailable, cancellation, and recovery behavior;
- repeated use, state persistence, reload, restart, and workspace transitions;
- interaction with adjacent commands, views, keybindings, extensions, or platform behavior;
- keyboard operation, focus, accessibility labels, and visible feedback for UI features;
- likely regression paths identified from linked changes, source code, or existing tests.

Do not add variations only to inflate the test count. Prioritize cases by user impact, likelihood of failure, and the change's implementation risk. Keep exploratory work bounded with a clear charter, evidence to collect, and stopping condition. If research does not establish an expected result, label the case as exploratory and describe the behavior being investigated rather than inventing a requirement.

Create `<$env:TPI_ID>/test-plan.md` before performing any test item. The plan must contain:

- the source issue URL and extracted test items;
- a concise feature summary and links or repository paths for research sources;
- a coverage matrix mapping every explicit TPI requirement to one or more planned tests;
- each test's origin, labeled `TPI` or `Exploratory`, and its priority;
- the installed and latest Insiders versions;
- prerequisites, setup files, settings, and extensions;
- numbered actions and expected results for every test item;
- exploratory charters, hypotheses, time or scope bounds, and stopping conditions;
- the Playwright observations, screenshots, browser console messages, VS Code log files, or debugger evidence to capture;
- cleanup steps and any known risks.

Present the plan to the user and explicitly ask for approval. **Stop here. Do not launch the test instance, create test fixtures, install test-specific extensions, or execute any test item until the user approves the plan.** Environment inspection, version upgrade, directory creation, and Playwright installation may occur before approval.

## Phase 4: Launch VS Code Insiders

After approval, configure the isolated profile to open directly on the test
workspace rather than showing the Welcome editor:

```json
{
	"workbench.startupEditor": "none",
	"window.dialogStyle": "custom"
}
```

Merge this setting with any test-specific settings instead of replacing them.
Custom dialogs keep supported confirmations and information dialogs within the
workbench renderer so Playwright can observe and capture them.
Before launching, check whether the selected renderer endpoint already belongs
to an instance using this issue's `user-data-dir`. Reuse that instance rather
than launching a second window. Do not close or modify unrelated VS Code
windows.

When there is no existing instance for this issue, launch exactly one isolated
VS Code Insiders window with the selected ports:

```powershell
code-insiders `
	--new-window `
	--user-data-dir ".\$env:TPI_ID\user-data-dir" `
	--extensions-dir ".\$env:TPI_ID\extensions-dir" `
	--remote-debugging-address=127.0.0.1 `
	--remote-debugging-port=9222 `
	--inspect-extensions=9333 `
	".\$env:TPI_ID\workspace"
```

When alternate ports were selected, substitute them in this command and all commands below. Confirm that the endpoints belong to the newly launched isolated instance:

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/version
Invoke-RestMethod http://127.0.0.1:9222/json/list |
	Select-Object title, url, webSocketDebuggerUrl
Invoke-RestMethod http://127.0.0.1:9333/json/list |
	Select-Object title, type, webSocketDebuggerUrl
```

Verify that the renderer endpoint exposes exactly one workbench page and that
its title is the test workspace. If it exposes multiple workbench pages, stop
and close only surplus windows belonging to this issue's isolated
`user-data-dir`; never close unrelated VS Code windows. Trust the test
workspace and dismiss first-run sign-in or onboarding dialogs before capturing
test evidence. If authentication is required for the test, ask the user to
complete it rather than selecting a signed-out path.

Record the tested version and commit from `code-insiders --version`. Also
confirm that the isolated workbench URL contains the same commit. Open
**About** and confirm that it agrees with the command-line version. If the
platform ignores the custom-dialog setting and renders **About** outside
Playwright's automation surface, record that limitation and use the CLI and
workbench URL checks; do not use system-wide keystroke or window automation
solely to inspect it.


Now ask the user to sign in with GitHub in VS Code Insiders before proceeding to Phase 5.

## Phase 5: Observe and Execute

### Interactive Observation

Use the bundled observer only when a human will work with Playwright Inspector:

```powershell
$env:PWDEBUG = '1'
$env:VSCODE_CDP_ENDPOINT = 'http://127.0.0.1:9222'
node .copilot/skills/tpi-test/observe-vscode.js
```

The observer connects over CDP, prints discovered pages, selects the workbench, and pauses in Playwright Inspector. It is not an unattended test runner.

### Unattended Execution

For agent-driven execution, create a test-specific Playwright script under `<TPI_ID>/tests/<test-item-name>/` that connects with `chromium.connectOverCDP`. Do not call `page.pause()` or `workbench.pause()` in an unattended script. Use accessibility roles, labels, and stable `data-*` attributes instead of deeply nested CSS selectors.

Capture the evidence required by the approved plan, including relevant workbench text, screenshots, browser console messages, page errors, and failed requests. Also inspect the VS Code logs written by the isolated instance under `<TPI_ID>/user-data-dir/logs`. Identify the directory for the current VS Code session and preserve relevant files or excerpts, such as window, renderer, extension-host, shared-process, and extension-specific logs. Keep their relative source paths so the producing process is clear. Do not include unrelated log content, credentials, tokens, or other sensitive values in test artifacts.

Use the extension-host debugger only when the test requires source-level evidence:

```powershell
node inspect 127.0.0.1:9333
```

For programmatic breakpoints, stack frames, console events, or expression evaluation, use a Node Inspector Protocol client. Relaunch with `--inspect-brk-extensions=9333` only when extension activation must pause before running.

Execute test items in the approved order. Create required fixtures only under `<TPI_ID>/workspace` unless the approved plan specifies otherwise. Do not silently change the plan while testing; record deviations and ask for approval when they materially alter scope or expected behavior.

## Phase 6: Record Results

Store each test item's evidence using this layout:

```text
<TPI_ID>/tests/<test-item-name>/
	test.md
	screenshots/
	vscode-logs/
	console.log
	test-script.js
```

Include only artifacts relevant to that item; `vscode-logs`, `console.log`, and `test-script.js` are optional. Copy only the relevant VS Code logs or excerpts from `<TPI_ID>/user-data-dir/logs`, preserving enough of their source directory structure to identify the session and process. Each `test.md` must record:

- source issue URL and test-item name;
- origin: `TPI` or `Exploratory`;
- research sources or hypotheses relevant to the expected behavior;
- status: `Passed`, `Failed`, or `Blocked`;
- tested Insiders version and commit;
- environment and prerequisites;
- steps performed;
- expected result;
- actual result;
- relevant browser console, VS Code log, or debugger output, including the original VS Code log path;
- deviations from the approved plan;
- workspace-relative links to screenshots and other evidence.

Finish with a concise summary in `<TPI_ID>/test-summary.md` listing every item and its status. Close the isolated Insiders window and any inspector sessions started by this workflow, but do not terminate unrelated VS Code or Node processes.