# Test Result: Custom agent inventory consistency

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Test variation: `custom-agent-inventory-consistency`
- Origin: **Exploratory**
- Status: **Passed**
- Charter: investigate whether the Copilot agent sees the same custom-agent
  inventory.
- VS Code channel: Insiders
- VS Code version: `1.139.0-insider`
- VS Code commit: `c74ba73b780a4a33173c006e52560d61432f53d6`
- VS Code build date: `2026-09-16T04:43:54Z`
- Fixture commit: `a418412d3bdf8aba1cc5ffb016624875528ec9db`
- Platform: Windows
- Automation started: `2026-09-16T16:01:03.060Z`
- Final response evidence captured: `2026-09-16T16:02:09.351Z`
- Measured automation and follow-up observation: `66.291 s`
- Total orchestration: `1242.143 s` (`20m 42.143s`)

## Research basis and hypothesis

The approved plan cites the custom-agent documentation, Agent Customizations
documentation, fixture repository, and the related VS Code routing change.
Workspace custom agents are expected under `.github/agents`, with YAML
frontmatter `name` values providing their displayed identities.

The hypothesis was that, after one rename, one creation, one deletion, and one
window reload, Customizations, the Chat dropdown, backing files, and the
Copilot agent response would agree without stale or duplicate active entries.

## Environment and prerequisites

- Launched the latest resolved Insiders build with:
  `npm run start-vscode -- --root-dir C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260916-172633\custom-agent-inventory-consistency`
- Renderer endpoint: `http://127.0.0.1:50417`
- Extension-host endpoint: `http://127.0.0.1:50418`
- Used the isolated authenticated profile, user-data directory, extensions
  directory, workspace, and log directories under this variation root.
- Cloned the fixture only into `workspace/`.
- Verified root `README.md`.
- Verified initial backing files:
  `agent-one.agent.md -> agent-one` and
  `agent-two.agent.md -> agent-two`.
- Selected the visible `Copilot` harness.

## Steps performed and observations

1. Opened Agents in Customizations and checked the initial inventory.
   - Customizations Workspace: `agent-one`, `agent-two`.
   - Chat dropdown: `agent-one`, `agent-two`.
   - Both appeared exactly once.
2. Opened `agent-two`, changed its frontmatter name to `agent-two-new`, and
   saved it.
   - Backing file: `agent-two.agent.md -> agent-two-new`.
   - Customizations and Chat dropdown both changed to
     `agent-one`, `agent-two-new`.
   - Stale `agent-two` was absent.
3. Created Workspace agent `agent-three` through the Customizations UI.
   - Backing file: `agent-three.agent.md -> agent-three`.
   - Both UI surfaces showed `agent-one`, `agent-two-new`, `agent-three`.
4. Deleted `agent-one` through its Customizations action menu.
   - `agent-one.agent.md` was deleted.
   - Both UI surfaces showed only `agent-two-new`, `agent-three`.
   - `agent-one` and stale `agent-two` were absent.
5. Ran **Developer: Reload Window**, reacquired the workbench page, and
   repeated both inventory checks.
   - Customizations Workspace: `agent-two-new`, `agent-three`.
   - Chat dropdown: `agent-two-new`, `agent-three`.
   - Each appeared exactly once; deleted and stale names remained absent.
6. Selected `agent-two-new` and `agent-three` from Chat, then reopened each
   from Customizations.
   - `agent-two-new` resolved to `agent-two.agent.md`.
   - `agent-three` resolved to `agent-three.agent.md`.
   - Neither entry was stale or broken.
7. Selected the built-in `Agent` under the Copilot harness and submitted the
   exact prompt `What agents can you use` once.
   - Copilot reported both active workspace agents:
     `agent-three` and `agent-two-new`.
   - Copilot omitted deleted `agent-one` and stale `agent-two`.
   - Copilot additionally listed its built-in specialized agents:
     `explore`, `task`, `general-purpose`, `rubber-duck`, `code-review`,
     `research`, and `security-review`.

## Expected result

