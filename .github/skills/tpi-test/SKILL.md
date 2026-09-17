---
name: tpi-test
description: "Test a GitHub TPI issue against the latest VS Code Insiders build. Use when given a GitHub issue URL that contains manual test-plan items requiring Playwright workbench observation, screenshots, console evidence, or extension-host debugging."
argument-hint: The URL of the GitHub issue or a textual description of the test scenario.
---

# TPI Test

The required input is either:

- the GitHub issue URL of a test plan item; or
- a textual description of the test scenario.

If you receive a textual description of the test scenario, draft an issue for this repository (https://github.com/aeschli/agent-testing). Before creating the issue, ask the user to confirm that the draft accurately reflects the intended test scenario.

Load the GitHub issue or textual description to begin the test planning process.

## Phase 1: Read and understand the issue

1. Validate that the input is a GitHub issue URL and extract its owner, repository, and numeric issue number.
2. Compose the test ID from the repository name, issue number, and a timestamp:

	 ```powershell
	 $env:TEST_ID = '<repo-name>-<issue-number>-<timestamp>'
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

If the authentication source directories do not exist, the test launcher opens
an Insiders profile for GitHub sign-in and resumes after that window closes.

### Create Isolated Directories

Create a folder named `<test-id>` in the current workspace without deleting
existing evidence. Each test variation will use an isolated root at
`<test-id>/<test-variation-name>/`.

Reuse an existing issue directory only when continuing the same test run. Otherwise, ask before overwriting files from an earlier run.


## Phase 3: Write the Plan and Stop for Approval

Design a focused set of tests rather than mechanically copying the issue steps. The approved plan must fully cover every explicit TPI requirement and also include relevant exploratory testing of the feature. Consider these dimensions and include the ones that could reveal meaningful defects:

- primary workflow and expected successful outcome;
- meaningful input, file-type, language, setting, or configuration variations;
- boundary, empty, invalid, unavailable, cancellation, and recovery behavior;
- interaction with adjacent commands, views, keybindings, extensions, or platform behavior;
- likely regression paths identified from linked changes, source code, or existing tests.

Do not add variations only to inflate the test count. Prioritize cases by user impact, likelihood of failure, and the change's implementation risk. Keep exploratory work bounded with a clear charter, evidence to collect, and stopping condition. If research does not establish an expected result, label the case as exploratory and describe the behavior being investigated rather than inventing a requirement.

Create `<test-id>/test-plan.md` before performing any testing. The plan must contain:

- the source issue URL and extracted test variations;
- a concise feature summary and links or repository paths for research sources;
- a coverage matrix mapping every explicit TPI requirement to one or more planned tests;
- each test variation's origin, labeled `TPI` or `Exploratory`, and its priority;
- each test variation's `<test-variation-name>` and resulting
  `<test-root-dir>` (`<test-id>/<test-variation-name>/`);
- the requested `insiders` channel, with placeholders for the exact version
  and commit to record after launch;
- prerequisites, setup files, settings, and extensions;
- numbered actions and expected results for every test item;
- exploratory charters, hypotheses, time or scope bounds, and stopping conditions;
- the Playwright observations, screenshots, browser console messages, VS Code log files, or debugger evidence to capture;
- cleanup steps and any known risks.

Present the plan to the user and explicitly ask for approval. **Stop here. Do not launch the test instance, create test fixtures, install test-specific extensions, or execute any test item until the user approves the plan.** Environment inspection, version upgrade, directory creation, and Playwright installation may occur before approval.

## Phase 4: Coordinate Testing

We run each test variation as an independent subsession.

Each subsession operates independently, maintaining its own state and context throughout the test variation.

Each subsession has its own root directory within the test structure:  `<test-root-dir>` at (`<test-id>/<test-variation-name>/`);

Write the subsession's test plan, including setup, execution, and teardown steps, in its `<test-root-dir>/test-plan.md`.

Instructions for the subsessions can be found in [Test Variation Run Instructions](./test-variation-run-instructions.md)

Provide each subsession with this document, its `<test-root-dir>`, its test plan, the test variation name, setup instructions, and any relevant dependencies.

Instruct each subsession to record important decisions, blockers, commands,
and evidence in its `<test-root-dir>/test-result.md`. Treat this file as the authoritative record of the test variation.

Run the subsessions in sequence.

Every 60 seconds:

- retrieve the latest available conversation context for each subsession and
  save it as a timestamped snapshot under
  `<test-root-dir>/chat-session-log/`. Treat these files as progress snapshots,
  not guaranteed complete raw session transcripts;
- give a status update on the progress of each subsession.

## Phase 5: Conclude

Once all subsessions have completed their testing:

Finish with a concise summary in `<test-id>/test-summary.md` listing every test variation and its status. Also add timing information for each test variation. Use each test variation's `test-result.md`.
