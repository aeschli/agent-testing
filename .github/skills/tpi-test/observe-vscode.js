const { chromium } = require('playwright');

const endpoint = process.env.VSCODE_CDP_ENDPOINT ?? 'http://127.0.0.1:9222';

(async () => {
  const browser = await chromium.connectOverCDP(endpoint);
  const pages = browser.contexts().flatMap((context) => context.pages());

  for (const page of pages) {
    console.log(`${await page.title()} ${page.url()}`);
  }

  const workbench = pages.find((page) => page.url().includes('workbench'));
  if (!workbench) {
    throw new Error(`VS Code workbench page was not found at ${endpoint}`);
  }

  await workbench.bringToFront();
  await workbench.pause();
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
