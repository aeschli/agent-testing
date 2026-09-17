import assert from 'node:assert/strict';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import {
	connectToWorkbench,
	EvidenceRecorder,
	parseTimestamp,
	readRequiredEnvironment,
	reacquireWorkbench,
	runCommand,
	runStep,
	visibleElementCount,
	visibleTexts,
	waitForInventory,
	waitForObserved,
	writeRunTiming,
} from '../../.github/skills/tpi-test/playwright-workbench-utils.mts';
import type { Locator, Page } from 'playwright';

const rootDir = readRequiredEnvironment('TEST_ROOT_DIR');
const endpoint = readRequiredEnvironment('VSCODE_CDP_ENDPOINT');
const orchestrationStartedAt = parseTimestamp(
	readRequiredEnvironment('ORCHESTRATION_STARTED_AT'),
	'orchestration start',
);
const automationStartedAt = new Date();
const screenshotsDir = join(rootDir, 'screenshots');
const workspaceDir = join(rootDir, 'workspace');
const workspaceAgentPath = join(workspaceDir, '.github', 'agents', 'plugin-agent.agent.md');
const generatedPluginPath = join(workspaceDir, 'tpi-agent-plugin');
const generatedPluginJsonPath = join(generatedPluginPath, 'plugin.json');
const generatedPluginAgentPath = join(
	generatedPluginPath,
	'com.github.copilot',
	'agents',
	'plugin-agent.agent.md',
);
const evidence = new EvidenceRecorder();
const observations: Record<string, unknown> = {};
const { browser, workbench: initialWorkbench } = await connectToWorkbench(endpoint);
let workbench = initialWorkbench;
evidence.attach(workbench);

async function screenshot(name: string): Promise<void> {
	await mkdir(screenshotsDir, { recursive: true });
	const path = join(screenshotsDir, `${name}.png`);
	try {
		await workbench.screenshot({ path, fullPage: true, timeout: 30_000 });
	} catch {
		await workbench.screenshot({ path, fullPage: true, timeout: 30_000 });
	}
}

async function closeTransientUi(): Promise<void> {
	const picker = workbench.locator('.quick-input-widget').filter({ visible: true });
	if (await picker.count()) {
		await workbench.keyboard.press('Escape');
	}
	const closeModal = workbench.getByRole('button', { name: /^Close Modal Editor/ }).filter({ visible: true });
	if (await closeModal.count()) {
		await closeModal.click();
	}
}

async function selectHarness(name: 'Copilot' | 'Local'): Promise<void> {
	const selected = workbench.getByRole('button', { name, exact: true }).filter({ visible: true });
	if (await selected.count()) {
		return;
	}
	const currentName = name === 'Copilot' ? 'Local' : 'Copilot';
	await workbench.getByRole('button', { name: currentName, exact: true }).filter({ visible: true }).click();
	const menu = workbench.locator('.context-view').filter({ visible: true });
	await menu.waitFor({ state: 'visible', timeout: 30_000 });
	await menu.getByText(name, { exact: true }).click();
	await workbench.getByRole('button', { name, exact: true }).waitFor({
		state: 'visible',
		timeout: 30_000,
	});
}

async function openCustomizationsSection(section: 'Agents' | 'Plugins'): Promise<Locator> {
	await workbench.getByRole('button', { name: 'Open Customizations' }).click();
	const modal = workbench.locator('.monaco-modal-editor-block').filter({ visible: true });
	await modal.waitFor({ state: 'visible', timeout: 30_000 });
	const item = modal.getByRole('listitem', { name: new RegExp(`^${section}(?:,|$)`) }).first();
	await item.click();
	await modal.getByRole('heading', { name: section, exact: true }).first().waitFor({
		state: 'visible',
		timeout: 30_000,
	});
	return modal;
}

function customizationGroup(modal: Locator, name: 'Plugins' | 'Workspace'): Locator {
	return modal
		.getByRole('heading', { name, exact: true })
		.locator('xpath=ancestor::div[.//*[contains(@class, "item-name")]][1]');
}

async function reloadWorkbench(): Promise<void> {
	await runCommand(workbench, 'Developer: Reload Window');
	workbench = await reacquireWorkbench(browser);
	evidence.attach(workbench);
	await workbench.waitForLoadState('load', { timeout: 60_000 });
	await workbench.getByRole('button', { name: /^Models,/ }).waitFor({
		state: 'visible',
		timeout: 60_000,
	});
	await workbench.getByRole('button', { name: 'Copilot status' }).waitFor({
		state: 'visible',
		timeout: 30_000,
	});
}

