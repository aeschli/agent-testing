# Test Result: Workspace Agent Lifecycle

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Variation: `workspace-agent-lifecycle`
- Origin: TPI
- Status: **Passed**
- Tested channel: Insiders
- VS Code version: `1.139.0-insider`
- VS Code commit: `046944034292b5479b4e9a50ad1a508033ffb64f`
- Architecture: `x64`
- Copilot Chat version: `0.67.2026091702`
- Renderer endpoint: `http://127.0.0.1:60159`
- Extension-host endpoint: `http://127.0.0.1:60160`

## Environment and prerequisites

- Windows host.
- Isolated test root: `workspace-agent-lifecycle/`.
- Repository fixture cloned from
  `https://github.com/aeschli/vscode-customization-migration-test.git`
  into `workspace/`.
- Isolated `user-data-dir/` and `extensions-dir/` created by the prescribed
  launcher.
- Copilot authentication was confirmed in the extension log before testing.
- The workspace was trusted and no onboarding prompt blocked the run.

## Commands

```powershell
npm install
npm run start-vscode -- --root-dir C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\workspace-agent-lifecycle
git clone https://github.com/aeschli/vscode-customization-migration-test.git C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\workspace-agent-lifecycle\workspace
$env:ORCHESTRATION_STARTED_AT='2026-09-17T06:50:36.676Z'
$env:TEST_ROOT_DIR='C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\workspace-agent-lifecycle'
$env:VSCODE_CDP_ENDPOINT='http://127.0.0.1:60159'
node C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260917-084557\workspace-agent-lifecycle\test-script.mts
```

The launcher downloaded and started the latest available Insiders build. No
Stable build or preinstalled application was used.

## Expected result

The root README exists; Copilot-scoped Customizations discovers the two
fixture agents; rename, create, and delete update backing files,
Customizations, and the Chat dropdown without stale or duplicate entries.

## Steps and actual behavior

1. Opened the root `README.md` from Explorer and verified the visible heading
   `# VS Code Customization Migration Test`.
   - Result: Passed.
   - Evidence: [README open](screenshots/01-readme-open.png)
2. Opened Chat and explicitly changed the harness from Local to Copilot.
   `Chat with Copilot` and the `Copilot` selector were visible.
   - Result: Passed.
   - Evidence: [Copilot selected](screenshots/02-chat-copilot-selected.png)
3. Opened `Chat: Open Customizations`, verified the title identified
   `Copilot · workspace`, selected Agents, and asserted an exact Workspace
   inventory of `agent-one` and `agent-two`.
   - Result: Passed.
   - Evidence:
     [Initial Workspace agents](screenshots/03-customizations-initial-agents.png)
4. Opened `agent-two`, changed only `name: agent-two` to
   `name: agent-two-new`, and saved. The backing file retained its original
   contents apart from that frontmatter value. Customizations and the Chat
   agent picker both replaced the old name without a stale or duplicate entry.
   - Result: Passed.
   - Evidence:
     [Customizations after rename](screenshots/04-customizations-after-rename.png),
     [Chat after rename](screenshots/05-chat-after-rename.png)
5. Created a Workspace agent in `.github\agents` named `agent-three`, retained
   the generated valid frontmatter, and saved. The backing file existed with a
   valid `---` frontmatter block and `name: agent-three`. It appeared exactly
   once in Customizations and Chat.
   - Result: Passed.
   - Evidence:
     [Customizations after create](screenshots/06-customizations-after-create.png),
     [Chat after create](screenshots/07-chat-after-create.png)
6. Selected `agent-one.agent.md` in Explorer, invoked Delete through the
   workbench, and accepted the native `Move to Recycle Bin` confirmation. The
   backing file disappeared. Customizations and Chat then contained exactly
   `agent-two-new` and `agent-three`.
   - Result: Passed.
   - Evidence:
     [Customizations after delete](screenshots/08-customizations-after-delete.png),
     [Chat after delete](screenshots/09-chat-after-delete.png)

Final filesystem state:

```text
.github/agents/agent-two.agent.md    name: agent-two-new
.github/agents/agent-three.agent.md  name: agent-three
.github/agents/agent-one.agent.md    absent
```

## Console and log evidence

- Playwright browser console/page-error/request-failure capture:
  [console.json](console.json) — empty (`[]`), so no browser warnings, errors,
  page errors, or failed requests were recorded during the successful
  measured run.
- Original renderer log:
  `user-data-dir/logs/20260917T085204/window1/renderer.log`.
- Relevant renderer excerpt:
  [renderer-errors.log](vscode-logs/20260917T085204/window1/renderer-errors.log).
  It contains unrelated extension deprecation and remote embeddings-cache 404
  messages; none correlated with agent discovery or lifecycle transitions.
- Original Copilot log:
  `user-data-dir/logs/20260917T085204/window1/exthost/GitHub.copilot-chat/GitHub Copilot Chat.log`.
- Authentication/version excerpt:
  [copilot-auth.log](vscode-logs/20260917T085204/window1/copilot-auth.log).
- Structured observations:
  [observations.json](observations.json).
- Timing:
  [timing.json](timing.json).

## Timing

- Automation start: `2026-09-17T07:13:19.783Z`
- Automation end: `2026-09-17T07:14:51.494Z`
- Automation duration: `91,711 ms` (1m 31.711s)
- Orchestration start: `2026-09-17T06:50:36.676Z`
- Total orchestration duration: `1,454,818 ms` (24m 14.818s)

The total includes selector discovery, fixture resets, two early stopped runs
that made no unrecorded final-state assertions, and the final successful
measured run.

## Important decisions and deviations

- Used accessible roles/names and stable workbench classes for all Playwright
  observations and edits.
- Replaced the complete Monaco editor buffer during rename with the original
  file content plus the single requested frontmatter-name change. The saved
  diff confirmed that this was the only content change.
- The Customizations row action menu was not reliable through an unfocused
  CDP-controlled Electron window. For the measured delete, Playwright selected
  the backing file in the VS Code Explorer and sent Delete; the isolated
  Insiders window was foregrounded and the native `Move to Recycle Bin`
  confirmation was accepted. Assertions returned to Customizations and Chat.
  This changed the interaction path, not the requested behavior or scope.
- The launcher's download progress printed an intermediate download identifier
  (`07b4ff1883f94da91f6d698744fc7c3638b59720`). The authoritative tested commit
  above comes from `code-insiders.cmd --version` and the workbench application
  path.

## Blockers and issues

- No product blocker.
- No issue to report under `reported-issues/`.
- Initial automation attempts exposed selector strictness and command-palette
  focus issues. Each attempt stopped before the remaining state transitions,
  the fixture was reset exactly to Git HEAD, and the final measured run began
  from a clean fixture.
