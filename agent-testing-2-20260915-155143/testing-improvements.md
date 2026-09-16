# Testing Improvements

## What worked well

- Isolated roots and dynamically assigned debugger ports allowed both items to
  run independently without sharing workspace state.
- The authenticated profile clone preserved GitHub/Copilot access, avoiding
  credentials in test artifacts.
- Renderer observation exposed both visible picker entries and the stale
  `aria-live` count, revealing an accessibility defect that screenshots alone
  could have missed.
- The fixture's committed agents and settings made the initial state
  deterministic.
- Reload testing confirmed persistence separately from immediate file-watcher
  synchronization.

## Challenges and workarounds

- Monaco editing and save operations required selector and focus retries.
  Intermediate malformed text was checked before saving, and the final Git diff
  was inspected to ensure that only the intended name and trailing newline
  changed.
- In the exploratory run, the transient context-menu **Delete** action could
  not be invoked reliably through CDP after multiple locator, keyboard,
  coordinate, and dispatched-click attempts. The bounded charter continued by
  deleting the backing file directly, and this deviation was recorded rather
  than presented as equivalent coverage of the UI delete command.
- Agent discovery and post-reload settling required explicit waits and repeated
  state observations. Fixed sleeps should remain a fallback; polling for the
  expected accessible state would be faster and less timing-sensitive.
- The full interactive workflows exceeded the requested five-minute target,
  mostly because of first-launch setup, Monaco interaction retries, transient
  menu behavior, and comprehensive evidence capture.

## Suggested VS Code improvements

- Recompute or clear the Chat picker result-count live region whenever
  workspace agent entries change. The accessible result count should derive
  from the same current collection as the visible picker rows.
- Give transient customization context-menu actions stable automation
  identifiers and ensure keyboard activation works consistently through the
  workbench accessibility tree.
- Expose a clear accessible status when workspace customization discovery has
  settled after save, deletion, or reload. This would improve both screen-reader
  feedback and deterministic UI automation.
- Consider showing the backing workspace path in the create-location picker
  with consistent slash formatting, making `.github/agents` easier to
  distinguish from alternate agent locations.

## Suggested workflow and skill improvements

- Add a reusable observation helper that waits for a named agent set across
  both Customizations and the Chat picker, and records the live-region count at
  the same time.
- Add a documented fallback sequence for Monaco edits: focus editor, select
  exact frontmatter text, type replacement, save, then verify the backing file
  and Git diff before proceeding.
- Clarify whether directly editing/deleting a backing file is acceptable in an
  exploratory synchronization test. It was useful here but does not cover the
  Customizations delete command.
- Encourage capturing accessibility live regions for list and picker
  mutations, not only accessible names and screenshots.
- For five-minute targets, separate first-launch/profile preparation from the
  item timer or provide a prepared-fixture option under each isolated root.

