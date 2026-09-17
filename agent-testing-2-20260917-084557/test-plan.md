# Test Plan: Chat customization agent lifecycle

## Source and run identity

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Test ID: `agent-testing-2-20260917-084557`
- Requested channel: `insiders`
- Exact Insiders version: `<record after launch>`
- Exact Insiders commit: `<record after launch>`
- Platform: Windows

## Extracted TPI requirements and variations

1. Open VS Code on an isolated test folder and clone
   `https://github.com/aeschli/vscode-customization-migration-test.git` into
   the opened test workspace.
2. Verify that `README.md` exists at the workspace root.
3. Open Chat and select the **Copilot** harness, not **Local**.
4. Open **Open Customizations** and verify that its visible title identifies
   the **Copilot** harness, not **Local**.
5. Select **Agents** and verify that the Workspace group contains
   `agent-one` and `agent-two`.
6. Open `agent-two`, rename its frontmatter name to `agent-two-new`, and verify
   the changed name in both the Customizations editor and Chat agent dropdown.
7. Create a workspace agent and verify it in both UI surfaces.
8. Delete a workspace agent and verify that it disappears from both UI
   surfaces.
9. Repeat discovery with a user-level Copilot agent. The issue's example path
   is interpreted using the documented supported location and suffix:
   `~/.copilot/agents/user-agent.agent.md`.
10. Create and install a plugin containing an agent, then verify that the
    plugin agent is exposed in the relevant Copilot customization surfaces.

## Feature summary and research

Custom agents are Markdown files whose display name comes from YAML
frontmatter and whose supported suffix is `.agent.md`. VS Code discovers
workspace Copilot agents from `.github/agents` and Copilot user agents from
`~/.copilot/agents`. The Agent Customizations editor is scoped to the harness
selected in Chat, so selecting Copilot before opening it is part of the
functional setup rather than only a label check.

The fixture currently contains `README.md` and exactly two Copilot workspace
agent files, `.github/agents/agent-one.agent.md` and
`.github/agents/agent-two.agent.md`, with matching `name` values.

Agent Plugins 1.0 packages Copilot-specific custom agents under
`com.github.copilot/agents`. VS Code's **Create Plugin** action can select
existing user/workspace agents, writes a standard `plugin.json`, and copies
selected agents into that directory. Installed plugin customizations are
read-only and are grouped as Plugins in the Customizations editor.

Documented expected behavior:

- the Customizations editor is scoped to the currently selected harness;
- workspace and user custom-agent locations and `.agent.md` format;
- creating a customization from the editor with a selected scope;
- Agent Plugins 1.0 packaging and plugin-provided customization discovery.

Exploratory hypotheses:

- file-backed rename, create, and delete events update both the
  Customizations editor and Chat dropdown without stale or duplicate entries;
- the synchronized inventory remains correct after a window reload;
- plugin installation does not duplicate the source workspace agent and
  clearly identifies the plugin-provided copy.

Primary sources:

- TPI issue:
  https://github.com/aeschli/agent-testing/issues/2
- Fixture repository:
  https://github.com/aeschli/vscode-customization-migration-test
- Fixture agents:
  https://github.com/aeschli/vscode-customization-migration-test/tree/main/.github/agents
- Custom agents documentation:
  https://code.visualstudio.com/docs/agent-customization/custom-agents
- Agent Customizations editor documentation:
  https://code.visualstudio.com/docs/agent-customization/overview
- Agent plugins documentation:
  https://code.visualstudio.com/docs/agent-customization/agent-plugins
- Customization provider mapping agents to their source/storage:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/browser/aiCustomization/promptsServiceCustomizationItemProvider.ts
- Source labels, including Copilot workspace and Copilot personal:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/common/promptSyntax/promptTypes.ts
- Create Plugin implementation:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/browser/actions/createPluginAction.ts
- Create Plugin unit tests:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/test/browser/actions/createPluginAction.test.ts

## Coverage matrix

