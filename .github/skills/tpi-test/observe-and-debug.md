# Observe and debug VS Code

Use these instructions only after the test plan is approved and
`start-vscode` has launched the isolated VS Code Insiders instance. Use the
extension-host endpoint printed by the launcher.

Only attach the debugger when the approved test requires source-level
evidence. Do not attach to unrelated VS Code processes or debugger endpoints.

## Connect to the Extension Host

Set the extension-host endpoint to the value printed by `start-vscode`:

```powershell
$env:VSCODE_EXTENSION_HOST_ENDPOINT = '<extension-host endpoint printed by start-vscode>'
```

Resolve its Node Inspector WebSocket endpoint:

```powershell
$targets = Invoke-RestMethod "$env:VSCODE_EXTENSION_HOST_ENDPOINT/json/list"
$target = $targets | Select-Object -First 1
$target.webSocketDebuggerUrl
```

Stop and report a blocker if no target or `webSocketDebuggerUrl` is returned.
Do not substitute an endpoint from another VS Code instance.

Create and select a `dbgjs` connection:

```powershell
npx --no-install dbgjs connection add `
	--node-inspector $target.webSocketDebuggerUrl `
	--connection vscode-extension-host `
	--connect `
	--set
```

Inspect the available targets and attach the intended extension-host target:

```powershell
npx --no-install dbgjs target list
npx --no-install dbgjs target attach --set
```

Use `npx --no-install dbgjs-tui` for an interactive debugger UI. In the TUI,
use `c` to configure a connection, `a` to attach a target, `b` to toggle a
breakpoint, and `q` to quit.

## Inspect Sources and Set Breakpoints

List or search loaded sources before setting a breakpoint:

```powershell
npx --no-install dbgjs source list --path '<source-path-substring>'
npx --no-install dbgjs source grep '<search-text>' --path '<source-path-substring>'
```

Use the source URL reported by `dbgjs` when setting the breakpoint. Line
numbers are one-based:

```powershell
npx --no-install dbgjs breakpoint set `
	<breakpoint-id> `
	'<source-url>' `
	<line>
```

Confirm that the breakpoint is installed before performing the UI action that
should trigger it:

```powershell
npx --no-install dbgjs target wait breakpoint-installed <breakpoint-id> 30000
```

## Observe a Paused Target

After triggering the approved test action, wait for the target to pause:

```powershell
npx --no-install dbgjs target wait paused 0 60000
```

Inspect the selected target and evaluate only expressions required by the test:

```powershell
npx --no-install dbgjs target show
npx --no-install dbgjs target eval '<expression>'
```

Use the debugger controls as needed:

```powershell
npx --no-install dbgjs target step over
npx --no-install dbgjs target step into
npx --no-install dbgjs target step out
npx --no-install dbgjs target resume
```

Avoid evaluations with side effects unless the approved test explicitly
requires them.

## Capture Debugger Evidence

Record only evidence required by the approved plan, such as:

- the selected connection and target;
- resolved source URL and breakpoint location;
- breakpoint installation and paused-target output;
- relevant stack, expression, console, or source observations;
- debugger errors or deviations from the approved procedure.

Preserve debugger output under the current test item's evidence directory. Do
not include credentials, tokens, unrelated source content, or output from
other VS Code instances.

## Cleanup

Resume a paused target before disconnecting:

```powershell
npx --no-install dbgjs target resume
npx --no-install dbgjs connection disconnect --connection vscode-extension-host
npx --no-install dbgjs connection delete --connection vscode-extension-host
```

If the target is no longer paused, continue with disconnect and delete. Close
only debugger or TUI sessions created for the current test.

