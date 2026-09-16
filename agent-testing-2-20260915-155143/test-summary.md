# Test Summary

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Channel: `insiders`
- Version: `1.138.0-insider`
- Commit: `7debcd0e2acdea1c52de81bf9ee1620444407dda`
- Platform: Windows
- Overall result: **Failed**

| Test item | Origin | Status | Result |
| --- | --- | --- | --- |
| `workspace-agent-lifecycle` | TPI | **Failed** | Rename, create, delete, backing files, Customizations entries, and visible Chat picker entries behaved correctly. After deletion, the picker still exposed the stale `aria-live` status `3 agents` while only two agents remained. |
| `reload-and-focus-regression` | Exploratory | **Passed** | Renamed and created agents remained available exactly once after reload, the deleted and old names remained absent, surviving entries opened the correct files, and tested controls had usable labels and visible keyboard focus. |

## Defect

- [Stale Chat agent accessibility count after workspace-agent deletion](workspace-agent-lifecycle/reported-issues/stale-chat-agent-count.md)

## Detailed results

- [Workspace agent lifecycle](workspace-agent-lifecycle/test.md)
- [Reload and focus regression](reload-and-focus-regression/test.md)