| Explicit TPI requirement | Planned variation |
| --- | --- |
| Isolated folder and fixture clone | `workspace-agent-lifecycle` |
| Root `README.md` exists | `workspace-agent-lifecycle` |
| Open Chat and select Copilot, not Local | `workspace-agent-lifecycle`, `user-agent-discovery`, `plugin-agent-discovery` |
| Customizations title identifies Copilot | `workspace-agent-lifecycle`, `user-agent-discovery`, `plugin-agent-discovery` |
| Agents tab shows `agent-one` and `agent-two` as Workspace agents | `workspace-agent-lifecycle` |
| Open and rename `agent-two` | `workspace-agent-lifecycle` |
| Renamed agent appears in both surfaces | `workspace-agent-lifecycle`, `inventory-reload-regression` |
| Create a workspace agent and verify both surfaces | `workspace-agent-lifecycle`, `inventory-reload-regression` |
| Delete a workspace agent and verify both surfaces | `workspace-agent-lifecycle`, `inventory-reload-regression` |
| User-folder agent variation | `user-agent-discovery` |
| Plugin-contained agent variation | `plugin-agent-discovery` |

## Shared prerequisites and setup

- Run only the latest VS Code Insiders resolved by `@vscode/test-electron`.
  Do not fall back to Stable or an installed build.
- Use the authenticated cloned profile and confirm that the Copilot harness is
  available before testing.
- Use one independent test root per variation. Each launcher-managed root must
  contain its own `workspace`, `user-data-dir`, `extensions-dir`,
  `screenshots`, `vscode-logs`, and `reported-issues` directories.
- Trust the cloned fixture workspace and dismiss first-run or onboarding
  dialogs before capturing evidence.
- Use Git and network access only for the public fixture clone and documented
  plugin workflows.
- No test-specific extension is required.
- Preserve the fixture's committed settings unless a planned test explicitly
  changes a customization file.
- Use unique names (`agent-three`, `user-agent`, and
  `tpi-agent-plugin`/`plugin-agent`) so evidence and cleanup are unambiguous.
- Before creating the user agent, confirm that the exact target file does not
  already exist. If it does, stop that variation rather than overwrite it.

## Variation 1: Workspace agent lifecycle

- Origin: **TPI**
- Priority: **P0**
- Test variation name: `workspace-agent-lifecycle`
- Test root:
  `agent-testing-2-20260917-084557/workspace-agent-lifecycle/`

### Actions and expected results

1. Launch the isolated Insiders instance for this test root and record the
   exact version and commit.
   - Expected: latest Insiders opens and both debugger endpoints validate.
2. Clone the fixture into the test root's `workspace` directory so the
   repository is the opened workspace root; reopen that root if needed.
   - Expected: Explorer shows the fixture repository root.
3. Verify and open root `README.md`.
   - Expected: `README.md` exists at the root and opens successfully.
4. Open Chat and explicitly select the **Copilot** harness rather than
   **Local**.
   - Expected: Chat visibly identifies Copilot as the selected harness.
5. Invoke **Open Customizations** and select **Agents**.
   - Expected: the visible customization title identifies Copilot, not Local,
     and the Agents section opens.
6. Inspect the Workspace group.
   - Expected: `agent-one` and `agent-two` each appear exactly once.
7. Select `agent-two`.
   - Expected: `.github/agents/agent-two.agent.md` opens in an editor with its
     frontmatter and body intact.
8. Change only the frontmatter `name` from `agent-two` to
   `agent-two-new`, save, and return to the Agents list.
   - Expected: `agent-two-new` replaces `agent-two` in the Workspace group
     without a duplicate or validation error.
9. Open the Chat agent dropdown.
   - Expected: `agent-two-new` is present and stale `agent-two` is absent.
10. From the Agents section's New action, create a **Workspace** agent named
    `agent-three`, retain valid generated frontmatter, and save.
    - Expected: a new agent file is created under `.github/agents`, and
      `agent-three` appears exactly once in the Workspace group.
11. Open the Chat agent dropdown.
    - Expected: `agent-three` appears exactly once and can be selected.
12. Delete `agent-one` from the Customizations editor and accept any explicit
    confirmation.
    - Expected: its backing file is deleted and `agent-one` disappears from
      the Workspace group.
