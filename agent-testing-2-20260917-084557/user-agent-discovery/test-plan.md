# Variation Plan: Copilot User-Agent Discovery

- Source: https://github.com/aeschli/agent-testing/issues/2
- Origin: TPI
- Priority: P1
- Root: `agent-testing-2-20260917-084557/user-agent-discovery/`
- Parent plan: `../test-plan.md`
- Runner instructions:
  `../../.github/skills/tpi-test/test-variation-run-instructions.md`

## Setup

1. Launch latest Insiders for this root and record version, commit, endpoints,
   and timing.
2. Clone/open a fresh fixture workspace, trust it, select Copilot, and confirm
   authentication.
3. Confirm `~/.copilot/agents/user-agent.agent.md` does not exist. Treat an
   existing file as a blocker; never overwrite it.

## Test

1. Create only `~/.copilot/agents/user-agent.agent.md` with valid frontmatter
   (`name: user-agent`) and a minimal body.
2. Open Copilot Customizations > Agents.
3. Verify `user-agent` exactly once in the Copilot personal/global group, not
   Workspace.
4. Verify it exactly once and selectable in the Chat agent dropdown.
5. Open it from Customizations and verify the backing path.
6. Capture console state and relevant logs for any errors.

## Expected result

The documented Copilot user agent is discovered with the correct source,
appears in both Copilot UI surfaces, and resolves to the intended file.

## Evidence and record

Capture screenshots and Playwright observations. Write `test-result.md`,
`timing.json`, and `testing-improvements.md`. During teardown, delete only the
unique test file, preserve evidence, and close only this test's processes.
