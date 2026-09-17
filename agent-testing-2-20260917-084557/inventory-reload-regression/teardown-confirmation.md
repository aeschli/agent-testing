# Teardown Confirmation

- Teardown verified: `2026-09-17T08:58:41.2917104Z`
- Method: invoked **File: Close Window** through the isolated workbench's F1
  command palette.
- Root-scoped process query before teardown identified the isolated Insiders
  process tree by the exact test-root path in its command line.
- Root-scoped process query after teardown, excluding the query process itself:
  `0` matching processes.
- No process was terminated by image name or broad process matching.
- No unrelated VS Code, Node, inspector, or user process was closed.
- The modified isolated workspace and all evidence were preserved.
