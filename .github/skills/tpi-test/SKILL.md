---
name: tpi-test
description: "Test a GitHub TPI issue against the latest VS Code Insiders build. Use when given a GitHub issue URL that contains manual test-plan items requiring Playwright workbench observation, screenshots, console evidence, or extension-host debugging."
---

# TPI Test

The required input is			
- the GitHub issue URL of a test plan item
or 
- a textual description of the test scenario.

If you get a textual description of the test scenario, the create a issue in this repository (https://github.com/aeschli/agent-testing). Check with the user before proceeding to ensure that the issue accurately reflects the intended test scenario.

Load the GitHub issue or textual description to begin the test planning process.

## Phase 1: Read and understand the issue

1. Validate that the input is a GitHub issue URL and extract its owner, repository, and numeric issue number.
2. Set the issue number for the current PowerShell session:

	 ```powershell
	 $env:TPI_ID = '<repo-name>-<TPI_ID>-<timestamp>'
	 ```

3. Fetch the issue title, body, and relevant comments with an available GitHub tool or the GitHub API. If the issue is private and cannot be read, ask the user to authenticate through the available GitHub integration; never request or print a token.
4. Identify each explicit test item, its expected behavior, prerequisites, and any platform or configuration constraints. Preserve the source issue URL in the test plan.
5. Build enough feature context to design tests beyond the literal TPI steps. Research relevant release notes, official documentation, linked issues or pull requests, source code, existing tests, settings, commands, and related behavior. Prefer primary sources and record the links or repository paths used. Do not treat assumptions or third-party descriptions as product requirements.
6. From the issue and research, identify the feature's user goal, supported variations, state transitions, integration points, likely failure modes, and areas affected by the change. Clearly distinguish documented behavior from exploratory hypotheses.

## Phase 2: Prepare the Environment

Run `npm install` to ensure all required dependencies, including Playwright, `@vscode/test-electron`, and `@hediet/dbgjs` are installed before proceeding.

### Verify VS Code Insiders

The launch scripts use `@vscode/test-electron` to resolve and download the
latest Insiders build. Downloads are cached under `.vscode-test`; the API
checks the Insiders channel before launch and reuses the cached build when it
is current. If the download or version resolution fails, stop and report the
blocker instead of falling back to an installed or stable build.

### Create an Authenticated Source Profile for VS Code Insiders

Create or refresh that authenticated source profile before using the test
launcher:

```powershell
npm run setup-authenticated-user-data
```

In the window that opens:

1. Sign in to GitHub from the Accounts menu and complete the browser flow.
2. Confirm that the Accounts menu shows the expected GitHub account.
3. Close that Insiders window so its storage databases are flushed and no
   source files remain locked.

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
- the requested `insiders` channel, with placeholders for the exact version
  and commit to record after launch;
- prerequisites, setup files, settings, and extensions;
- numbered actions and expected results for every test item;
- exploratory charters, hypotheses, time or scope bounds, and stopping conditions;
- the Playwright observations, screenshots, browser console messages, VS Code log files, or debugger evidence to capture;
- cleanup steps and any known risks.

Present the plan to the user and explicitly ask for approval. **Stop here. Do not launch the test instance, create test fixtures, install test-specific extensions, or execute any test item until the user approves the plan.** Environment inspection, version upgrade, directory creation, and Playwright installation may occur before approval.

## Phase 4: Launch VS Code Insiders for testing

Then launch the isolated TPI instance:

```powershell
npm run start-vscode -- --tpi-id $env:TPI_ID
```

The launcher prepares the isolated profile, starts the latest Insiders build,
validates both debugger endpoints, and prints their ports and URLs. Use those
printed values for observation and debugging. Trust the test workspace and
dismiss first-run sign-in or onboarding dialogs before capturing test
evidence. Confirm that the cloned profile is signed in before continuing.
If the source session has expired, ask the user to refresh it in the source
profile rather than signing into the isolated test profile.

## Phase 5: Observe and Execute

Follow [Observe and execute VS Code with Playwright](./observe-and-execute.md)
for interactive observation, unattended execution, and evidence capture.
These instructions are required for every test item.

When an approved test requires source-level evidence, also follow
[Observe and debug VS Code](./observe-and-debug.md) for extension-host
debugging.

## Phase 5: Perform Tests

Execute each test item according to the approved plan. Record observations, capture evidence, and note any deviations from the expected behavior. Ensure that all steps are followed precisely to maintain the integrity of the test results.

## Phase 6: Record Results

Store each test item's evidence using this layout:

```text
<TPI_ID>/tests/<test-item-name>/
	test.md
	screenshots/
	vscode-logs/
	reported-issues/
	chat-session-log/
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
- store issue to report in `reported-issues/`
- store the chat session log in `chat-session-log/

Finish with a concise summary in `<TPI_ID>/test-summary.md` listing every item and its status. Close the isolated Insiders window and any inspector sessions started by this workflow, but do not terminate unrelated VS Code or Node processes.

## Phase 7: Reflect on test run

In this phase, consider what went well and what could be improved in the testing process.
- If some steps were difficult to perform in VS Code, note the specific challenges and any workarounds used. Suggest improvements to VS Code such as UI enhancements, better documentation, or additional automation support.
- If this Skill was not clear, provide feedback on which parts were confusing or lacked sufficient detail. Suggest improvements to make the instructions more understandable and actionable.