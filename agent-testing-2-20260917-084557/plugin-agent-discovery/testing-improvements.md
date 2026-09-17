# Testing Improvements

## VS Code

- The Workspace **New Agent** picker in an empty Copilot workspace initially
  reported `No agent source folders found`. The test had to create the valid
  `.github/agents/plugin-agent.agent.md` fixture directly and then observe it
  through the workbench. The picker should always offer the standard
  `.github/agents` location for an open workspace.
- **Create Plugin** and the full Agent Plugins management surface were
  discoverable under the Local harness, while the generated plugin was being
  tested for Copilot. The UI should explain this scope relationship or expose
  the same management affordance consistently.
- Copilot's Chat picker needs source labels when equal agent names come from
  Workspace and Plugins. Its Customizations page should also expose the
  Plugins group indicated by the sidebar count.

## TPI skill

- Add reusable helpers for the tree-style **Create Plugin** resource picker;
  selecting an item requires clicking the entry's separate `role=checkbox`,
  not its text.
- Document that **Install from Source** opens a text prompt accepting a local
  folder path, rather than the simple folder picker used by plugin creation.
- Provide a bounded screenshot helper that retries Playwright capture. The
  first capture of a quick-input view timed out while the failure screenshot
  immediately afterward succeeded.
- Document a recovery path for plugin activation checks: close only the
  isolated window, relaunch the same root with `start-vscode`, and verify that
  installed state persists before classifying the result.