13. Reopen the Chat agent dropdown and inspect Explorer.
    - Expected: `agent-one` is absent; `agent-two-new` and `agent-three`
      remain; file state agrees with both UI surfaces.
14. Inspect browser console messages and relevant logs if errors occurred.
    - Expected: no errors attributable to discovery, rename, create, refresh,
      or delete.

### Evidence

- Screenshots of root `README.md`, selected Copilot harness, Copilot
  Customizations title, initial Workspace list, renamed editor/list/dropdown,
  created agent in both surfaces, deletion confirmation, and final state.
- Playwright observations proving labels and list membership/count.
- Browser console capture, including an explicit no-relevant-errors result
  when applicable.
- Relevant workbench or extension-host log excerpts only for observed
  warnings/errors, preserving original log paths.

### Cleanup

- Close the isolated Insiders window and inspector sessions.
- Preserve the modified isolated workspace and evidence.

## Variation 2: Copilot user-agent discovery

- Origin: **TPI**
- Priority: **P1**
- Test variation name: `user-agent-discovery`
- Test root:
  `agent-testing-2-20260917-084557/user-agent-discovery/`

### Actions and expected results

1. Launch an independent isolated Insiders instance, clone/open the fresh
   fixture, select the Copilot harness, and record version/commit.
   - Expected: the Copilot-scoped customization UI is available.
2. Confirm that the exact user file
   `~/.copilot/agents/user-agent.agent.md` does not exist, then create it with
   valid agent frontmatter using `name: user-agent` and a minimal body.
   - Expected: only the uniquely named test file is added; no existing user
     customization is overwritten.
3. Open Copilot **Open Customizations** > **Agents**.
   - Expected: the title identifies Copilot and `user-agent` appears exactly
     once in the Copilot personal/global group, not the Workspace group.
4. Open the Chat agent dropdown and select `user-agent`.
   - Expected: `user-agent` appears exactly once and is selectable.
5. Open `user-agent` from Customizations.
   - Expected: it resolves to the intended
     `~/.copilot/agents/user-agent.agent.md` backing file.
6. Inspect console messages and relevant logs if errors occurred.
   - Expected: no discovery or source-classification errors attributable to
     the new user agent.

### Evidence

- Screenshot of Copilot harness/title and the user agent in its labeled group.
- Screenshot/observation of `user-agent` in the Chat dropdown.
- Evidence that the opened entry resolves to the intended backing file.
- Browser console capture and relevant log excerpts for any errors.

### Cleanup

- Delete only the uniquely created
  `~/.copilot/agents/user-agent.agent.md` test file after evidence capture.
- Close the isolated Insiders window and inspector sessions.
- Do not delete the parent user folder or any pre-existing customizations.

## Variation 3: Plugin-contained agent discovery

- Origin: **TPI**
- Priority: **P1**
- Test variation name: `plugin-agent-discovery`
- Test root:
  `agent-testing-2-20260917-084557/plugin-agent-discovery/`

### Actions and expected results

1. Launch an independent isolated Insiders instance, clone/open the fresh
   fixture, select the Copilot harness, and record version/commit.
   - Expected: the Copilot-scoped customization and plugin UI is available.
2. Create a valid workspace agent named `plugin-agent` and save it under
   `.github/agents`.
   - Expected: it is discoverable as a Workspace agent and can be selected as
     a source resource for plugin creation.
3. Run **Create Plugin**, select only `plugin-agent`, choose the standard
   **Agent Plugin** format, name it `tpi-agent-plugin`, and save it under this
   variation's workspace.
   - Expected: VS Code reports successful creation and writes
     `tpi-agent-plugin/plugin.json` plus
     `tpi-agent-plugin/com.github.copilot/agents/plugin-agent.agent.md`.
4. Inspect the generated manifest and copied agent before installation.
   - Expected: the manifest declares the standard Agent Plugins schema and
     the copied agent preserves its valid content.
5. Add/install the generated local plugin through the Agent Plugins UI.
   - Expected: `tpi-agent-plugin` is listed as installed and enabled in the
     isolated profile; no unrelated plugin is modified.
