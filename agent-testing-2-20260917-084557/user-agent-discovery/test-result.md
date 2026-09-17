# Test Result: Copilot User-Agent Discovery

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Variation: `user-agent-discovery`
- Origin: TPI
- Status: **Passed**
- Channel: Insiders
- Version: `1.139.0-insider`
- Commit: `046944034292b5479b4e9a50ad1a508033ffb64f`
- Build date: `2026-09-17T03:41:14Z`
- Renderer endpoint: `http://127.0.0.1:58633`
- Initial extension-host endpoint: `http://127.0.0.1:58634`

## Environment and prerequisites

- Windows, isolated user data, extensions, shared data, and workspace under this variation root.
- Dependencies prepared with `npm install`.
- The launcher reused the current cached latest Insiders build after validating the `insiders` channel.
- Copilot authentication was confirmed by the visible Copilot status control and available `GPT-5.6 Sol` model.
- Before every measured fixture creation, exact-path checks confirmed
  `C:\Users\martinae\.copilot\agents\user-agent.agent.md` did not exist.
- The fixture was created with exclusive `wx` semantics, so an existing file
  could not be overwritten.

## Commands

Dependency setup:

```powershell
npm install
```

No-overwrite prerequisite:

```powershell
$target = Join-Path $HOME '.copilot\agents\user-agent.agent.md'; Write-Output "TARGET=$target"; Write-Output "EXISTS=$(Test-Path -LiteralPath $target)"
```

Prescribed launch command:

```powershell
npm run start-vscode -- --root-dir "C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\user-agent-discovery"
```

Authoritative measured run:

```powershell
$env:ORCHESTRATION_STARTED_AT = '2026-09-17T07:21:39.2981550Z'
$env:TEST_ROOT_DIR = (Resolve-Path 'C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\user-agent-discovery').Path
$env:VSCODE_CDP_ENDPOINT = 'http://127.0.0.1:58633'
node 'C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\user-agent-discovery\test-script.mts'
```

Teardown verification:

```powershell
$target = Join-Path $HOME '.copilot\agents\user-agent.agent.md'
Test-Path -LiteralPath $target
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*user-agent-discovery*' -or $_.CommandLine -like '*remote-debugging-port=58633*' -or $_.CommandLine -like '*inspect-extensions=58634*' }
```

## Steps performed and actual results

1. Launched the isolated latest Insiders instance with the prescribed
   `start-vscode` command.
   - The launcher validated both debugger endpoints.
   - Exact build metadata was read from the launched build.
2. Verified the exact user-agent file did not exist, then created only that
   file with valid `name: user-agent` frontmatter and a minimal body.
3. Reloaded the workbench and waited for authenticated Copilot controls.
4. Opened **Agent Customizations > Agents**.
   - The **User** inventory contained exactly one `user-agent`.
   - The **Workspace** inventory contained no `user-agent`.
   - The UI's **User** group is the current label for the planned
     personal/global source.
5. Opened `user-agent` from Customizations.
   - The focused customization editor exposed
     `file:///c%3A/Users/martinae/.copilot/agents/user-agent.agent.md`.
   - Converting that URI to a filesystem path matched the intended file
     exactly, case-insensitively on Windows.
6. Opened the Chat agent picker.
   - Its complete visible inventory was `Agent`, `user-agent`, and
     `Configure Custom Agents...`.
   - `user-agent` appeared exactly once.
   - Selecting it changed the Chat agent control to `user-agent`.
7. Deleted only the uniquely created test file and closed the isolated
   Insiders window.
   - Final exact-file check: absent.
   - Final isolated-process check: no matching VS Code process remained.

## Expected result

The documented Copilot user agent is discovered from the user-level agents
folder, appears exactly once in both Copilot UI surfaces, is selectable in
Chat, and opens the intended backing file.

## Actual result

The expected result was fully observed. The variation passed.

## Evidence

- [User group and empty Workspace group](screenshots/01-user-agent-customizations.png)
- [Backing customization file](screenshots/02-user-agent-backing-file.png)
- [Chat agent dropdown](screenshots/03-user-agent-chat-dropdown.png)
- [Selected user-agent](screenshots/04-user-agent-selected.png)
- [Structured Playwright observations](observations.json)
- [Browser console evidence](console.json)
- [Run timing](timing.json)
- [Renderer log](vscode-logs/20260917T092142/window1/renderer.log)
- [Extension-host log](vscode-logs/20260917T092142/window1/exthost/exthost.log)

Original VS Code log paths:

- `user-data-dir/logs/20260917T092142/window1/renderer.log`
- `user-data-dir/logs/20260917T092142/window1/exthost/exthost.log`

The measured automation took `9,466 ms`. Total orchestration time, including
launch, selector discovery, reset, and measured execution, was `583,230 ms`.

## Console and log observations

- No console or log error indicated a failure to discover, open, or select the
  user agent.
- Reload produced cancellation warnings while transient services restarted:
  `[chat-stt] could not refresh GitHub session state for cloud dictation
  Canceled` and `[DefaultAccount] Attempt 1 to get sessions failed: Canceled`.
- After reload, the extension host reported that the originally prescribed
  port `58634` was occupied and selected `60682`. This did not affect renderer
  observation or the tested feature.
- A pre-existing Node `DEP0169` warning for `url.parse()` appeared in the
  extension host. It was unrelated to agent discovery.

## Deviations and execution notes

- The approved file-creation setup was performed directly by the persisted
  Playwright test script using an exclusive filesystem create. All product
  observation and interaction used the VS Code workbench over Playwright.
- Playwright's normal full-page screenshot operation dismissed the Chat
  context view. The final persisted script therefore captured that one view
  through the same renderer CDP session with `Page.captureScreenshot`, then
  selected the agent through the accessible `menuitemcheckbox`.
- Two pre-measurement selector corrections were followed by deletion of the
  unique fixture and a workbench reload. The recorded timing and observations
  are from the final clean, passing run.
- The launcher supplied `--disable-workspace-trust`; therefore no trust prompt
  appeared.

## Issues to report

None.
