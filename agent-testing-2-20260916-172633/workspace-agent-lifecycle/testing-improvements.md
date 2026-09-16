# Testing improvements

## VS Code

- Give Agent Customizations list items stable `data-testid` values and expose
  a distinct accessible grouping label for Workspace, User, and Built-in
  lists. This would avoid locating a list by its changing contents.
- Keep the Chat agent picker in a uniquely identifiable container. Tooltips
  and menus currently share `.context-view`, which makes otherwise accessible
  automation ambiguous.
- Expose a stable accessible command on the embedded agent editor for
  returning to the list. The current **Back to list** button works well once
  discovered, but it is not obvious from the modal editor structure.
- Populate the generated agent template before, or atomically with, exposing
  the new agent in the inventory. The file briefly exists empty before the
  template arrives, requiring callers to wait for content rather than file
  creation.

## TPI skill and resources

- Add shared helpers for locating Agent Customizations scope lists and the Chat
  agent picker. Both are common TPI surfaces and currently require bespoke
  selector discovery.
- Add a helper that closes transient quick inputs, menus, dialogs, and modal
  editors before a clean rerun. Persisted UI state otherwise makes retries
  unnecessarily fragile.
- Document that Playwright uses `Control+Period`, not `Control+.`, for the
  `Ctrl+.` shortcut token on Windows.
- Clarify that generated customization files can be created before their
  template content is populated; scripts should wait for expected frontmatter,
  not merely file existence.

## What went well

- The launcher provided isolated user data, extensions, workspace, and
  validated debugger endpoints without affecting unrelated instances.
- The shared evidence recorder and timing helper produced concise,
  authoritative artifacts.
- Accessible names were sufficient for every final interaction; no coordinate
  clicks, DOM-dispatched events, or direct filesystem mutations were needed in
  the authoritative run.

## What was slow

- Most orchestration time was spent discovering stable selectors and resetting
  focus after failed exploratory automation attempts. Product-specific shared
  helpers and a standard UI-reset helper would materially reduce future run
  time.
