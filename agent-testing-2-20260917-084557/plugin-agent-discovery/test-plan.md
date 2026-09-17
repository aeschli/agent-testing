# Variation Plan: Plugin-Contained Agent Discovery

- Source: https://github.com/aeschli/agent-testing/issues/2
- Origin: TPI
- Priority: P1
- Root: `agent-testing-2-20260917-084557/plugin-agent-discovery/`
- Parent plan: `../test-plan.md`
- Runner instructions:
  `../../.github/skills/tpi-test/test-variation-run-instructions.md`

## Setup

1. Launch latest Insiders for this root and record version, commit, endpoints,
   and timing.
2. Clone/open a fresh fixture workspace, trust it, select Copilot, and confirm
   authentication.

## Test

1. Create a valid Workspace agent named `plugin-agent`.
2. Run Create Plugin, select only `plugin-agent`, choose Agent Plugin, name it
   `tpi-agent-plugin`, and save it under this variation's workspace.
3. Verify standard `plugin.json` and
   `com.github.copilot/agents/plugin-agent.agent.md`.
4. Add/install the generated local plugin through the isolated profile's
   Agent Plugins UI.
5. Verify the enabled plugin and plugin-provided agent in Copilot
   Customizations and the Chat dropdown, clearly distinguished from Workspace.
6. Open the plugin entry and verify the plugin copy and read-only behavior.
7. Capture console state and relevant plugin/agent logs for any errors.

## Expected result

VS Code creates a valid Agent Plugins 1.0 package, installs it locally in the
isolated profile, and exposes its agent through the Copilot customization
surfaces without stale or ambiguous duplicate entries.

## Evidence and record

Capture screenshots, generated-file observations, and Playwright observations.
Write `test-result.md`, `timing.json`, and `testing-improvements.md`. Uninstall
only the test plugin if supported, preserve generated evidence, and close only
this test's processes.