6. Open Copilot **Open Customizations** > **Agents** and the Chat agent
   dropdown.
   - Expected: a plugin-provided `plugin-agent` is exposed under the Plugins
     source/group and is available to Copilot. Its source is distinguishable
     from any workspace copy, and each source contributes no duplicate stale
     entries.
7. Open the plugin-provided entry.
   - Expected: it resolves to the plugin copy and is presented as read-only or
     otherwise protected from direct source editing, consistent with the
     Plugins group description.
8. Inspect browser console and relevant plugin/agent logs.
   - Expected: no creation, installation, parsing, or agent-discovery errors
     attributable to the plugin.

### Evidence

- Screenshots of resource selection, successful plugin creation, generated
  structure, installed/enabled plugin state, Plugins group, and Chat dropdown.
- File observations for `plugin.json` and the packaged agent.
- Evidence of source distinction and read-only behavior.
- Browser console capture and relevant log excerpts for any errors.

### Cleanup

- Disable/uninstall only `tpi-agent-plugin` from the isolated profile if the
  UI supports it, then close the isolated Insiders window and inspector
  sessions.
- Preserve the generated plugin directory and screenshots as evidence.

## Variation 4: Inventory reload regression

- Origin: **Exploratory**
- Priority: **P1**
- Test variation name: `inventory-reload-regression`
- Test root:
  `agent-testing-2-20260917-084557/inventory-reload-regression/`
- Charter: investigate cross-surface consistency and persistence after a
  bounded workspace-agent rename/create/delete sequence followed by one
  window reload.
- Hypothesis: file watcher events and reload-time discovery produce the same
  final inventory with no stale or duplicate entries.
- Bound: one rename, one creation, one deletion, one reload, and at most five
  minutes after initial fixture discovery.
- Stopping condition: stop after both surfaces and backing files are compared
  post-reload, or on the first blocking discovery/reload defect.

### Actions and expected observations

1. Launch an independent isolated Insiders instance, clone/open the fresh
   fixture, select Copilot, and record version/commit.
   - Expected: initial inventory has `agent-one` and `agent-two`.
2. Rename `agent-two` to `agent-two-new`, create `agent-three`, and delete
   `agent-one`, checking Customizations and the Chat dropdown after each save.
   - Expected from documented file-backed behavior: both UI surfaces agree
     with backing files before reload.
3. Run **Developer: Reload Window** and wait for observable agent discovery to
   settle.
   - Investigate: `agent-two-new` and `agent-three` should each appear once in
     both surfaces; `agent-two` and `agent-one` should remain absent.
4. Open each surviving entry from Customizations and select each from Chat.
   - Investigate: each entry should resolve to the correct backing file with
     no stale editor, wrong source, duplicate, or relevant console error.

### Evidence

- Before/after/reload screenshots of both inventories.
- Playwright list membership and count observations.
- Backing-file observations and browser console capture.
- Relevant workbench or extension-host log excerpts for any discrepancy.

### Cleanup

- Close the isolated Insiders window and inspector sessions.
- Preserve the modified isolated workspace and evidence.

## Known risks and handling

- Insiders wording can evolve. Record the exact visible harness label, but do
  not substitute Local for the issue-required Copilot harness.
- Agent discovery is asynchronous. Wait for an observable settled state;
  persistent stale or duplicate entries are failures, not reasons to silently
  extend the plan.
- Authentication expiry blocks affected variations. Refresh only the source
  profile session; do not sign in directly in an isolated profile.
- Insiders resolution or download failure blocks the run. Do not fall back to
  Stable.
- The issue's user path example uses a non-documented singular `agent`
  directory and nonstandard filename. This plan uses the documented
  `~/.copilot/agents/*.agent.md` contract and records that interpretation.
- A pre-existing `user-agent.agent.md` is a blocker for the user variation;
  never overwrite it.
- Plugin installation UX might differ from current documentation. Record the
  visible route and stop for approval if completing the test would require an
  unplanned external marketplace publication or modification outside the
  isolated profile.
- Do not submit model prompts. This plan tests customization discovery and
  lifecycle UI, not response quality.
