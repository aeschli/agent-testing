const { chromium } = require('playwright');
const path = require('path');

const endpoint = process.env.VSCODE_CDP_ENDPOINT || 'http://127.0.0.1:9222';

function findPage(browser, fragment) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.url().includes(fragment)) {
        return page;
      }
    }
  }
  return undefined;
}

async function main() {
  const browser = await chromium.connectOverCDP(endpoint);
  try {
    const workbench = findPage(browser, '/workbench/workbench.html');
    if (!workbench) {
      throw new Error('Workbench page not found.');
    }

    let agents = findPage(browser, '/sessions.html');
    if (!agents) {
      await workbench.getByRole('button', { name: /Open in Agents Window/ }).click();
      await workbench.waitForTimeout(3000);
      agents = findPage(browser, '/sessions.html');
    }
    if (!agents) {
      throw new Error('Agents page not found.');
    }

    await agents.bringToFront();
    const existingCustomizations = agents.getByRole('dialog', { name: 'Agent Customizations' });
    if (await existingCustomizations.isVisible()) {
      await existingCustomizations.getByRole('button', { name: /Close Modal Editor/ }).click();
    }
    const priorSession = agents.getByRole('treeitem', { name: /Reply with ready/ });
    if (!await priorSession.isVisible()) {
      const prompt = agents.getByRole('textbox').first();
      await prompt.focus();
      await agents.keyboard.insertText('Reply with ready.');
      await agents.getByRole('button', { name: 'Send', exact: true }).click();
      await agents.getByRole('button', { name: /Cancel/ }).waitFor({
        state: 'hidden',
        timeout: 120000,
      });
    }

    await agents.getByRole('button', { name: /Overview/ }).click();
    const customizations = agents.getByRole('dialog', { name: 'Agent Customizations' });
    await customizations.waitFor();
    await customizations.getByRole('button', { name: /^Migrations/ }).click();
    await agents.waitForTimeout(8000);

    const snapshot = await customizations.ariaSnapshot();
    console.log(snapshot);
    await agents.screenshot({
      path: path.join(__dirname, 'screenshots', 'retry-migrations-view.png'),
      fullPage: true,
    });

    await customizations.getByRole('button', { name: /Review MCP Servers/ }).click();
    await agents.waitForTimeout(2000);
    const candidateSnapshot = await customizations.ariaSnapshot();
    console.log(candidateSnapshot);
    await agents.screenshot({
      path: path.join(__dirname, 'screenshots', 'candidate-list.png'),
      fullPage: true,
    });

    if (!candidateSnapshot.includes('migrate-me') || !candidateSnapshot.includes('leave-me')) {
      throw new Error('Expected compatible MCP server candidates were not displayed.');
    }
    if (candidateSnapshot.includes('uses-workspace-variable')) {
      throw new Error('Unsupported workspace-variable server was offered for migration.');
    }

    const leaveMe = customizations.getByRole('checkbox', { name: /Select leave-me/ });
    if (!await leaveMe.isChecked()) {
      throw new Error('leave-me was not selected by default.');
    }
    await leaveMe.focus();
    await agents.keyboard.press('Space');
    if (await leaveMe.isChecked()) {
      throw new Error('Keyboard did not clear the leave-me candidate.');
    }
    await agents.keyboard.press('Space');
    if (!await leaveMe.isChecked()) {
      throw new Error('Keyboard did not restore the leave-me candidate.');
    }
    console.log('Keyboard checkbox toggle passed for leave-me.');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
