# Stale Chat agent accessibility count after workspace-agent deletion

- Insiders: `1.138.0-insider`
- Commit: `7debcd0e2acdea1c52de81bf9ee1620444407dda`
- Platform: Windows
- Severity: Minor (accessibility/state feedback)

## Steps

1. Open a trusted workspace containing two `.github/agents/*.agent.md` files.
2. Select the Copilot harness and open **Customizations > Agents**.
3. Create and save a third workspace agent.
4. Delete one workspace agent through its More Actions menu and accept confirmation.
5. Open the Chat custom-agent picker and inspect the live status text.

## Expected

The picker contains two agents and its live status reports `2 agents`.

## Actual

The picker correctly contains only the two surviving agents, but the live status remains:

```html
<div class="monaco-status" aria-live="polite" aria-atomic="true" style="visibility: visible;">3 agents</div>
```

This can announce an incorrect result count to screen-reader users.

## Evidence

- [Final picker with two visible entries](../screenshots/17-final-chat-dropdown.png)
- [Final Customizations list with two entries](../screenshots/16-final-workspace-list.png)
