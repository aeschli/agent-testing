# Copilot shows duplicate plugin agent without source distinction

## Build

- VS Code Insiders `1.139.0-insider`
- Commit `046944034292b5479b4e9a50ad1a508033ffb64f`
- Windows x64

## Reproduction

1. Create a Workspace agent named `plugin-agent`.
2. Run **Create Plugin**, select only `plugin-agent.agent.md`, choose
   **Agent Plugin**, name it `tpi-agent-plugin`, and save it locally.
3. In the Local Agent Plugins UI, use **Install from Source** with the
   generated folder and leave the plugin enabled.
4. Switch to Copilot and open **Agent Customizations > Agents**.
5. Open the Copilot Chat agent picker.

## Expected

Copilot Customizations identifies both the Workspace and Plugins sources, and
the Chat picker distinguishes the two `plugin-agent` entries or de-duplicates
them according to documented precedence.

## Actual

- Copilot Customizations reports a Plugins count of `1`, but the Agents page
  has only Workspace and User sections. The plugin-provided agent cannot be
  opened from this Copilot surface.
- The Copilot Chat picker shows two visually identical `plugin-agent` rows
  without a source label or other distinction.
- Local Customizations correctly shows separate Workspace and Plugins groups.
  Opening the plugin row resolves to the packaged copy and its editor textarea
  has `readOnly: true`.

The behavior persisted after closing and relaunching the isolated profile.

## Evidence

- `../screenshots/04-copilot-agents-after-reload.png`
- `../screenshots/05-copilot-chat-after-reload.png`
- `../screenshots/06-local-plugin-agent-read-only.png`
- `../post-reload-observations.json`
