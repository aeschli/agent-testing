import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	connectToWorkbench,
	EvidenceRecorder,
	reacquireWorkbench,
	runCommand,
	visibleTexts,
	waitForObserved,
} from '../../.github/skills/tpi-test/playwright-workbench-utils.mts';

const rootDir = process.env.TEST_ROOT_DIR!;
const endpoint = process.env.VSCODE_CDP_ENDPOINT!;
const screenshotsDir = join(rootDir, 'screenshots');
const evidence = new EvidenceRecorder();
const observations: Record<string, unknown> = {};
const { browser, workbench: initialWorkbench } = await connectToWorkbench(endpoint);
let workbench = initialWorkbench;
evidence.attach(workbench);

async function screenshot(name: string): Promise<void> {
	await mkdir(screenshotsDir, { recursive: true });
	await workbench.screenshot({
		path: join(screenshotsDir, `${name}.png`),
		fullPage: true,
		timeout: 60_000,
	});
}

async function selectHarness(name: 'Copilot' | 'Local'): Promise<void> {
	if (await workbench.getByRole('button', { name, exact: true }).filter({ visible: true }).count()) {
		return;
	}
	const current = name === 'Copilot' ? 'Local' : 'Copilot';
	await workbench.getByRole('button', { name: current, exact: true }).click();
	const menu = workbench.locator('.context-view').filter({ visible: true });
	await menu.getByText(name, { exact: true }).click();
	await workbench.getByRole('button', { name, exact: true }).waitFor({ state: 'visible' });
}

async function openSection(name: 'Agents' | 'Plugins') {
	await workbench.bringToFront();
	await workbench.locator('.monaco-workbench').click({
		force: true,
		position: { x: 800, y: 700 },
	});
	await runCommand(workbench, 'Chat: Open Customizations');
	const modal = workbench.locator('.monaco-modal-editor-block').filter({ visible: true });
	await modal.waitFor({ state: 'visible', timeout: 30_000 });
	await modal.getByRole('listitem', { name: new RegExp(`^${name}(?:,|$)`) }).first().click();
	await modal.getByRole('heading', { name, exact: true }).first().waitFor({ state: 'visible' });
	return modal;
}

try {
	const existingModal = workbench.getByRole('button', { name: /^Close Modal Editor/ }).filter({ visible: true });
	if (await existingModal.count()) {
		await existingModal.click();
	}
	await workbench.getByRole('button', { name: /^Models,/ }).waitFor({
		state: 'visible',
		timeout: 60_000,
	});

	await selectHarness('Copilot');
	const copilotAgents = await openSection('Agents');
	observations.copilotAgentsAfterReload = await visibleTexts(copilotAgents);
	observations.copilotPluginAgentCount = await copilotAgents
		.locator('.item-name')
		.filter({ hasText: 'plugin-agent' })
		.count();
	await screenshot('04-copilot-agents-after-reload');
	await copilotAgents.getByRole('button', { name: /^Close Modal Editor/ }).click();

	const agentPicker = workbench.getByRole('button', { name: 'Agent', exact: true });
	await agentPicker.click();
	const chatMenu = workbench.locator('.context-view').filter({ visible: true });
	await chatMenu.waitFor({ state: 'visible' });
	observations.copilotChatAfterReload = await visibleTexts(chatMenu.locator('.monaco-list-row'));
	await screenshot('05-copilot-chat-after-reload');
	await workbench.keyboard.press('Escape');

	await selectHarness('Local');
	const localAgents = await openSection('Agents');
	observations.localAgentsAfterReload = await visibleTexts(localAgents);
	const pluginGroup = localAgents
		.getByRole('heading', { name: 'Plugins', exact: true })
		.locator('xpath=ancestor::div[.//*[contains(@class, "item-name")]][1]');
	const pluginAgent = pluginGroup.getByText('plugin-agent', { exact: true });
	await pluginAgent.waitFor({ state: 'visible', timeout: 30_000 });
	await pluginAgent.click();
	const editor = workbench.locator('.monaco-modal-editor-block .monaco-editor').filter({ visible: true });
	await editor.waitFor({ state: 'visible' });
	observations.localPluginEditor = await editor.evaluate(element => ({
		className: element.className,
		resourceUri: element.getAttribute('data-uri'),
		textareas: [...element.querySelectorAll('textarea')].map(textarea => ({
			ariaReadOnly: textarea.getAttribute('aria-readonly'),
			readOnly: textarea.readOnly,
		})),
		contentEditables: [...element.querySelectorAll('[contenteditable]')].map(editable => ({
			contentEditable: editable.getAttribute('contenteditable'),
			role: editable.getAttribute('role'),
		})),
	}));
	await screenshot('06-local-plugin-agent-read-only');
	await localAgents.getByRole('button', { name: /^Close Modal Editor/ }).click();

	const plugins = await openSection('Plugins');
	const row = plugins
		.getByText('tpi-agent-plugin', { exact: true })
		.locator('xpath=ancestor::div[.//*[@role="checkbox" or @role="switch"]][1]');
	await row.waitFor({ state: 'visible', timeout: 30_000 });
	const toggle = row.getByRole('checkbox').or(row.getByRole('switch')).first();
	observations.cleanupToggleBefore = await toggle.getAttribute('aria-checked');
	if (observations.cleanupToggleBefore === 'true') {
		await toggle.click();
		await waitForObserved(
			'tpi-agent-plugin toggle to become disabled',
			() => toggle.getAttribute('aria-checked'),
			{ accept: value => value === 'false' },
		);
	}
	observations.cleanupToggleAfter = await toggle.getAttribute('aria-checked');
	await screenshot('07-test-plugin-disabled');
	await plugins.getByRole('button', { name: /^Close Modal Editor/ }).click();
} finally {
	await writeFile(
		join(rootDir, 'post-reload-observations.json'),
		`${JSON.stringify(observations, undefined, 2)}\n`,
	);
	await evidence.write(join(rootDir, 'post-reload-console.json'));
	await browser.close();
}
