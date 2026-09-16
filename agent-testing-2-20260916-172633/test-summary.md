# TPI Test Summary

- Source issue: https://github.com/aeschli/agent-testing/issues/2
- Test ID: `agent-testing-2-20260916-172633`
- Channel: `insiders`
- VS Code version: `1.139.0-insider`
- VS Code commit: `c74ba73b780a4a33173c006e52560d61432f53d6`
- Platform: Windows
- Overall status: **Passed**

| Variation | Origin | Status | Measured automation | Total orchestration |
| --- | --- | --- | ---: | ---: |
| `workspace-agent-lifecycle` | TPI | **Passed** | 9.799 s | 24m 44.608s |
| `custom-agent-inventory-consistency` | Exploratory | **Passed** | 66.291 s | 20m 42.143s |

## Results

### Workspace agent lifecycle

The isolated fixture opened at its repository root with `README.md`. The
Copilot harness initially exposed exactly `agent-one` and `agent-two`.
Renaming `agent-two` to `agent-two-new`, creating `agent-three`, and deleting
`agent-one` updated the backing files, Agent Customizations Workspace group,
and Chat agent dropdown without stale or duplicate entries.

Authoritative result:
[workspace-agent-lifecycle/test-result.md](./workspace-agent-lifecycle/test-result.md)

### Custom agent inventory consistency

After the same lifecycle changes and **Developer: Reload Window**, Agent
Customizations, the Chat dropdown, and `.github/agents` each contained exactly
`agent-two-new` and `agent-three`. In response to the single exact prompt
`What agents can you use`, Copilot reported both active workspace agents,
omitted deleted `agent-one` and stale `agent-two`, and separately listed its
built-in specialized agents. The active custom-agent inventories were
consistent.

Authoritative result:
[custom-agent-inventory-consistency/test-result.md](./custom-agent-inventory-consistency/test-result.md)

## Diagnostics

- No issue was reported for either variation.
- The inventory run observed a renderer
  `Aborted onWillSaveTextDocument-event after 1750ms` message during rename,
  but the save, both UI inventories, backing files, reload persistence, and
  Copilot response were all correct.
- Isolated Insiders and inspector processes were closed after each variation.
