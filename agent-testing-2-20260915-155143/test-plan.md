# Test Plan: Chat customization agent lifecycle

## Source

- Issue: https://github.com/aeschli/agent-testing/issues/2
- Test ID: `agent-testing-2-20260915-155143`
- Requested channel: `insiders`
- Exact Insiders version: `<record after launch>`
- Exact Insiders commit: `<record after launch>`

## Extracted TPI requirements

1. Open an isolated test folder and clone
   `https://github.com/aeschli/vscode-customization-migration-test.git` into it.
2. Confirm that `README.md` exists at the opened workspace root.
3. Open Chat, select the Copilot harness, open **Open Customizations**, and
   select **Agents**.
4. Confirm the two workspace agents `agent-one` and `agent-two`.
5. Open `agent-two` in an editor, change its name to `agent-two-new`, and
   confirm the new name in both Customizations and the Chat agent dropdown.
6. Create a workspace agent and confirm it in both UI surfaces.
7. Delete a workspace agent and confirm it is absent from both UI surfaces.

## Feature summary and research

Custom agents are Markdown files with a `.agent.md` extension. Workspace agents
use `.github/agents`, and the YAML frontmatter `name` is their displayed name.
The Agent Customizations editor is scoped to the harness selected in Chat and
supports creating and managing workspace customizations. VS Code's delete
action requires confirmation, deletes the backing file, and explicitly
refreshes the active Customizations list.

Primary sources:

- TPI issue: https://github.com/aeschli/agent-testing/issues/2
- Fixture repository and its `README.md`:
  https://github.com/aeschli/vscode-customization-migration-test
- Fixture agents:
  https://github.com/aeschli/vscode-customization-migration-test/tree/main/.github/agents
- Custom agents documentation:
  https://code.visualstudio.com/docs/agent-customization/custom-agents
- Agent Customizations editor documentation:
  https://code.visualstudio.com/docs/agent-customization/overview
- VS Code customization management contribution:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagement.contribution.ts
- VS Code customization list widget:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationListWidget.ts

Documented behavior: workspace location, frontmatter naming, harness scoping,
manual creation, deletion confirmation, and immediate list refresh.
Exploratory hypotheses: all relevant UI surfaces react to file changes without
stale or duplicate entries, and the resulting state remains correct after a
window reload.

## Coverage matrix

| Explicit requirement | Planned test |
| --- | --- |
| Isolated folder, clone fixture, root `README.md` | `workspace-agent-lifecycle` |
| Open Chat and select Copilot harness | `workspace-agent-lifecycle` |
| Open Customizations and Agents | `workspace-agent-lifecycle` |
| Two initial workspace agents | `workspace-agent-lifecycle` |
| Open and rename `agent-two` | `workspace-agent-lifecycle` |
| Renamed agent in Customizations and Chat dropdown | `workspace-agent-lifecycle`, `reload-and-focus-regression` |
| Create workspace agent and verify both surfaces | `workspace-agent-lifecycle`, `reload-and-focus-regression` |
| Delete workspace agent and verify both surfaces | `workspace-agent-lifecycle`, `reload-and-focus-regression` |

## Shared prerequisites and setup

- Latest VS Code Insiders resolved by `@vscode/test-electron`; do not fall back
  to Stable or an installed build.
- Authenticated cloned profile with access to the Copilot harness.
- Git and network access to clone the public fixture repository.
- Trust the workspace and dismiss first-run onboarding before evidence capture.
- Keep all fixtures and evidence under the individual test root.
- No test-specific extension is required.
- Use the fixture's committed settings; do not alter migration settings unless
  a planned action requires it.

## Test 1: Workspace agent lifecycle

- Origin: **TPI**
- Priority: **P0**
- Test item name: `workspace-agent-lifecycle`
- Test root dir:
  `agent-testing-2-20260915-155143/workspace-agent-lifecycle/`

### Actions and expected results

1. Launch the isolated Insiders instance for this test root and record the
   exact version and commit.
   - Expected: the latest Insiders build opens with valid workbench and
     extension-host debugger endpoints.
2. In the test root's `workspace` directory, clone
   `https://github.com/aeschli/vscode-customization-migration-test.git` so that
   the repository contents are the opened workspace root. Reopen the cloned
   root if necessary.
   - Expected: Explorer shows the fixture repository root and `README.md`.
3. Trust the workspace if prompted, open `README.md`, and confirm it renders.
   - Expected: the repository README opens from the workspace root.
4. Open Chat and select the Copilot harness requested by the TPI.
   - Expected: Chat visibly indicates the Copilot harness and remains usable.
5. Invoke **Open Customizations**, then select **Agents**.
   - Expected: the harness-scoped Customizations editor shows an Agents
     section.
6. Inspect the **Workspace** group.
   - Expected: exactly the fixture workspace agents `agent-one` and
     `agent-two` are present; neither is duplicated.
