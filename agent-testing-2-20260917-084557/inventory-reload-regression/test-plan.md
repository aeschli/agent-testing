# Variation Plan: Inventory Reload Regression

- Source: https://github.com/aeschli/agent-testing/issues/2
- Origin: Exploratory
- Priority: P1
- Root: `agent-testing-2-20260917-084557/inventory-reload-regression/`
- Parent plan: `../test-plan.md`
- Runner instructions:
  `../../.github/skills/tpi-test/test-variation-run-instructions.md`

## Charter

Investigate whether Copilot Customizations and the Chat agent dropdown remain
consistent after one rename, one create, one delete, and one window reload.
Bound execution to five minutes after initial discovery and stop after the
post-reload comparison or on the first blocking discovery defect.

## Setup and test

1. Launch latest Insiders for this root, record version/commit/endpoints and
   timing, then clone/open/trust a fresh fixture and select Copilot.
2. Verify the initial `agent-one` and `agent-two` inventory.
3. Rename `agent-two` to `agent-two-new`, create `agent-three`, and delete
   `agent-one`, comparing backing files and both UI surfaces after each step.
4. Run Developer: Reload Window and wait for discovery to settle.
5. Verify exactly `agent-two-new` and `agent-three` in both surfaces, with
   stale `agent-two` and `agent-one` absent.
6. Open/select each survivor and verify the correct backing file.
7. Capture console state and relevant logs for any discrepancy.

## Expected observation

The post-reload inventory matches backing files and the pre-reload final state,
without stale entries, duplicates, wrong sources, or broken editors.

## Evidence and record

Capture before/after/reload screenshots and Playwright count observations.
Write `test-result.md`, `timing.json`, and `testing-improvements.md`, preserve
the isolated workspace, and close only this test's processes.
