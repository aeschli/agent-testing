import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	connectToWorkbench,
	readRequiredEnvironment,
	runCommand,
	visibleTexts,
} from '../../.github/skills/tpi-test/playwright-workbench-utils.mts';

const rootDir = readRequiredEnvironment('TEST_ROOT_DIR');
const endpoint = readRequiredEnvironment('VSCODE_CDP_ENDPOINT');
const { browser, workbench } = await connectToWorkbench(endpoint);

try {
	await workbench.keyboard.press('Escape');
	await workbench.screenshot({
		path: join(rootDir, 'screenshots', 'selector-exploration-initial.png'),
		fullPage: true,
	});

	await workbench.keyboard.press('Control+P');
	const quickInput = workbench.locator('.quick-input-widget').filter({ visible: true });
	await quickInput.getByRole('textbox').fill('README.md');
	await quickInput.getByRole('option').filter({ hasText: 'README.md' }).first().waitFor();
	await quickInput.getByRole('textbox').press('Enter');
	await workbench.locator('.editor-group-container').getByText('README.md', { exact: true }).first().waitFor();

	await runCommand(workbench, 'Chat: Open Chat');
	await workbench.waitForTimeout(300);
	const chatButtons = await visibleTexts(workbench.getByRole('button'));
	const chatText = await visibleTexts(workbench.locator('.auxiliarybar, .sidebar'));
	await workbench.screenshot({
		path: join(rootDir, 'screenshots', 'selector-exploration-chat.png'),
		fullPage: true,
	});

	await runCommand(workbench, 'Chat: Open Customizations');
	await workbench.waitForTimeout(300);
	const customizationButtons = await visibleTexts(workbench.getByRole('button'));
	const customizationTabs = await visibleTexts(workbench.getByRole('tab'));
	const customizationText = await visibleTexts(workbench.locator('.editor-group-container'));
	await workbench.screenshot({
		path: join(rootDir, 'screenshots', 'selector-exploration-customizations.png'),
		fullPage: true,
	});

	await workbench.getByText('Agents', { exact: true }).filter({ visible: true }).last().click();
	await workbench.getByText('Workspace', { exact: true }).last().waitFor();
	const agentPageButtons = await visibleTexts(workbench.getByRole('button'));
	const agentPageText = await visibleTexts(workbench.locator('.editor-group-container'));
	const agentPageLinks = await visibleTexts(workbench.getByRole('link'));
	const agentPageRows = await visibleTexts(
		workbench.locator('li, [role="listitem"], [role="option"], [role="row"]'),
	);
	await workbench.screenshot({
		path: join(rootDir, 'screenshots', 'selector-exploration-agents.png'),
		fullPage: true,
	});
	const agentTwo = workbench.getByText('agent-two', { exact: true }).filter({ visible: true });
	const agentTwoMarkup = await agentTwo.evaluate(element => {
		let current: Element | null = element;
		for (let depth = 0; current && depth < 6; depth++, current = current.parentElement) {
			if (
				current.matches('li, [role="listitem"], [role="row"]')
				|| current.querySelector('button')
			) {
				return current.outerHTML;
			}
		}
		return element.outerHTML;
	});
	const agentTwoAncestors = await agentTwo.evaluate(element => {
		const values: Array<{ className: string; role: string | null; tagName: string; text: string }> = [];
		let current: Element | null = element;
		for (let depth = 0; current && depth < 8; depth++, current = current.parentElement) {
			values.push({
				className: current.className,
				role: current.getAttribute('role'),
				tagName: current.tagName,
				text: (current.textContent ?? '').trim().slice(0, 300),
			});
		}
		return values;
	});
	const agentOne = workbench.getByText('agent-one', { exact: true }).filter({ visible: true });
	await agentOne.hover();
	const hoveredAgentButtons = await visibleTexts(workbench.getByRole('button'));

	await workbench.getByRole('button', { name: 'New Agent', exact: true }).filter({ visible: true }).first().click();
	await workbench.waitForTimeout(200);
	const newAgentQuickInputText = await visibleTexts(
		workbench.locator('.quick-input-widget').filter({ visible: true }),
	);
	const newAgentContextText = await visibleTexts(
		workbench.locator('.context-view').filter({ visible: true }),
	);
	const locationQuickInput = workbench.locator('.quick-input-widget').filter({ visible: true });
	await locationQuickInput.getByRole('option').filter({ hasText: '.github' }).first().click();
	const newAgentNamePromptText = await visibleTexts(
		workbench.locator('.quick-input-widget').filter({ visible: true }),
	);
	const newAgentNamePlaceholder = await workbench
		.locator('.quick-input-widget')
		.filter({ visible: true })
		.getByRole('textbox')
		.getAttribute('placeholder');
	await workbench.keyboard.press('Escape');
	await agentOne.click({ button: 'right' });
	const agentContextMenuText = await visibleTexts(
		workbench.locator('.context-view').filter({ visible: true }),
	);
	await workbench.keyboard.press('Escape');
	await agentTwo.click();
	await workbench.waitForTimeout(200);
	const openedAgentEditorText = await visibleTexts(
		workbench.locator('.editor-group-container').filter({ visible: true }),
	);
	await workbench.screenshot({
		path: join(rootDir, 'screenshots', 'selector-exploration-agent-two-editor.png'),
		fullPage: true,
	});

	await workbench.keyboard.press('Escape');
	await runCommand(workbench, 'Chat: Open Chat');
	await workbench.getByRole('button', { name: 'Local', exact: true }).click();
	const harnessMenuText = await visibleTexts(
		workbench.locator('.context-view').filter({ visible: true }),
	);
	await workbench.keyboard.press('Escape');
	await workbench.getByRole('button', { name: 'Agent', exact: true }).click();
	const agentDropdownText = await visibleTexts(
		workbench.locator('.context-view').filter({ visible: true }),
	);
	await workbench.keyboard.press('Escape');

	await writeFile(
		join(rootDir, 'selector-exploration.json'),
		`${JSON.stringify({
			chatButtons,
			chatText,
			customizationButtons,
			customizationTabs,
			customizationText,
			agentPageButtons,
			agentPageText,
			agentPageLinks,
			agentPageRows,
			agentTwoMarkup,
			agentTwoAncestors,
			hoveredAgentButtons,
			newAgentQuickInputText,
			newAgentContextText,
			newAgentNamePromptText,
			newAgentNamePlaceholder,
			agentContextMenuText,
			openedAgentEditorText,
			harnessMenuText,
			agentDropdownText,
		}, undefined, 2)}\n`,
	);
} finally {
	await browser.close();
}