7. Select `agent-two`.
   - Expected: `.github/agents/agent-two.agent.md` opens in an editor with its
     editable frontmatter and body intact.
8. Change only the frontmatter name from `agent-two` to `agent-two-new`, save,
   and return to the Agents list.
   - Expected: the file saves without validation errors and the Workspace
     entry changes to `agent-two-new`; stale `agent-two` is absent.
9. Open the Chat agent dropdown.
   - Expected: `agent-two-new` is available and `agent-two` is absent.
10. From the Customizations editor, create a **Workspace** custom agent named
    `agent-three`; if a template opens, retain valid generated frontmatter and
    save it.
    - Expected: a new agent file is created under `.github/agents`, and
      `agent-three` appears once in the Workspace group.
11. Open the Chat agent dropdown.
    - Expected: `agent-three` appears once and can be selected.
12. Delete `agent-one` from the Customizations editor and accept the explicit
    deletion confirmation.
    - Expected: the backing workspace agent file is deleted and `agent-one`
      disappears immediately from the Workspace group.
13. Open the Chat agent dropdown again.
    - Expected: `agent-one` is absent; `agent-two-new` and `agent-three` remain.
14. Inspect the Explorer and browser console.
    - Expected: the file state matches the UI state and there are no errors
      attributable to rename, creation, list refresh, or deletion.

### Evidence

- Screenshots of the root `README.md`, initial Workspace agent list, renamed
  list, renamed Chat dropdown, created agent in both surfaces, deletion
  confirmation, and final state in both surfaces.
- `test-script.js` with the Playwright observation/execution sequence.
- Relevant browser console messages, including a recorded statement when no
  relevant errors are present.
- Relevant workbench or extension-host log excerpts only if warnings/errors
  occur, preserving each original log path.

### Cleanup

- Close the isolated Insiders window and inspector sessions.
- Do not restore deleted/renamed fixture files; retain final state as evidence.

## Test 2: Reload and focus regression

- Origin: **Exploratory**
- Priority: **P1**
- Test item name: `reload-and-focus-regression`
- Test root dir:
  `agent-testing-2-20260915-155143/reload-and-focus-regression/`
- Charter: investigate whether agent lifecycle changes remain synchronized
  across the Customizations editor and Chat dropdown after reload, and whether
  the main workflow is keyboard/focus operable.
- Hypothesis: saved workspace agent changes are rediscovered after reload
  without stale or duplicate dropdown entries, while controls expose usable
  accessible names and visible focus.
- Bound: one rename, one creation, one deletion, one window reload, and a
  maximum of about five minutes after setup. Stop after final post-reload
  verification or on the first blocking focus/accessibility defect.

### Actions and expected observations

1. Independently launch Insiders and clone/open a fresh copy of the fixture as
   in Test 1; record version and commit.
   - Expected: two initial workspace agents are discovered.
2. Use keyboard navigation where supported to open Chat, choose the Copilot
   harness, open Customizations, select Agents, and open `agent-two`.
   - Investigate: controls should have meaningful accessible labels, visible
     focus, and a logical focus order.
3. Rename `agent-two` to `agent-two-new`, create workspace agent
   `agent-three`, and delete `agent-one`, verifying both UI surfaces after each
   transition.
   - Expected from documented lifecycle behavior: the saved file state and
     both UI surfaces agree before reload.
4. Run **Developer: Reload Window**, wait for agent discovery to settle, reopen
   Chat and the harness-scoped Agents list.
   - Investigate: `agent-two-new` and `agent-three` should each appear once in
     both surfaces; `agent-two` and `agent-one` should remain absent.
5. Select each surviving agent from the Chat dropdown and reopen it from
   Customizations.
   - Investigate: selection resolves to the correct backing file and no stale
     entry, broken editor, or relevant console error appears.

### Evidence

- Playwright accessibility snapshots or DOM observations for relevant controls.
- Screenshots of visible keyboard focus and final post-reload state in both
  surfaces.
- `test-script.js`, relevant console messages, and relevant VS Code logs with
  original paths if failures occur.

### Cleanup

- Close the isolated Insiders window and inspector sessions.
- Preserve the modified isolated workspace and evidence.

## Known risks and handling

- The issue says "Copilot harness"; UI wording can evolve in Insiders. Record
  the exact visible harness label and do not substitute the Local harness.
- Agent discovery and file watching may be asynchronous. Wait for an observable
  settled state, but treat persistent stale entries as a failure rather than
  silently extending the plan.
- Authentication expiry is a blocker. Refresh only the source profile session;
  do not sign in directly in the isolated profile.
- Network or Insiders version-resolution failures block the affected test; do
  not use cached Stable as a fallback.
- Creation prompts may vary. Use the documented Workspace scope and name
  `agent-three`, recording any UI deviation.
- Do not submit chat prompts: this plan verifies customization discovery and
  lifecycle UI, not model response quality.

