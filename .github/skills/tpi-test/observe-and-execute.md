# Observe and execute VS Code with Playwright

Use these instructions only after the test plan is approved and
`start-vscode` has launched the isolated VS Code Insiders instance. Use the
renderer endpoint printed by the launcher.

## Interactive Observation

Use the bundled observer only when a human will work with Playwright Inspector:

```powershell
$env:PWDEBUG = '1'
$env:VSCODE_CDP_ENDPOINT = '<renderer endpoint printed by start-vscode>'
node .github/skills/tpi-test/observe-vscode.js
```

The observer connects over CDP, prints the discovered pages, selects the
workbench, and pauses in Playwright Inspector. It is not an unattended test
runner.

## Unattended Execution

For agent-driven execution, create a test-specific Playwright script under
`<TPI_ID>/tests/<test-item-name>/` and connect with
`chromium.connectOverCDP` using the renderer endpoint printed by
`start-vscode`.

Do not call `page.pause()` or `workbench.pause()` in an unattended script. Use
accessibility roles, labels, and stable `data-*` attributes instead of deeply
nested CSS selectors.

Execute test items in the approved order. Create required fixtures only under
`<TPI_ID>/workspace` unless the approved plan specifies otherwise. Do not
silently change the plan while testing; record deviations and ask for approval
when they materially alter scope or expected behavior.

## Capture Evidence

Capture the evidence required by the approved plan, including:

- relevant workbench text and screenshots;
- browser console messages;
- page errors and failed requests;
- relevant VS Code logs from `<TPI_ID>/user-data-dir/logs`.

Identify the directory for the current VS Code session and preserve only
relevant log files or excerpts, such as window, renderer, extension-host,
shared-process, and extension-specific logs. Keep their relative source paths
so the producing process is clear.

Do not include unrelated log content, credentials, tokens, or other sensitive
values in test artifacts.

