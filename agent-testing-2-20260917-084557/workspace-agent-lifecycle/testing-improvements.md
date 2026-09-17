# Testing Improvements

## VS Code

- Add stable `data-testid` values to Customizations category controls,
  scope headers, rows, row action buttons, and inventory counts. The current
  accessible names are useful, but stable identifiers would reduce dependence
  on visible copy and hover state.
- Make the Customizations row action menu reliably activatable when the
  Electron window is controlled over CDP but is not the foreground OS window.
  The same delete workflow was reliable through Explorer once the isolated
  window was foregrounded.
- Expose native file-delete confirmation through an automation-friendly
  surface, or document that OS-level interaction is required. Playwright could
  initiate the delete but could not accept the native `Move to Recycle Bin`
  dialog over the renderer CDP endpoint.

## TPI skill and scripts

- Add current selector examples for:
  - provider button names (`Local`, `Copilot`);
  - `Open Agents`;
  - `.ai-customization-list-item .item-name`;
  - Chat agent picker entries with role `menuitemcheckbox`;
  - `New Agent` location and filename quick picks.
- Add a helper that invokes a command by clicking the exact command-palette
  option. Pressing Enter can be ambiguous when the palette also shows an
  `Ask in Chat` result.
- Add a documented native-dialog handoff mechanism for Electron confirmations,
  such as a signal file or callback, so the persisted Playwright run can wait
  deterministically while the runner foregrounds the isolated window and
  accepts the dialog.
- Print the final executable's `--version` and commit after launch. The
  download progress identifier differed from the commit reported by the
  executable, which required a separate version query.
- Encourage explicit progress markers in longer unattended scripts. This
  makes native-dialog handoffs and failure localization faster without fixed
  sleeps.

## What went well

- The isolated launcher supplied distinct renderer and extension-host
  endpoints and kept artifacts under the variation root.
- Exact inventory assertions caught stale and duplicate entries across both
  Customizations and Chat.
- Resetting the fixture after selector discovery kept the final measured run
  reproducible.
