# Variation Plan: Workspace Agent Lifecycle

- Source: https://github.com/aeschli/agent-testing/issues/2
- Origin: TPI
- Priority: P0
- Root: `agent-testing-2-20260917-084557/workspace-agent-lifecycle/`
- Parent plan: `../test-plan.md`
- Runner instructions:
  `../../.github/skills/tpi-test/test-variation-run-instructions.md`

## Setup

1. Launch latest Insiders with
   `npm run start-vscode -- --root-dir agent-testing-2-20260917-084557/workspace-agent-lifecycle`.
2. Record exact version, commit, endpoints, and timing.
3. Clone `https://github.com/aeschli/vscode-customization-migration-test.git`
   into this root's `workspace` so the repository is the opened root.
4. Trust the workspace, dismiss onboarding, and confirm authenticated Copilot.

## Test

1. Verify and open root `README.md`.
2. Open Chat and explicitly select Copilot, not Local.
3. Open Customizations; verify the title identifies Copilot; select Agents.
4. Verify exactly `agent-one` and `agent-two` in Workspace.
5. Open `agent-two`, change only its frontmatter name to
   `agent-two-new`, save, and verify replacement in Customizations and Chat.
6. Create Workspace agent `agent-three`, retain valid frontmatter, save, and
   verify it exactly once in Customizations and Chat.
7. Delete `agent-one`, accept confirmation, and verify its backing file and
   both UI entries are gone while the other two remain.
8. Capture browser console state and relevant logs for any errors.

## Expected result

The root README exists; Copilot-scoped Customizations discovers the two fixture
agents; rename, create, and delete update backing files, Customizations, and
the Chat dropdown without stale or duplicate entries.

## Evidence and record

Capture screenshots and Playwright observations for every state transition.
Write the authoritative result to `test-result.md`, timing to `timing.json`,
and process feedback to `testing-improvements.md`. Close only this test's
Insiders and inspector processes during teardown.
