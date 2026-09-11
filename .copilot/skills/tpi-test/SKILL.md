---
name: tpi-test
description: Test a GitHub TPI issue against the latest VS Code Insiders build using Playwright observation and debugger attachment.
---

You need a test plan item as input. The test plan item comes as a link to a github issue.

Remember the issue number in env variable `TPI_ISSUE_NUMBER`.

## setup latest code insiders

Run `code-insiders --version` and verify that this is the latest insiders version.

On Windows:

Use `(Invoke-RestMethod 'https://update.code.visualstudio.com/api/update/win32-x64-user/insider/latest').productVersion` to get the latest insiders version.

Run `winget upgrade --id Microsoft.VisualStudioCode.Insiders --force` to upgrade to the latest insiders version if required.


### set up a workspace

create a new folder for the workspace in this workspace:

`./$env:TPI_ISSUE_NUMBER/workspace`

## launch an observable and debuggable VS Code Insiders 

Then launch an isolated VS Code Insiders instance with renderer and extension-host debugging enabled:

```powershell
code-insiders `
	--user-data-dir ".\$env:TPI_ISSUE_NUMBER\user-data-dir" `
	--extensions-dir ".\$env:TPI_ISSUE_NUMBER\extensions-dir" `
	--remote-debugging-port=9222 `
	--inspect-extensions=9333 `
  .\$env:TPI_ISSUE_NUMBER\workspace
```

Using an isolated user-data directory prevents an existing VS Code process from absorbing the launch arguments. Verify the renderer endpoint before continuing:

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/version
```

Ensure this project has Playwright available:

```powershell
npm install --save-dev playwright
```

Set `PWDEBUG` and run the observer script bundled with this skill:

```powershell
$env:PWDEBUG = '1'
node .copilot/skills/tpi-test/observe-vscode.js
```

The script connects to the VS Code renderer over CDP, prints the discovered pages, selects the workbench, and opens Playwright Inspector. Use accessibility roles, labels, and stable `data-*` attributes instead of deeply nested CSS selectors.

### connect an agent to the debug ports


Discover the renderer and extension-host targets before attaching:

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json/list |
	Select-Object title, url, webSocketDebuggerUrl

Invoke-RestMethod http://127.0.0.1:9333/json/list |
	Select-Object title, type, webSocketDebuggerUrl
```

For renderer observation and UI interaction, connect Playwright to `http://127.0.0.1:9222` with `chromium.connectOverCDP`. The bundled `observe-vscode.js` demonstrates this connection. For unattended agent testing, use a task-specific Playwright script without `page.pause()` and capture relevant text, console messages, screenshots, and errors as test evidence.

For extension-host source debugging, an agent can attach Node's command-line inspector:

```powershell
node inspect 127.0.0.1:9333
```

Use a Node Inspector Protocol client when the agent needs programmatic breakpoints, stack frames, console events, or expression evaluation. Launch with `--inspect-brk-extensions=9333` instead of `--inspect-extensions=9333` when extension activation must pause until the client attaches.

Keep both debug ports bound to `127.0.0.1`. Do not expose them to an untrusted network because an attached client can control the corresponding process.

---

Once the agent is connected and the workspace is set up, open the About dialog and verify the VS Code version.


Proceed with executing the test plan items while observing the workbench. 

Come up with a plan at .\$env:TPI_ISSUE_NUMBER\test-plan.md.

Now, execute the testing according to the plan you have devised.
Ask the user to review the plan before executing the test items.

Then execute the test items as per the plan.

- create files in the workspace that are needed to execute the test plan items
- execute the test items as per the plan.   
- record the results for each test plan item in a test.md file for each test item under .\$env:TPI_ISSUE_NUMBER\tests\<test-item-name>.md:
  - Record the tested Insiders version, steps performed, expected result, actual result, and relevant console or debugger output.
  - Include any relevant screenshots and links to them.

If this SKILL.md file needs improvement, update it with clearer instructions, additional context, or corrections as necessary.