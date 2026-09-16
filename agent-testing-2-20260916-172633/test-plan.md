# Test Plan: Chat customization agent lifecycle

## Source and run identity

- Issue: https://github.com/aeschli/agent-testing/issues/2
- Test ID: `agent-testing-2-20260916-172633`
- Requested channel: `insiders`
- Exact Insiders version: `<record after launch>`
- Exact Insiders commit: `<record after launch>`

## Extracted TPI requirements

1. Open an isolated test folder and clone
   `https://github.com/aeschli/vscode-customization-migration-test.git` into it.
2. Verify that `README.md` exists at the opened workspace root.
3. Open Chat, select the Copilot harness, open **Open Customizations**, and
   select **Agents**.
4. Verify the two Workspace agents `agent-one` and `agent-two`.
5. Open `agent-two`, rename it to `agent-two-new`, and verify the new name in
   both Customizations and the Chat agent dropdown.
6. Create a Workspace agent and verify it in both UI surfaces.
7. Delete a Workspace agent and verify it is absent from both UI surfaces.

## Feature summary and research

Custom agents are Markdown files with a `.agent.md` extension. Workspace agents
are stored in `.github/agents`, and their YAML frontmatter `name` is their
displayed identity. The `user-invocable` property defaults to `true`, so these
fixture agents should appear in the Chat agent dropdown. The Agent
Customizations editor is the documented surface for discovering, creating, and
managing custom agents. The related VS Code routing change opens Chat
Customizations on the Agents tab rather than exposing agents unavailable to the
selected Copilot harness.

Primary sources:

- TPI issue: https://github.com/aeschli/agent-testing/issues/2
- Fixture repository:
  https://github.com/aeschli/vscode-customization-migration-test
- Fixture commit adding agents:
  https://github.com/aeschli/vscode-customization-migration-test/commit/a418412d3bdf8aba1cc5ffb016624875528ec9db
- Fixture agents:
  https://github.com/aeschli/vscode-customization-migration-test/tree/main/.github/agents
- Custom agents documentation:
  https://code.visualstudio.com/docs/agent-customization/custom-agents
- Agent Customizations editor documentation:
  https://code.visualstudio.com/docs/agent-customization/overview
- Related VS Code routing change:
  https://github.com/microsoft/vscode/pull/332334

Documented behavior covers the workspace location, frontmatter naming,
user-invocable dropdown visibility, and management through the Customizations
editor. Exploratory hypotheses are that file-watcher updates reach both UI
surfaces and the Copilot agent without stale or duplicate inventory entries
after reload.

## Coverage matrix

| Explicit TPI requirement | Planned test |
| --- | --- |
| Isolated folder, cloned fixture, root `README.md` | `workspace-agent-lifecycle` |
| Open Chat and select Copilot harness | `workspace-agent-lifecycle` |
| Open Customizations and Agents | `workspace-agent-lifecycle` |
| Initial `agent-one` and `agent-two` Workspace entries | `workspace-agent-lifecycle` |
| Open and rename `agent-two` | `workspace-agent-lifecycle` |
| Renamed agent in Customizations and Chat dropdown | `workspace-agent-lifecycle`, `custom-agent-inventory-consistency` |
| Create a Workspace agent and verify both surfaces | `workspace-agent-lifecycle`, `custom-agent-inventory-consistency` |
| Delete a Workspace agent and verify both surfaces | `workspace-agent-lifecycle`, `custom-agent-inventory-consistency` |

## Shared prerequisites and setup

- Dependencies were installed with `npm install` before plan approval.
- Resolve the latest VS Code Insiders through `@vscode/test-electron`; do not
  fall back to Stable or an installed build.
- Use an authenticated cloned profile with access to the Copilot harness.
- Require Git and network access to clone the public fixture repository.
- Trust the workspace and dismiss first-run onboarding before evidence capture.
- Create fixtures only under each variation's isolated `workspace` directory.
- No test-specific extension is required.
- Use the fixture's committed settings and agent files as the baseline.
- Record the fixture HEAD commit used by each variation.

## Test 1: Workspace agent lifecycle

- Origin: **TPI**
- Priority: **P0**
- Test variation name: `workspace-agent-lifecycle`
- Test root dir:
  `agent-testing-2-20260916-172633/workspace-agent-lifecycle/`

### Actions and expected results

1. Launch the isolated Insiders instance for this test root and record its
   exact version and commit.
   - Expected: the latest Insiders build opens and both workbench and extension
     host debugger endpoints validate.
2. Clone `https://github.com/aeschli/vscode-customization-migration-test.git`
   into the variation's `workspace` directory so the cloned repository root is
   the opened workspace.
   - Expected: the workspace is isolated and the fixture clone completes.
3. Trust the workspace if prompted, verify root `README.md` exists, and open it.
   - Expected: Explorer and the editor show the fixture's root `README.md`.
4. Open Chat and select the Copilot harness requested by the TPI.
   - Expected: Chat visibly indicates the Copilot harness and remains usable.
5. Invoke **Open Customizations** and select **Agents**.
   - Expected: the harness-scoped Customizations editor shows the Agents page.
6. Inspect the **Workspace** group.
   - Expected: exactly `agent-one` and `agent-two` are present, once each.
7. Select `agent-two`.
   - Expected: `.github/agents/agent-two.agent.md` opens in an editor with
     editable frontmatter and its existing content intact.
