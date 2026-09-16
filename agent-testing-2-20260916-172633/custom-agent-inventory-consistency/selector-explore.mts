import {
	connectToWorkbench,
	runCommand,
} from '../../.github/skills/tpi-test/playwright-workbench-utils.mts';

const endpoint = process.env.VSCODE_CDP_ENDPOINT;
if (!endpoint) {
	throw new Error('Missing VSCODE_CDP_ENDPOINT.');
}

const { browser, workbench } = await connectToWorkbench(endpoint);
try {
	const action = process.env.EXPLORE_ACTION;
	if (action === 'open-harness-menu') {
		await workbench.getByRole('button', { name: 'Local', exact: true }).click();
		await workbench.locator('.context-view').filter({ visible: true }).waitFor({ state: 'visible' });
	} else if (action === 'open-customizations') {
		await workbench.getByRole('button', { name: 'Open Customizations', exact: true }).click();
		await workbench.waitForTimeout(500);
	} else if (action === 'select-copilot-open-customizations') {
		const copilotHarness = workbench.getByRole('menuitemcheckbox', { name: /^Copilot,/ });
		if (!await copilotHarness.isVisible().catch(() => false)) {
			await workbench.getByRole('button', { name: 'Local', exact: true }).click();
		}
		await copilotHarness.click();
		await workbench.getByRole('button', { name: 'Open Customizations', exact: true }).click();
		await workbench.waitForTimeout(500);
	} else if (action === 'open-agent-menu') {
		await workbench.getByRole('button', { name: 'Agent', exact: true }).click();
		await workbench.locator('.context-view').filter({ visible: true }).waitFor({ state: 'visible' });
	} else if (action === 'open-agents-customization') {
		await workbench.getByRole('button', { name: 'Open Agents', exact: true }).click();
		await workbench.waitForTimeout(500);
	} else if (action === 'open-agent-two') {
		await workbench.getByRole('list', { name: 'Workspace' })
			.getByRole('listitem', { name: /^agent-two\./ })
			.click();
		await workbench.waitForTimeout(500);
	} else if (action === 'start-new-workspace-agent') {
		const back = workbench.getByRole('button', { name: 'Back to list', exact: true });
		if (await back.isVisible().catch(() => false)) {
			await back.click();
		}
		await workbench.getByRole('button', { name: 'New Agent', exact: true }).first().click();
		await workbench.waitForTimeout(500);
	} else if (action === 'continue-new-workspace-agent') {
		await workbench.getByRole('option', { name: /agents, \.github\\agents/ }).click();
		await workbench.waitForTimeout(500);
	} else if (action === 'open-agent-one-actions') {
		await workbench.keyboard.press('Escape');
		await workbench.getByRole('button', { name: 'More actions for agent-one', exact: true }).click();
		await workbench.waitForTimeout(500);
	} else if (action === 'navigate-agent-one-actions') {
		await workbench.keyboard.press('Escape');
		await workbench.getByRole('button', { name: 'Open Customizations', exact: true }).click();
		const openAgents = workbench.getByRole('button', { name: 'Open Agents', exact: true });
		if (await openAgents.isVisible().catch(() => false)) {
			await openAgents.click();
		}
		await workbench.getByRole('button', { name: 'More actions for agent-one', exact: true }).click();
		await workbench.waitForTimeout(500);
	} else if (action === 'start-delete-agent-one') {
		await workbench.keyboard.press('Escape');
		const openCustomizations = workbench.getByRole('button', { name: 'Open Customizations', exact: true });
		if (await openCustomizations.isVisible().catch(() => false)) {
			await openCustomizations.click();
		}
		const openAgents = workbench.getByRole('button', { name: 'Open Agents', exact: true });
		if (await openAgents.isVisible().catch(() => false)) {
			await openAgents.click();
		}
		await workbench.getByRole('button', { name: 'More actions for agent-one', exact: true }).click();
		await workbench.getByRole('menuitem', { name: 'Delete', exact: true }).click();
		await workbench.waitForTimeout(500);
	} else if (action === 'perform-delete-agent-one') {
		await workbench.keyboard.press('Escape');
		const openCustomizations = workbench.getByRole('button', { name: 'Open Customizations', exact: true });
		if (await openCustomizations.isVisible().catch(() => false)) {
			await openCustomizations.click();
		}
		const openAgents = workbench.getByRole('button', { name: 'Open Agents', exact: true });
		if (await openAgents.isVisible().catch(() => false)) {
			await openAgents.click();
		}
		await workbench.getByRole('button', { name: 'More actions for agent-one', exact: true }).click();
		await workbench.keyboard.press('ArrowDown');
		await workbench.keyboard.press('ArrowDown');
		await workbench.keyboard.press('ArrowDown');
		await workbench.keyboard.press('Enter');
		await workbench.keyboard.press('Enter');
		await workbench.waitForTimeout(2_000);
	} else if (action === 'reload-window') {
		await workbench.keyboard.press('Escape');
		const closeModal = workbench.getByRole('button', { name: /^Close Modal Editor/ });
		if (await closeModal.isVisible().catch(() => false)) {
			await closeModal.click();
		}
		await runCommand(workbench, 'Developer: Reload Window');
		await workbench.waitForTimeout(500);
	} else if (action === 'capture-final-response') {
		const screenshotPath = process.env.SCREENSHOT_PATH;
		if (!screenshotPath) {
			throw new Error('Missing SCREENSHOT_PATH.');
		}
		await workbench.screenshot({ path: screenshotPath, fullPage: true });
	} else if (action === 'close-isolated-window') {
		await workbench.keyboard.press('Alt+F4');
		await workbench.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
	}
	if (workbench.isClosed()) {
		console.log('WORKBENCH_CLOSED=true');
	} else {
		console.log(`TITLE=${await workbench.title()}`);
		console.log(`URL=${workbench.url()}`);
		console.log(await workbench.locator('body').ariaSnapshot({ timeout: 30_000 }));
		const contextView = workbench.locator('.context-view').filter({ visible: true });
		if (await contextView.isVisible().catch(() => false)) {
			console.log('CONTEXT_VIEW');
			console.log(await contextView.ariaSnapshot());
		}
		const menus = workbench.locator('.monaco-menu').filter({ visible: true });
		console.log(`VISIBLE_MENUS=${await menus.count()}`);
		for (const menu of await menus.all()) {
			console.log(await menu.ariaSnapshot());
		}
	}
} finally {
	await browser.close();
}