async function createPluginFromAgent(): Promise<void> {
	await workbench.keyboard.press('Control+Shift+P');
	const commandPalette = workbench.locator('.quick-input-widget').filter({ visible: true });
	await commandPalette.getByRole('textbox').fill('>Create Plugin');
	await commandPalette.getByRole('option').filter({ hasText: /Create Plugin/ }).first().click();

	const contentPicker = workbench.locator('.quick-input-widget').filter({ visible: true });
	const agentLabel = contentPicker.getByText('plugin-agent.agent.md', { exact: true }).filter({ visible: true });
	await agentLabel.waitFor({ state: 'visible', timeout: 30_000 });
	const agentEntry = agentLabel.locator(
		'xpath=ancestor::div[contains(@class, "quick-input-tree-entry")]',
	);
	await agentEntry.getByRole('checkbox').click();
	await waitForObserved(
		'one plugin customization to be selected',
		() => visibleTexts(contentPicker),
		{ accept: values => values.some(value => value.includes('1 Selected')) },
	);
	await screenshot('02-create-plugin-agent-selected');
	await contentPicker.getByRole('button', { name: 'OK', exact: true }).click();

	const formatPicker = workbench.locator('.quick-input-widget').filter({ visible: true });
	await formatPicker.getByRole('option').filter({ hasText: /^Agent Plugin/ }).click();

	const namePicker = workbench.locator('.quick-input-widget').filter({ visible: true });
	const nameInput = namePicker.getByRole('textbox');
	await nameInput.fill('tpi-agent-plugin');
	await nameInput.press('Enter');

	const saveUi = workbench.locator('.quick-input-widget').filter({ visible: true });
	const folderInput = saveUi.getByRole('textbox', { name: 'Folder path - Select Plugin Save Location' });
	await folderInput.waitFor({ state: 'visible', timeout: 30_000 });
	await folderInput.fill(workspaceDir);
	await folderInput.press('Enter');
	await saveUi.waitFor({ state: 'hidden', timeout: 30_000 });
}

async function installPluginFromSource(): Promise<Locator> {
	await selectHarness('Local');
	const modal = await openCustomizationsSection('Plugins');
	await modal.getByRole('listitem', { name: 'Plugins', exact: true }).click();
	const installFromSource = workbench.getByText('Install from Source', { exact: true }).filter({ visible: true });
	await installFromSource.waitFor({ state: 'visible', timeout: 60_000 });
	await installFromSource.click();
	const folderPicker = workbench.locator('.quick-input-widget').filter({ visible: true });
	const folderInput = folderPicker.getByRole('textbox', {
		name: 'owner/repo, git URL, or local folder path',
	});
	await folderInput.waitFor({ state: 'visible', timeout: 30_000 });
	await folderInput.fill(generatedPluginPath);
	await folderInput.press('Enter');
	await folderPicker.waitFor({ state: 'hidden', timeout: 30_000 });
	await waitForObserved(
		'tpi-agent-plugin to appear in Installed plugins',
		() => visibleTexts(modal),
		{
			accept: values => values.some(value => value.includes('tpi-agent-plugin')),
			describe: values => `visible plugin page: ${JSON.stringify(values)}`,
			timeoutMs: 60_000,
		},
	);
	return modal;
}

