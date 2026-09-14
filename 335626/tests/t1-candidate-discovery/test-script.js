const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const endpoint = process.env.VSCODE_CDP_ENDPOINT || 'http://127.0.0.1:9222';
const evidenceDir = __dirname;

async function getWorkbenchPage(browser) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.url().includes('/workbench/workbench.html')) {
        return page;
      }
    }
  }
  throw new Error('Could not find the VS Code workbench page.');
}

function getAgentsPage(browser) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.url().includes('/sessions.html')) {
        return page;
      }
    }
  }
  return undefined;
}

async function runCommand(page, command) {
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyP');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  const input = page.locator('.quick-input-widget input');
  await input.waitFor();
  await input.fill(command);
  const option = page.getByRole('option').filter({ hasText: command }).first();
  await option.waitFor();
  await option.click();
}

async function main() {
  const browser = await chromium.connectOverCDP(endpoint);
  try {
    const page = await getWorkbenchPage(browser);

    const continueWithoutSignIn = page.getByRole('button', { name: 'Continue without Signing In' });
    if (await continueWithoutSignIn.isVisible()) {
      await continueWithoutSignIn.click();
    }

    if (await page.getByRole('banner', { name: /Restricted Mode/ }).isVisible()) {
      await runCommand(page, 'Workspaces: Manage Workspace Trust');
      await page.getByRole('button', { name: /Trust/ }).click();
    }

    await page.keyboard.press('Escape');
    const welcomeTab = page.getByRole('tab', { name: /Welcome/ });
    if (await welcomeTab.isVisible()) {
      await welcomeTab.getByRole('button', { name: /Close/ }).click();
    }

    console.log(`Workbench title: ${await page.title()}`);
    console.log(`Workbench URL: ${page.url()}`);

    const aboutScreenshot = path.join(evidenceDir, 'screenshots', 'about.png');
    if (!fs.existsSync(aboutScreenshot)) {
      await page.getByRole('menuitem', { name: 'Help', exact: true }).click();
      await page.getByRole('menuitem', { name: 'About', exact: true }).click();
      const about = page.getByRole('dialog').filter({ hasText: /Version:/ });
      await about.waitFor();
      console.log(`About dialog:\n${await about.innerText()}`);
      await page.screenshot({ path: aboutScreenshot, fullPage: true });
      await page.keyboard.press('Escape');
    }

    await page.getByRole('button', { name: 'Open Customizations' }).click();
    const customizations = page.getByRole('dialog', { name: 'Agent Customizations' });
    await customizations.waitFor();
    await customizations.getByRole('button', { name: /^Migrations/ }).click();
    await page.waitForTimeout(5000);
    console.log(`Workbench migrations view:\n${await customizations.ariaSnapshot()}`);
    await page.screenshot({
      path: path.join(evidenceDir, 'screenshots', 'workbench-migrations-view.png'),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