8. Change only the frontmatter name from `agent-two` to `agent-two-new`, save,
   and return to Agents.
   - Expected: the file saves without validation errors; `agent-two-new`
     replaces `agent-two` in the Workspace group with no stale duplicate.
9. Open the Chat agent dropdown.
   - Expected: `agent-two-new` appears once and `agent-two` is absent.
10. From Customizations, create a **Workspace** custom agent named
    `agent-three`; retain valid generated content and save if an editor opens.
    - Expected: a valid file is created under `.github/agents`, and
      `agent-three` appears once in the Workspace group.
11. Open the Chat agent dropdown and select `agent-three`.
    - Expected: `agent-three` appears once and is selectable.
12. Delete `agent-one` from Customizations and accept any explicit deletion
    confirmation.
    - Expected: the backing file is deleted and `agent-one` disappears from
      the Workspace group without affecting the surviving agents.
13. Reopen the Chat agent dropdown.
    - Expected: `agent-one` is absent; `agent-two-new` and `agent-three` remain
      present once each.
14. Inspect Explorer, visible validation state, browser console messages, and
    relevant logs if errors occurred.
    - Expected: backing files and both UI surfaces agree, with no errors
      attributable to discovery, rename, creation, refresh, or deletion.

### Evidence to capture

- Screenshots of root `README.md`, initial Workspace list, renamed entry in
  Customizations and Chat, created entry in both surfaces, deletion
  confirmation if shown, and final state in both surfaces.
- `test-script.mts` containing the Playwright observation/execution sequence.
- Browser console evidence, including an explicit record if no relevant errors
  are present.
- Relevant workbench or extension-host log excerpts if warnings/errors occur,
  preserving each original VS Code log path in `test-result.md`.

### Cleanup

- Close only the isolated Insiders window and inspector sessions created by
  this variation.
- Preserve the modified isolated workspace and evidence.

## Test 2: Custom agent inventory consistency

- Origin: **Exploratory**
- Priority: **P1**
- Test variation name: `custom-agent-inventory-consistency`
- Test root dir:
  `agent-testing-2-20260916-172633/custom-agent-inventory-consistency/`
- Charter: investigate whether the Copilot agent sees the same custom-agent
  inventory.
- Hypothesis: after saved workspace-agent changes and a window reload, the
  Copilot agent reports the same available workspace agents as the
  Customizations UI, Chat dropdown, and backing files, without stale or
  duplicate entries.
- Bound: one rename, one creation, one deletion, one window reload, and at most
  one Copilot prompt after reload, with at most five minutes of exploration
  after setup.
- Stopping condition: stop after recording and comparing the Copilot response
  with the post-reload inventory, or if Copilot cannot answer the prompt.

### Actions and expected observations

1. Independently launch Insiders, clone/open a fresh fixture copy, verify the
   root `README.md`, and record Insiders and fixture versions.
   - Expected: the isolated Workspace group initially contains `agent-one` and
     `agent-two`.
2. Open Chat, choose the Copilot harness, open Customizations, select Agents,
   and open `agent-two`.
   - Expected: the Workspace group and Chat dropdown expose the same two
     initial fixture agents.
3. Rename `agent-two` to `agent-two-new`, create Workspace agent `agent-three`,
   and delete `agent-one`, checking Customizations and the Chat dropdown after
   every transition.
   - Expected from the documented lifecycle: before reload, files and both UI
     surfaces agree without stale or duplicate entries.
4. Run **Developer: Reload Window**, wait for discovery to settle, then reopen
   Chat and the Copilot-harness Agents page.
   - Investigate: `agent-two-new` and `agent-three` appear once in both
     surfaces; `agent-two` and `agent-one` remain absent.
5. Select each surviving agent from Chat and reopen it from Customizations.
   - Investigate: each entry resolves to the correct backing file; no stale
     entry, broken editor, or relevant console error appears.
6. Select the Copilot agent and submit the exact prompt
   `What agents can you use`.
   - Investigate: compare the response's available-agent inventory with the
     post-reload Workspace group, Chat agent dropdown, and backing files. Note
     whether it reports `agent-two-new` and `agent-three`, omits deleted
     `agent-one` and stale `agent-two`, and includes any additional built-in or
     non-workspace agents with enough context to distinguish them.

### Evidence to capture

- Screenshots showing the final post-reload inventory in both UI surfaces.
- Screenshot and response transcript for `What agents can you use`, plus a
  recorded inventory comparison against the UI and backing files.
- `test-script.mts`, browser console evidence, and relevant VS Code log
  excerpts with original paths if warnings/errors occur.

### Cleanup

- Close only the isolated Insiders window and inspector sessions created by
  this variation.
- Preserve the modified isolated workspace and evidence.

## Known risks and handling

- The issue says "Copilot harness"; Insiders wording may evolve. Record the
  exact visible label and do not substitute the Local harness.
- Agent discovery and file watching are asynchronous. Wait for an observable
  settled state, but treat persistent stale entries as a failure.
- Authentication expiry blocks testing. Refresh only the source profile
  session; do not sign in directly in the isolated profile.
- Network or Insiders resolution failures block the affected variation; never
  substitute Stable.
- Creation prompts can evolve. Use Workspace scope and the fixed name
  `agent-three`, and record any UI deviation.
- Do not submit chat prompts in Test 1. Test 2 submits only the approved
  inventory prompt; general model response quality remains outside scope.
