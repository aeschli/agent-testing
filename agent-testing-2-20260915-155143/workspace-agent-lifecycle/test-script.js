const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const endpoint = process.env.VSCODE_CDP_ENDPOINT || 'http://127.0.0.1:60799';
const root = __dirname;
const screenshots = path.join(root, 'screenshots');
const consoleFile = path.join(root, 'console.log');
fs.mkdirSync(screenshots, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function command(page, name) {
  await page.keyboard.press('Control+Shift+P');
  const input = page.locator('.quick-input-widget:visible input').last();
  await input.waitFor({ state: 'visible' });
  await input.fill(name);
  await page.keyboard.press('Enter');
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(screenshots, name), fullPage: true });
}

(async () => {
  const browser = await chromium.connectOverCDP(endpoint);
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((candidate) => candidate.url().includes('workbench'));
  if (!page) throw new Error(`Workbench page not found at ${endpoint}`);

  const evidence = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      evidence.push(`${new Date().toISOString()} console.${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => evidence.push(`${new Date().toISOString()} pageerror: ${error.message}`));
  page.on('requestfailed', (request) =>
    evidence.push(`${new Date().toISOString()} requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));

  await page.bringToFront();
  await sleep(3000);
  const phase = process.env.PHASE || 'inspect';

  if (phase === 'inspect') {
    console.log(await page.locator('body').innerText());
    console.log('BUTTONS', await page.getByRole('button').evaluateAll((items) =>
      items.map((item) => ({ text: item.innerText, aria: item.getAttribute('aria-label'), title: item.getAttribute('title') }))
        .filter((item) => item.text || item.aria || item.title)));
    await shot(page, '01-launched-workspace.png');
  }
  if (phase === 'accounts') {
    await page.getByRole('button', { name: 'Accounts' }).click();
    await sleep(500);
    console.log(await page.locator('body').innerText());
    await shot(page, '02-account-profile.png');
  }
  if (phase === 'readme') {
    await page.keyboard.press('Escape');
    await page.getByText('README.md', { exact: true }).first().dblclick();
    await sleep(1500);
    console.log(await page.locator('body').innerText());
    await shot(page, '03-readme-root.png');
  }
  if (phase === 'harness') {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Local', exact: true }).click();
    await sleep(500);
    console.log(await page.locator('body').innerText());
    await shot(page, '04-harness-picker.png');
  }
  if (phase === 'customizations') {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Local', exact: true }).click();
    await page.getByText('Copilot', { exact: true }).last().click();
    await sleep(750);
    await page.getByRole('button', { name: 'Open Customizations' }).click();
    await sleep(1500);
    console.log(await page.locator('body').innerText());
    await shot(page, '05-customizations-open.png');
  }
  if (phase === 'open-current-customizations') {
    await page.getByRole('button', { name: 'Open Customizations' }).click();
    await sleep(1500);
    console.log(await page.locator('body').innerText());
  }
  if (phase === 'agents') {
    const agents = page.getByText('Agents', { exact: true });
    console.log('Agents controls:', await agents.evaluateAll((items) => items.map((item) => item.outerHTML)));
    await agents.first().click();
    await sleep(1500);
    console.log(await page.locator('body').innerText());
    await shot(page, '06-initial-workspace-agents.png');
  }
  if (phase === 'open-agent-two') {
    await page.getByText('agent-two', { exact: true }).last().click();
    await sleep(1200);
    console.log(await page.locator('body').innerText());
    await shot(page, '07-agent-two-editor.png');
  }
  if (phase === 'inspect-editors') {
    console.log('TEXTAREAS', await page.locator('textarea').evaluateAll((items) => items.map((item) => item.outerHTML)));
    console.log('EDITABLES', await page.locator('[contenteditable=true]').evaluateAll((items) => items.map((item) => item.outerHTML.slice(0, 500))));
    console.log('MONACO', await page.locator('.monaco-editor').evaluateAll((items) => items.map((item) => item.outerHTML.slice(0, 1000))));
  }
  if (phase === 'inspect-file-menu') {
    console.log(await page.getByText('File', { exact: true }).first().evaluate((item) => item.parentElement?.parentElement?.outerHTML));
  }
  if (phase === 'inspect-count') {
    console.log(await page.getByText('3 agents', { exact: true }).evaluateAll((items) => items.map((item) => item.outerHTML)));
  }
  if (phase === 'rename') {
    const editor = page.locator('.monaco-editor[data-uri$="agent-two.agent.md"]');
    await editor.locator('.view-line').nth(1).click();
    await page.keyboard.press('Control+a');
    const content = `---
name: agent-two-new
description: This is agent two.
model: GPT-5.4
tools: [execute, read, edit, search, web, agent, todo]
handoffs: 
  - label: Start Implementation
    agent: agent
    prompt: Implement the plan
    send: true
    model: GPT-5.4 (copilot)
---
`;
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate((text) => navigator.clipboard.writeText(text), content);
    await page.keyboard.press('Control+v');
    await page.getByText('File', { exact: true }).first().click();
    await page.getByRole('menuitem', { name: /^Save\b/ }).first().click();
    await sleep(1500);
    await shot(page, '08-renamed-agent-editor.png');
  }
  if (phase === 'verify-rename') {
    await page.getByRole('button', { name: 'Open Customizations' }).click();
    await sleep(1000);
    await page.getByText('Agents', { exact: true }).first().click();
    await sleep(1000);
    console.log(await page.locator('body').innerText());
    await shot(page, '09-renamed-workspace-list.png');
    await page.locator('#workbench\\.panel\\.chat').getByRole('button', { name: 'Agent', exact: true }).click();
    await sleep(500);
    console.log('DROPDOWN', await page.locator('body').innerText());
    await shot(page, '10-renamed-chat-dropdown.png');
  }
  if (phase === 'dropdown') {
    await page.keyboard.press('Escape');
    await page.locator('#workbench\\.panel\\.chat').getByRole('button', { name: 'Agent', exact: true }).click();
    await sleep(500);
    console.log(await page.locator('body').innerText());
    await shot(page, '10-renamed-chat-dropdown.png');
  }
  if (phase === 'create-start') {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open Customizations' }).click();
    await page.getByText('New Agent', { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('New Agent', { exact: true }).first().click();
    await sleep(500);
    console.log(await page.locator('body').innerText());
    await shot(page, '11-create-agent-prompt.png');
  }
  if (phase === 'create-location') {
    const rows = page.locator('.quick-input-list .monaco-list-row');
    console.log('CREATE LOCATIONS', await rows.allInnerTexts());
    await rows.filter({ hasText: '.github\\agents' }).click();
    await sleep(800);
    console.log(await page.locator('body').innerText());
  }
  if (phase === 'delete-inspect') {
    await page.getByText('agent-three', { exact: true }).last().click();
    await sleep(500);
    await page.getByRole('button', { name: 'Open Customizations' }).click();
    await sleep(800);
    await page.getByText('Agents', { exact: true }).first().click();
    await sleep(800);
    const item = page.getByText('agent-one', { exact: true }).last();
    await item.hover();
    console.log('AGENT ONE', await item.evaluate((node) => node.parentElement?.parentElement?.parentElement?.outerHTML));
    console.log('BUTTONS', await page.getByRole('button').evaluateAll((items) =>
      items.map((item) => item.getAttribute('aria-label')).filter(Boolean)));
  }
  if (phase === 'delete-menu') {
    await page.getByRole('button', { name: 'More actions for agent-one' }).click();
    await sleep(400);
    console.log('MENU HTML', await page.locator('.context-view').evaluateAll((items) => items.map((item) => item.outerHTML)));
    console.log(await page.locator('body').innerText());
    await shot(page, '14-agent-one-actions.png');
  }
  if (phase === 'inspect-delete') {
    console.log(await page.getByText('Delete', { exact: true }).evaluateAll((items) => items.map((item) => item.outerHTML)));
  }
  if (phase === 'delete-prompt') {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open Customizations' }).click();
    await sleep(800);
    await page.getByText('Agents', { exact: true }).first().click();
    await sleep(800);
    await page.getByRole('button', { name: 'More actions for agent-one' }).click();
    await page.locator('.context-view:visible [role="menu"]').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await sleep(1000);
    console.log(await page.locator('body').innerText());
    await shot(page, '15-delete-confirmation.png');
  }
  if (phase === 'confirm-delete') {
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await sleep(1200);
    console.log(await page.locator('body').innerText());
    await shot(page, '16-final-workspace-list.png');
    await page.keyboard.press('Escape');
    await page.locator('#workbench\\.panel\\.chat').getByRole('button', { name: 'agent-three', exact: true }).click();
    await sleep(500);
    console.log('FINAL DROPDOWN', await page.locator('body').innerText());
    await shot(page, '17-final-chat-dropdown.png');
  }
  if (phase === 'final-dropdown') {
    await page.getByRole('button', { name: /Close Modal Editor/ }).click();
    await sleep(400);
    await page.locator('#workbench\\.panel\\.chat').getByRole('button', { name: 'agent-three', exact: true }).click();
    await sleep(500);
    console.log(await page.locator('body').innerText());
    await shot(page, '17-final-chat-dropdown.png');
  }
  if (phase === 'close') {
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt+F4');
    await sleep(1000);
  }
  if (phase === 'create-name') {
    const input = page.locator('.quick-input-widget:visible input').last();
    await input.fill('agent-three');
    await page.keyboard.press('Enter');
    await sleep(1200);
    console.log(await page.locator('body').innerText());
    await shot(page, '12-created-agent-editor.png');
  }
  if (phase === 'verify-created') {
    await page.getByRole('menuitem', { name: 'File', exact: true }).click({ force: true });
    await page.getByRole('menuitem', { name: /^Save\b/ }).first().click({ force: true });
    await sleep(1200);
    await page.getByRole('button', { name: 'Open Customizations' }).click();
    await sleep(800);
    await page.getByText('Agents', { exact: true }).first().click();
    await sleep(800);
    console.log(await page.locator('body').innerText());
    await shot(page, '13-created-workspace-list.png');
  }

  fs.writeFileSync(consoleFile,
    evidence.length ? evidence.join('\n') + '\n' : `${new Date().toISOString()} No relevant browser console, page, or request errors observed.\n`,
    { flag: 'a' });
  await browser.close();
})().catch((error) => {
  fs.appendFileSync(consoleFile, `${new Date().toISOString()} script-error: ${error.stack || error}\n`);
  console.error(error);
  process.exitCode = 1;
});
