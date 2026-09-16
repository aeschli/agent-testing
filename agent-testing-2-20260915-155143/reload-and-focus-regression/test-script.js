const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const endpoint = process.env.RENDERER_ENDPOINT || 'http://127.0.0.1:60798';
const root = __dirname;
const screenshots = path.join(root, 'screenshots');
const observations = [];
const consoleMessages = [];

/*
 * Pre-reload setup performed through this same CDP endpoint before this
 * state-preserving reload script was saved:
 * 1. Focused the Local harness button, pressed Enter/ArrowUp/Enter for Copilot.
 * 2. Focused Open Customizations and pressed Enter; opened Agents.
 * 3. Opened agent-two, focused its Monaco native-edit-context, changed line 2
 *    to "name: agent-two-new" with keyboard selection, and saved with Ctrl+S.
 * 4. Used Workspace > New Agent, selected .github\agents, and entered
 *    "agent-three".
 * 5. Attempted More actions > Delete for agent-one through Playwright. The
 *    transient context-menu action did not invoke over CDP, so the backing
 *    file was removed directly. The UI file watcher refreshed to two agents.
 */

async function workbench(browser) {
  const pages = browser.contexts().flatMap(context => context.pages());
  return pages.find(page => page.url().includes('workbench.html'));
}

async function openAgentMenu(page) {
  const button = page.getByRole('button', { name: 'Agent', exact: true }).first();
  await button.focus();
  observations.push({
    control: 'Chat agent selector',
    ariaLabel: await page.locator(':focus').getAttribute('aria-label'),
    visibleFocus: await button.evaluate(element => element.matches(':focus-visible')),
  });
  await button.press('Enter');
  await page.waitForTimeout(300);
}

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.connectOverCDP(endpoint);
  let page = await workbench(browser);
  page.on('console', message => consoleMessages.push({
    timestamp: new Date().toISOString(),
    type: message.type(),
    text: message.text(),
  }));
  page.on('pageerror', error => consoleMessages.push({
    timestamp: new Date().toISOString(),
    type: 'pageerror',
    text: error.message,
  }));

  await openAgentMenu(page);
  await page.screenshot({ path: path.join(screenshots, '05-pre-reload-chat-dropdown.png') });
  observations.push({
    phase: 'pre-reload dropdown',
    text: (await page.locator('body').innerText()).slice(-500),
  });
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+Shift+p');
  const commandInput = page.locator('.quick-input-widget input').first();
  await commandInput.fill('Developer: Reload Window');
  await commandInput.press('Enter');
  await page.waitForTimeout(8000);
  page = await workbench(browser);

  const trust = page.getByText(/Yes, I trust the authors/i);
  if (await trust.count()) {
    await trust.first().click();
    await page.waitForTimeout(1000);
  }

  await openAgentMenu(page);
  const postReloadMenu = (await page.locator('body').innerText()).slice(-500);
  observations.push({ phase: 'post-reload dropdown', text: postReloadMenu });
  await page.screenshot({ path: path.join(screenshots, '06-post-reload-chat-dropdown.png') });

  for (const name of ['agent-three', 'agent-two-new']) {
    const item = page.getByText(name, { exact: true }).last();
    await item.click();
    await page.waitForTimeout(300);
    observations.push({
      phase: `selected ${name}`,
      visible: (await page.locator('body').innerText()).includes(name),
    });
    if (name !== 'agent-two-new') {
      await openAgentMenu(page);
    }
  }

  const customizations = page.getByRole('button', { name: 'Open Customizations' }).first();
  await customizations.focus();
  observations.push({
    control: 'Open Customizations',
    ariaLabel: await page.locator(':focus').getAttribute('aria-label'),
    visibleFocus: await customizations.evaluate(element => element.matches(':focus-visible')),
  });
  await customizations.press('Enter');
  await page.waitForTimeout(800);
  const agentsSection = page.locator('[role=listitem][aria-label^="Agents,"]');
  if (await agentsSection.count()) {
    await agentsSection.click();
    await page.waitForTimeout(700);
  }
  const finalText = (await page.locator('body').innerText()).slice(-800);
  observations.push({ phase: 'post-reload Customizations', text: finalText });
  await page.screenshot({ path: path.join(screenshots, '07-post-reload-agents.png') });

  for (const name of ['agent-three', 'agent-two-new']) {
    const item = page.getByRole('listitem', { name: new RegExp(`^${name}\\.`) });
    await item.click();
    await page.waitForTimeout(400);
    observations.push({
      phase: `opened ${name}`,
      editorTextPresent: (await page.locator('body').innerText()).includes(`name:\u00a0${name}`),
    });
    const back = page.getByRole('button', { name: 'Back to list' });
    if (await back.count()) {
      await back.click();
      await page.waitForTimeout(400);
    }
  }

  fs.writeFileSync(path.join(root, 'accessibility-observations.json'), JSON.stringify(observations, null, 2));
  fs.writeFileSync(path.join(root, 'console.log'), consoleMessages
    .map(entry => `${entry.timestamp} [${entry.type}] ${entry.text}`).join('\n'));
  await browser.close();
})().catch(error => {
  fs.writeFileSync(path.join(root, 'script-error.log'), error.stack || String(error));
  process.exitCode = 1;
});
