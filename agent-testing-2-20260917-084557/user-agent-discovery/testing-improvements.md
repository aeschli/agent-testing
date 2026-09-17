# Testing Improvements

## VS Code

- Expose the full backing URI as an accessible label or tooltip in the
  Customizations editor header. The UI currently shows only
  `user-agent.agent.md`; automation must inspect the editor's `data-uri` to
  prove whether it is a user or workspace file.
- Keep Chat picker context views visible during standard Playwright
  screenshots. Capturing the page caused the picker to close, requiring a
  lower-level CDP screenshot for authoritative visual evidence.
- Stabilize extension-host debug-port reuse across **Developer: Reload
  Window**. The launcher validated port `58634`, but a later host selected
  `60682` because the original port was still occupied.

## TPI skill and resources

- Add a shared screenshot helper that uses CDP `Page.captureScreenshot` for
  transient menus and context views without dismissing them.
- Add a shared helper that resolves and asserts the active modal editor's
  `data-uri`. This is needed when Customizations opens a file inside the modal
  editor rather than a normal workbench tab.
- Document that the personal/global customization group is currently labeled
  **User** in the Agents UI.
- Have `start-vscode` emit version, commit, build date, and a machine-readable
  launch metadata file. This would avoid separately reading the launched
  build's `package.json` and `product.json`.
- Have reload-aware tooling report the current extension-host debug endpoint
  after each host restart, or explicitly state that only the initial endpoint
  is guaranteed.

## What worked well

- The isolated launcher cleanly separated user data, extensions, workspace,
  logs, and debugger endpoints.
- Exclusive `wx` fixture creation provided a strong no-overwrite guarantee.
- The shared inventory and visible-count helpers made duplicate and
  wrong-source assertions precise.
- Structured `observations.json`, console capture, screenshots, and copied log
  paths produced complementary evidence without preserving authentication
  data.
