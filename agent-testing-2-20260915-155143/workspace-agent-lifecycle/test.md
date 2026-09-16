# Workspace agent lifecycle

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Test item: `workspace-agent-lifecycle`
- Origin: **TPI**
- Status: **Failed**
- Insiders: **1.138.0-insider**
- Commit: **7debcd0e2acdea1c52de81bf9ee1620444407dda**
- Build date: `2026-09-15T07:24:32Z`
- Platform: Windows

## Research and expected behavior

The approved plan references the fixture repository, VS Code custom-agent and customization-management documentation, and the VS Code customization list implementation. Workspace `.agent.md` files should be reflected without stale or duplicate entries in Customizations and the Chat agent picker.

## Environment and prerequisites

- Isolated root: `workspace-agent-lifecycle`
- Renderer endpoint: `http://127.0.0.1:60799`
- Extension-host endpoint: `http://127.0.0.1:60801`
- Fixture cloned directly into `workspace`
- Root `README.md` present and rendered
- Cloned profile account menu showed `aeschli (GitHub)`, confirming sign-in
- Copilot harness selected; no trust prompt appeared

## Steps performed

1. Launched the isolated latest Insiders instance and validated both debugger endpoints.
2. Cloned the fixture into the test root's `workspace`, opened the root README, and selected the Copilot harness.
3. Opened **Open Customizations > Agents** and confirmed exactly `agent-one` and `agent-two`.
4. Opened `.github/agents/agent-two.agent.md`, changed only `name` to `agent-two-new`, and saved.
5. Confirmed `agent-two-new` replaced `agent-two` in Customizations and the Chat picker.
6. Created and saved workspace agent `agent-three` under `.github/agents`, selected it in Chat, and confirmed it in both surfaces.
7. Used `agent-one`'s More Actions menu, chose **Delete**, captured and accepted the explicit confirmation.
8. Confirmed the file was deleted and the visible Customizations list and Chat picker contained only `agent-three` and `agent-two-new`.
9. Inspected final files, browser console evidence, and the Chat accessibility status.

## Expected result

Rename, creation, and deletion persist to the workspace and immediately synchronize across Customizations and Chat without stale entries, duplicates, errors, or incorrect status feedback.

## Actual result

All backing-file operations and visible entries behaved correctly. Final files are `agent-three.agent.md` and the renamed `agent-two.agent.md`; `agent-one.agent.md` is absent. The visible final picker has exactly `agent-three` and `agent-two-new`.

However, after deletion the Chat UI retained a visible-to-assistive-technology live status element containing `3 agents`:

```html
<div class="monaco-status" aria-live="polite" aria-atomic="true" style="visibility: visible;">3 agents</div>
```

This count should have updated to `2 agents`, so the item is **Failed** due to stale accessibility feedback.

## Console, logs, and debugger evidence

- `console.log`: no relevant browser console errors, page errors, or failed requests were observed in the final workflow.
- Renderer endpoint successfully attached throughout.
- Extension-host endpoint was validated by the launcher.
- No feature-attributable VS Code warning/error required copying. Original log root: `user-data-dir/logs`.

## Evidence

- [Authenticated profile](screenshots/02-account-profile.png)
- [Root README](screenshots/03-readme-root.png)
- [Copilot customizations](screenshots/05-customizations-open.png)
- [Initial two agents](screenshots/06-initial-workspace-agents.png)
- [Renamed workspace list](screenshots/09-renamed-workspace-list.png)
- [Renamed Chat picker](screenshots/10-renamed-chat-dropdown.png)
- [Created agent editor](screenshots/12-created-agent-editor.png)
- [Created workspace list](screenshots/13-created-workspace-list.png)
- [Delete confirmation](screenshots/15-delete-confirmation.png)
- [Final workspace list](screenshots/16-final-workspace-list.png)
- [Final Chat picker](screenshots/17-final-chat-dropdown.png)
- [Playwright script](test-script.js)

## Deviations

- Creation first presented a location picker containing `.claude\agents` and `.github\agents`; `.github\agents` was selected as required.
- The trusted cloned profile produced no trust dialog.
- Playwright required selector and focus retries for Monaco save and context-menu activation. Intermediate malformed editor input never persisted; the final Git diff changes only the requested name plus a trailing newline.

## Issues to report

- [Stale Chat agent accessibility count after deletion](reported-issues/stale-chat-agent-count.md)
