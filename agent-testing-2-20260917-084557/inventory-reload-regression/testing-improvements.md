# Testing Improvements

## VS Code

- Keep global workbench shortcuts deterministic when focus is restored to an
  integrated terminal after **Developer: Reload Window**, or expose a stable
  accessibility action for the global command palette.
- Add stable `data-*` identifiers to Customizations navigation items, agent
  rows, and the Chat agent dropdown. Current automation must combine roles,
  visible text, and Monaco list classes.

## TPI skill and resources

- Make `runCommand` use F1, or explicitly focus a workbench-owned control,
  before opening the command palette. `Ctrl+Shift+P` can be consumed by a
  restored terminal after reload.
- Add a helper that returns normalized customization names from Monaco rows.
  This would avoid repeating first-line extraction when rows also contain
  descriptions.
- Persist launcher metadata (version, commit, endpoints, root process ID) to a
  JSON artifact so result and teardown records do not need to reconstruct it.
- Document the fallback for populating an already-created empty workspace when
  `git clone <url> .` rejects it.

## What went well

- CDP reacquisition after reload was reliable.
- Observable inventory polling avoided fixed readiness sleeps.
- Exact list comparison caught absence, duplicates, and stale entries while
  finishing well within the five-minute bound.
