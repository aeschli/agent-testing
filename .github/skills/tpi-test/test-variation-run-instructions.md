These instructions guide a test runner session on how to perform their tasks, including launching the isolated TPI instance, observing and executing test items, and recording results.

The test runner session should get these instructions along with
- instructions what to test. That can be a reference to the test plan along with the name of the variation to test.
- the <test-root-dir> which is used as working directory and where results are stored.

Each test runner session has an isolated `<test-root-dir>` located at
`<test-id>/<test-variation-name>/`. The launcher creates this structure:

```text
<test-root-dir>/
  workspace/
  user-data-dir/
  extensions-dir/
  screenshots/
  vscode-logs/
  reported-issues/
```

### 1 Launch Isolated TPI Instance

Launch the isolated TPI instance:

```powershell
npm run start-vscode -- --root-dir <test-root-dir>
```

The launcher prepares the isolated profile, starts the latest Insiders build,
validates both debugger endpoints, prints the version, commit, build date,
root process ID, ports, and URLs, and writes them to
`<test-root-dir>/launch-metadata.json`. Use that file as the authoritative
launch record. The extension-host endpoint is the initial endpoint and may
change after a reload. Trust the test workspace and dismiss first-run sign-in
or onboarding dialogs before capturing test evidence. Confirm that the cloned
profile is signed in before continuing.
If the source session has expired, ask the user to refresh it in the source
profile rather than signing into the isolated test profile.

### 2 Observe and Execute

Follow [Observe and execute VS Code with Playwright](./observe-and-execute.md)
for interactive observation, unattended execution, and evidence capture.
These instructions are required for every test item.

### 3 Run and Record Results

Execute each test item according to the approved plan. Record observations, capture evidence, and note any deviations from the expected behavior. Ensure that all steps are followed precisely to maintain the integrity of the test results.

Execute test items in the approved order. Create required fixtures only under
`<test-root-dir>/workspace` unless the approved plan specifies otherwise.
Do not silently change the plan while testing; record deviations and ask for
approval when they materially alter scope or expected behavior.

Store each test item's evidence using this layout:

```text
<test-root-dir>/
  workspace/
  user-data-dir/
  extensions-dir/
  screenshots/
  vscode-logs/
  reported-issues/
  launch-metadata.json
  test-result.md
  test-script.mts
```

Include only artifacts relevant to that test-variation; `vscode-logs`, `console.json`, and
`test-script.mts` are optional. Copy only the relevant VS Code logs or excerpts
from `<test-root-dir>/user-data-dir/logs`, preserving enough of their source
directory structure to identify the session and process. Each `test-result.md` must
record:

- source issue URL and test-variation name;
- origin: `TPI` or `Exploratory`;
- research sources or hypotheses relevant to the expected behavior;
- status: `Passed`, `Failed`, or `Blocked`;
- tested Insiders version and commit;
- the relative link to `launch-metadata.json`;
- environment and prerequisites;
- steps performed;
- expected result;
- actual result;
- relevant browser console, VS Code log, or debugger output, including the original VS Code log path;
- deviations from the approved plan;
- test-variation-relative links to screenshots and other evidence;
- issues to report in `reported-issues/`.

When done, close the isolated Insiders window and any inspector sessions
started by this workflow, but do not terminate unrelated VS Code or Node
processes. If a clean relaunch is required for recovery, reuse the same test
root and verify persisted state before continuing; record the relaunch and
preserve the relevant launch metadata.

### 4: Reflect and Improve

Consider what went well and what could be improved in the testing process.
Write findings to `<test-root-dir>/testing-improvements.md`.
- If some steps were difficult to perform in VS Code, note the specific challenges and any workarounds used. Suggest improvements to VS Code such as UI enhancements, better documentation, or additional automation support.
- If testing was slow suggest potential optimizations or improvements to speed up the process.
- If this Skill was not clear, provide feedback on which parts were confusing or lacked sufficient detail. Suggest improvements to make the instructions more understandable and actionable.

Make concrete suggestions:
- What needs to be improved in VS Code.
- What needs to be improved in this skill and its resources, such as scripts
  and documentation. Implement safe, reusable skill improvements when they are
  directly supported by the completed run; leave product changes as proposals.