After the planned lifecycle changes and reload, the active workspace custom
agents should be `agent-two-new` and `agent-three`. Both should appear exactly
once in Customizations and the Chat dropdown, resolve to their backing files,
and be reported by Copilot. Deleted `agent-one` and stale `agent-two` should be
absent. Additional non-workspace agents are acceptable when distinguishable.

## Actual result and comparison

**Passed.** The active custom-agent inventory was consistent:

| Source | Active workspace custom agents |
| --- | --- |
| Customizations Workspace | `agent-two-new`, `agent-three` |
| Chat custom-agent dropdown | `agent-two-new`, `agent-three` |
| `.github/agents` backing files | `agent-two-new`, `agent-three` |
| Copilot response | `agent-two-new`, `agent-three` |

The fixture also contains legacy `.custom/agents/planner.agent.md` declaring
`Planner`. The UI displayed a migration notice explaining that workspace
customizations are present but not used by Copilot. `Planner` was not in
either active inventory and Copilot did not claim it as an available agent,
so this omission was consistent with the UI state rather than a mismatch.

The complete response transcript and comparison are in
[response-transcript.txt](./response-transcript.txt).

## Evidence

- Final post-reload Customizations:
  [05-post-reload-customizations.png](./screenshots/05-post-reload-customizations.png)
- Final post-reload Chat dropdown:
  [05-post-reload-chat-dropdown.png](./screenshots/05-post-reload-chat-dropdown.png)
- Resolved `agent-two-new` editor:
  [06-resolved-agent-two-new.png](./screenshots/06-resolved-agent-two-new.png)
- Resolved `agent-three` editor:
  [06-resolved-agent-three.png](./screenshots/06-resolved-agent-three.png)
- Settled Copilot response:
  [07-copilot-agent-inventory-response.png](./screenshots/07-copilot-agent-inventory-response.png)
- Structured observations:
  [observations.json](./observations.json)
- Browser console evidence:
  [console.json](./console.json)
- Timing:
  [timing.json](./timing.json)
- Persisted automation:
  [test-script.mts](./test-script.mts)
- Prompt log excerpt:
  [agenthost.log.excerpt](./vscode-logs/20260916T174143/agenthost.log.excerpt)
- Renderer log excerpt:
  [renderer.log.excerpt](./vscode-logs/20260916T174143/window1/renderer.log.excerpt)

Additional screenshots with failure-oriented names are preserved diagnostic
artifacts from selector-development attempts, not product test failures. The
evidence listed above is from the complete successful measured pass.

## Console and log review

- No relevant page error or failed network request prevented the lifecycle or
  response comparison.
- The renderer logged `Aborted onWillSaveTextDocument-event after 1750ms`
  while saving the rename. The file nevertheless contained the correct name,
  and both UI inventories updated correctly before and after reload.
- The renderer logged `No harness descriptor found for session type
  agent-host-copilotcli`; the Copilot harness still completed the prompt.
- An extension-host `url.parse()` deprecation warning was unrelated to the
  tested inventory behavior.
- Browser-console 404 responses were for unrelated fixture MCP registry
  entries and did not affect agent discovery.
- The Agent Host log confirms exactly one submission of
  `What agents can you use`.

Original relevant log paths:

- `C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260916-172633\custom-agent-inventory-consistency\user-data-dir\logs\20260916T174143\agenthost.log`
- `C:\Users\martinae\workspaces\agent-testing\agent-testing-2-20260916-172633\custom-agent-inventory-consistency\user-data-dir\logs\20260916T174143\window1\renderer.log`

## Deviations from the approved plan

- The virtualized built-in `Agent` row repeatedly detached during pointer
  activation and keyboard focus left its menu overlay open. The final measured
  pass dispatched one DOM click to that already-observed row, then used
  keyboard focus to enter the exact prompt. This did not change the fixture or
  inventory.
- The automation initially treated the transient response placeholder
  `Working` as complete. No second prompt was sent. The existing chat turn was
  observed until its settled response appeared, and the transcript,
  screenshot, observations, timing, and persisted completion condition were
  corrected.

## Issues to report

None for the exploratory charter. The tested active inventories were
consistent.