try {
	await runStep('Reset and create workspace agent fixture', workbench, screenshotsDir, async () => {
		await closeTransientUi();
		await assert.rejects(() => access(workspaceAgentPath), { code: 'ENOENT' });
		await assert.rejects(() => access(generatedPluginPath), { code: 'ENOENT' });
		await mkdir(join(workspaceDir, '.github', 'agents'), { recursive: true });
		const agentSource = [
			'---',
			'name: plugin-agent',
			'description: Agent plugin discovery test fixture',
			'---',
			'',
			'You are the plugin-agent test agent.',
			'',
		].join('\n');
		await writeFile(workspaceAgentPath, agentSource, { encoding: 'utf8', flag: 'wx' });
		observations.workspaceAgentSource = agentSource;
		await selectHarness('Copilot');
		const modal = await openCustomizationsSection('Agents');
		const workspaceGroup = customizationGroup(modal, 'Workspace');
		await waitForInventory(workspaceGroup.locator('.item-name'), { exact: ['plugin-agent'] }, 60_000);
		observations.workspaceAgentCreated = true;
		await screenshot('01-workspace-agent-copilot');
		await modal.getByRole('button', { name: /^Close Modal Editor/ }).click();
	});

	await runStep('Generate standard Agent Plugin', workbench, screenshotsDir, async () => {
		await selectHarness('Local');
		await createPluginFromAgent();
		const pluginJson = JSON.parse(await waitForObserved(
			'generated Agent Plugins 1.0 manifest',
			() => readFile(generatedPluginJsonPath, 'utf8'),
			{ accept: value => value.includes('agent-plugins.org/schemas/1.0.0/plugin.schema.json') },
		)) as Record<string, unknown>;
		assert.deepEqual(pluginJson, {
			$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
			name: 'tpi-agent-plugin',
			version: '1.0.0',
			description: '',
		});
		const sourceAgent = await readFile(workspaceAgentPath, 'utf8');
		const pluginAgent = await readFile(generatedPluginAgentPath, 'utf8');
		assert.equal(pluginAgent, sourceAgent, 'Generated plugin agent must exactly copy the selected agent.');
		observations.generatedStructure = {
			pluginJson,
			pluginAgentRelativePath: 'com.github.copilot/agents/plugin-agent.agent.md',
			sourceMatchesExactly: true,
		};
	});

	await runStep('Install plugin in isolated profile', workbench, screenshotsDir, async () => {
		const modal = await installPluginFromSource();
		observations.installedPluginsPage = await visibleTexts(modal);
		await screenshot('03-plugin-installed-isolated-profile');
		await modal.getByRole('button', { name: /^Close Modal Editor/ }).click();
	});

	await runStep('Verify Copilot plugin and workspace sources', workbench, screenshotsDir, async () => {
		await selectHarness('Copilot');
		const modal = await openCustomizationsSection('Agents');
		const workspaceGroup = customizationGroup(modal, 'Workspace');
		const pluginGroup = customizationGroup(modal, 'Plugins');
		await waitForInventory(workspaceGroup.locator('.item-name'), { exact: ['plugin-agent'] }, 60_000);
		await waitForInventory(pluginGroup.locator('.item-name'), { exact: ['plugin-agent'] }, 60_000);
		observations.agentSources = {
			workspace: await visibleTexts(workspaceGroup.locator('.ai-customization-list-item')),
			plugins: await visibleTexts(pluginGroup.locator('.ai-customization-list-item')),
		};
		await screenshot('04-copilot-agent-sources');

		await pluginGroup.getByText('plugin-agent', { exact: true }).click();
		const editor = workbench.locator('.monaco-modal-editor-block .monaco-editor').filter({ visible: true });
		await editor.waitFor({ state: 'visible', timeout: 30_000 });
		const resourceUri = await editor.getAttribute('data-uri');
		const inputArea = editor.locator('textarea.inputarea');
		const ariaReadOnly = await inputArea.getAttribute('aria-readonly');
		const contentEditable = await inputArea.getAttribute('contenteditable');
		assert.equal(ariaReadOnly, 'true', 'Plugin agent editor must be read-only.');
		observations.pluginBackingEditor = { resourceUri, ariaReadOnly, contentEditable };
		await screenshot('05-plugin-agent-read-only');
		await modal.getByRole('button', { name: /^Close Modal Editor/ }).click();
	});

	await runStep('Verify Copilot Chat agent dropdown', workbench, screenshotsDir, async () => {
		const agentPicker = workbench.getByRole('button', { name: 'Agent', exact: true });
		await agentPicker.click();
		const menu = workbench.locator('.context-view').filter({ visible: true });
		await menu.waitFor({ state: 'visible', timeout: 30_000 });
		const pluginAgentRows = menu.getByRole('menuitemcheckbox').filter({ hasText: /plugin-agent/ });
		await pluginAgentRows.first().waitFor({ state: 'visible', timeout: 60_000 });
		const rowTexts = await visibleTexts(pluginAgentRows);
		assert.ok(rowTexts.length >= 1, 'Chat agent dropdown must expose plugin-agent.');
		observations.chatPluginAgentRows = rowTexts;
		await screenshot('06-copilot-chat-plugin-agent');
		await workbench.keyboard.press('Escape');
	});

	await runStep('Uninstall or disable only test plugin when supported', workbench, screenshotsDir, async () => {
		await selectHarness('Local');
		const modal = await openCustomizationsSection('Plugins');
		const pluginRow = modal.locator('.ai-customization-list-item').filter({ hasText: 'tpi-agent-plugin' });
		await pluginRow.waitFor({ state: 'visible', timeout: 30_000 });
		const actionLabels = await pluginRow.getByRole('button').evaluateAll(
			buttons => buttons.map(button => button.getAttribute('aria-label') ?? button.textContent?.trim()),
		);
		observations.pluginCleanupActions = actionLabels;
		const directAction = pluginRow.getByRole('button', { name: /Uninstall|Disable/i }).first();
		if (await directAction.count()) {
			await directAction.click();
			observations.pluginCleanup = 'Used visible uninstall/disable action.';
		} else {
			observations.pluginCleanup = 'No supported uninstall or disable action was visible.';
		}
		await modal.getByRole('button', { name: /^Close Modal Editor/ }).click();
	});
} finally {
	await writeFile(
		join(rootDir, 'observations.json'),
		`${JSON.stringify(observations, undefined, 2)}\n`,
	);
	await evidence.write(join(rootDir, 'console.json'));
	await writeRunTiming(
		join(rootDir, 'timing.json'),
		orchestrationStartedAt,
		automationStartedAt,
	);
	await browser.close();
}
