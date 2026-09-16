import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Locator, Page } from 'playwright';
import {
	connectToWorkbench,
	EvidenceRecorder,
	parseTimestamp,
	readRequiredEnvironment,
	reacquireWorkbench,
	runCommand,
	runStep,
	waitForObserved,
	writeRunTiming,
} from '../../.github/skills/tpi-test/playwright-workbench-utils.mts';

const rootDir = readRequiredEnvironment('TEST_ROOT_DIR');
const endpoint = readRequiredEnvironment('VSCODE_CDP_ENDPOINT');
const orchestrationStartedAt = parseTimestamp(
	readRequiredEnvironment('ORCHESTRATION_STARTED_AT'),
	'orchestration start',
);
const workspaceDir = join(rootDir, 'workspace');
const agentsDir = join(workspaceDir, '.github', 'agents');
const screenshotsDir = join(rootDir, 'screenshots');
const automationStartedAt = new Date();
const evidence = new EvidenceRecorder();
const observations: Record<string, unknown> = {};

function namesFromLabels(labels: string[]): string[] {
	return labels
		.map(label => label.split(/[.,]/, 1)[0].trim())
		.filter(Boolean)
		.sort();
}

async function visibleLabels(locator: Locator): Promise<string[]> {
	const elements = await locator.all();
	const values = await Promise.all(elements.map(async element => {
		if (!await element.isVisible().catch(() => false)) {
			return undefined;
		}
		return await element.getAttribute('aria-label')
			?? await element.innerText().catch(() => '');
	}));
	return values.filter((value): value is string => !!value?.trim());
}

async function waitForNames(
	description: string,
	locator: Locator,
	expected: string[],
	options: { absent?: string[]; allowAdditional?: boolean } = {},
): Promise<string[]> {
	const sortedExpected = [...expected].sort();
	return waitForObserved(
		description,
		async () => namesFromLabels(await visibleLabels(locator)),
		{
			accept: actual => {
				const unique = new Set(actual);
				if (unique.size !== actual.length) {
					return false;
				}
				if (sortedExpected.some(name => !unique.has(name))) {
					return false;
				}
				if (options.absent?.some(name => unique.has(name))) {
					return false;
				}
				return options.allowAdditional
					|| (
						actual.length === sortedExpected.length
						&& actual.every((value, index) => value === sortedExpected[index])
					);
			},
			describe: actual => `visible names: ${JSON.stringify(actual)}`,
			timeoutMs: 60_000,
		},
	);
}

async function screenshot(workbench: Page, name: string): Promise<void> {
	await workbench.screenshot({
		path: join(screenshotsDir, `${name}.png`),
		fullPage: true,
	});
}

async function selectCopilotHarness(workbench: Page): Promise<void> {
	const currentCopilot = workbench.getByRole('button', { name: 'Copilot', exact: true });
	if (await currentCopilot.isVisible().catch(() => false)) {
		return;
	}
	const currentHarness = workbench.getByRole('button', {
		name: /^(Local|Cloud|Claude|Codex)$/,
	}).filter({ visible: true });
	await currentHarness.first().click();
	await workbench.getByRole('menuitemcheckbox', { name: /^Copilot,/ }).click();
	await currentCopilot.waitFor({ state: 'visible', timeout: 30_000 });
}

async function openAgentsCustomizations(workbench: Page): Promise<Locator> {
	const closeModal = workbench.getByRole('button', { name: /^Close Modal Editor/ });
	if (await closeModal.isVisible().catch(() => false)) {
		await closeModal.click();
	}
	await workbench.getByRole('button', { name: 'Open Customizations', exact: true }).click();
	const openAgents = workbench.getByRole('button', { name: 'Open Agents', exact: true });
	const workspaceList = workbench.getByRole('list', { name: 'Workspace', exact: true });
	await waitForObserved(
		'the Agents customization entry point or Workspace list',
		async () => ({
			openAgents: await openAgents.isVisible().catch(() => false),
			workspace: await workspaceList.isVisible().catch(() => false),
		}),
		{
			accept: state => state.openAgents || state.workspace,
			describe: state => JSON.stringify(state),
			timeoutMs: 30_000,
		},
	);
	if (await openAgents.isVisible().catch(() => false)) {
		await openAgents.click();
	}
	await workspaceList.waitFor({ state: 'visible', timeout: 30_000 });
	return workspaceList;
}

async function closeCustomizations(workbench: Page): Promise<void> {
	const closeModal = workbench.getByRole('button', { name: /^Close Modal Editor/ });
	if (await closeModal.isVisible().catch(() => false)) {
		await closeModal.click();
	}
}

async function openAgentDropdown(workbench: Page): Promise<Locator> {
	const selectorButton = workbench.getByRole('button', {
		name: /^(Agent|agent-one|agent-two|agent-two-new|agent-three)$/,
	}).filter({ visible: true });
	await selectorButton.last().click();
	const menuItems = workbench.getByRole('menuitemcheckbox');
	await menuItems.first().waitFor({ state: 'visible', timeout: 30_000 });
	return menuItems;
}

async function waitForDropdownNames(
	workbench: Page,
	expected: string[],
): Promise<string[]> {
	const menuItems = await openAgentDropdown(workbench);
	const customItems = menuItems.filter({
		hasNot: workbench.locator('[aria-label^="Agent,"]'),
	});
	const actual = await waitForObserved(
		'the Chat custom-agent dropdown inventory',
		async () => {
			const labels = await visibleLabels(menuItems);
			return labels
				.map(label => label.split(',', 1)[0].trim())
				.filter(name => name !== 'Agent')
				.sort();
		},
		{
			accept: names => {
				const sortedExpected = [...expected].sort();
				return names.length === sortedExpected.length
					&& names.every((name, index) => name === sortedExpected[index]);
			},
			describe: names => `visible custom agents: ${JSON.stringify(names)}`,
			timeoutMs: 60_000,
		},
	);
	void customItems;
	return actual;
}

async function checkBothSurfaces(
	workbench: Page,
	label: string,
	expected: string[],
	options: { absent?: string[]; allowAdditional?: boolean } = {},
): Promise<void> {
	const workspaceList = await openAgentsCustomizations(workbench);
	const customizations = await waitForNames(
		`${label} Customizations inventory`,
		workspaceList.getByRole('listitem'),
		expected,
		options,
	);
	await screenshot(workbench, `${label}-customizations`);
	await closeCustomizations(workbench);
	const dropdown = await waitForDropdownNames(workbench, expected);
	await screenshot(workbench, `${label}-chat-dropdown`);
	await workbench.keyboard.press('Escape');
	observations[label] = { customizations, dropdown };
}

async function readBackingInventory(): Promise<Record<string, string>> {
	const files = (await readdir(agentsDir))
		.filter(name => name.endsWith('.agent.md'))
		.sort();
	const inventory: Record<string, string> = {};
	for (const file of files) {
		const content = await readFile(join(agentsDir, file), 'utf8');
		const match = /^name:\s*(.+)$/m.exec(content);
		inventory[file] = match?.[1].trim() ?? '<missing name>';
	}
	return inventory;
}

async function readAllBackingInventory(): Promise<Record<string, string>> {
	const inventory = await readBackingInventory();
	const legacyAgentsDir = join(workspaceDir, '.custom', 'agents');
	for (const file of (await readdir(legacyAgentsDir)).filter(name => name.endsWith('.agent.md')).sort()) {
		const content = await readFile(join(legacyAgentsDir, file), 'utf8');
		const match = /^name:\s*(.+)$/m.exec(content);
		inventory[join('.custom', 'agents', file)] = match?.[1].trim() ?? '<missing name>';
	}
	return inventory;
}

const { browser, workbench: initialWorkbench } = await connectToWorkbench(endpoint);
let workbench = initialWorkbench;
evidence.attach(workbench);

try {
	await runStep('Verify baseline and initial inventories', workbench, screenshotsDir, async () => {
		await access(join(workspaceDir, 'README.md'));
		observations.initialFiles = await readBackingInventory();
		await selectCopilotHarness(workbench);
		await checkBothSurfaces(workbench, '01-initial', ['agent-one', 'agent-two']);
	});

	await runStep('Rename agent-two', workbench, screenshotsDir, async () => {
		const workspaceList = await openAgentsCustomizations(workbench);
		await workspaceList.getByRole('listitem', { name: /^agent-two\./ }).click();
		const editor = workbench.getByRole('dialog', { name: 'Agent Customizations' })
			.getByRole('textbox', { name: /editor is not accessible/i });
		await editor.focus();
		await workbench.keyboard.press('Control+Home');
		await workbench.keyboard.press('ArrowDown');
		await workbench.keyboard.press('Home');
		await workbench.keyboard.press('Shift+End');
		await workbench.keyboard.insertText('name: agent-two-new');
		await workbench.keyboard.press('Control+s');
		await waitForObserved(
			'agent-two frontmatter rename to be saved',
			() => readFile(join(agentsDir, 'agent-two.agent.md'), 'utf8'),
			{
				accept: content => /^name:\s*agent-two-new$/m.test(content),
				describe: content => content.split(/\r?\n/).slice(0, 3).join(' | '),
				timeoutMs: 30_000,
			},
		);
		await screenshot(workbench, '02-renamed-agent-editor');
		await workbench.getByRole('button', { name: 'Back to list', exact: true }).click();
		await closeCustomizations(workbench);
		await checkBothSurfaces(workbench, '02-after-rename', ['agent-one', 'agent-two-new']);
		observations.afterRenameFiles = await readBackingInventory();
	});

	await runStep('Create agent-three', workbench, screenshotsDir, async () => {
		await openAgentsCustomizations(workbench);
		await workbench.getByRole('button', { name: 'New Agent', exact: true }).first().click();
		await workbench.getByRole('option', { name: /agents, \.github\\agents/ }).click();
		const nameInput = workbench.getByRole('textbox', { name: 'Enter the name of the agent file' });
		await nameInput.fill('agent-three');
		await nameInput.press('Enter');
		await waitForObserved(
			'agent-three backing file to be created',
			async () => {
				try {
					return await readFile(join(agentsDir, 'agent-three.agent.md'), 'utf8');
				} catch {
					return '';
				}
			},
			{
				accept: content => /^name:\s*agent-three$/m.test(content),
				describe: content => content
					? content.split(/\r?\n/).slice(0, 3).join(' | ')
					: 'file not present',
				timeoutMs: 30_000,
			},
		);
		const back = workbench.getByRole('button', { name: 'Back to list', exact: true });
		if (await back.isVisible().catch(() => false)) {
			await back.click();
		}
		await closeCustomizations(workbench);
		await checkBothSurfaces(
			workbench,
			'03-after-create',
			['agent-one', 'agent-two-new', 'agent-three'],
		);
		observations.afterCreateFiles = await readBackingInventory();
	});

	await runStep('Delete agent-one', workbench, screenshotsDir, async () => {
		await openAgentsCustomizations(workbench);
		await workbench.getByRole('button', { name: 'More actions for agent-one', exact: true }).click();
		await workbench.keyboard.press('ArrowDown');
		await workbench.keyboard.press('ArrowDown');
		await workbench.keyboard.press('ArrowDown');
		await workbench.keyboard.press('Enter');
		await workbench.keyboard.press('Enter');
		await waitForObserved(
			'agent-one backing file to be deleted',
			async () => {
				try {
					await access(join(agentsDir, 'agent-one.agent.md'));
					return true;
				} catch {
					return false;
				}
			},
			{
				accept: exists => !exists,
				describe: exists => exists ? 'file still exists' : 'file absent',
				timeoutMs: 30_000,
			},
		);
		await closeCustomizations(workbench);
		await checkBothSurfaces(workbench, '04-after-delete', ['agent-two-new', 'agent-three']);
		observations.afterDeleteFiles = await readBackingInventory();
	});

	await runStep('Reload and verify final inventories', workbench, screenshotsDir, async () => {
		await closeCustomizations(workbench);
		await runCommand(workbench, 'Developer: Reload Window');
		workbench = await reacquireWorkbench(browser);
		evidence.attach(workbench);
		await selectCopilotHarness(workbench);
		await checkBothSurfaces(
			workbench,
			'05-post-reload',
			['agent-two-new', 'agent-three'],
			{
				absent: ['agent-one', 'agent-two'],
				allowAdditional: true,
			},
		);
		observations.postReloadFiles = await readBackingInventory();
	});

	await runStep('Resolve surviving agents to backing files', workbench, screenshotsDir, async () => {
		for (const agentName of ['agent-two-new', 'agent-three']) {
			await openAgentDropdown(workbench);
			await workbench.getByRole('menuitemcheckbox', {
				name: new RegExp(`^${agentName},`),
			}).click();
			const workspaceList = await openAgentsCustomizations(workbench);
			await workspaceList.getByRole('listitem', { name: new RegExp(`^${agentName}\\.`) }).click();
			const expectedFile = agentName === 'agent-two-new'
				? 'agent-two.agent.md'
				: 'agent-three.agent.md';
			await workbench.getByText(expectedFile, { exact: true }).waitFor({
				state: 'visible',
				timeout: 30_000,
			});
			await screenshot(workbench, `06-resolved-${agentName}`);
			await closeCustomizations(workbench);
		}
	});

	await runStep('Ask Copilot for available agents', workbench, screenshotsDir, async () => {
		await openAgentDropdown(workbench);
		const builtInAgent = workbench.getByRole('menuitemcheckbox', { name: /^Agent,/ });
		await builtInAgent.dispatchEvent('click');
		observations.executionDeviations = [
			'Dispatched a DOM click on the virtualized built-in Agent row because pointer and keyboard activation detached or left the menu overlay open.',
		];
		const chatInput = workbench.locator('.interactive-input-part [role="textbox"]')
			.filter({ visible: true })
			.last();
		await chatInput.focus();
		await workbench.keyboard.insertText('What agents can you use');
		await workbench.getByRole('button', { name: /^Send / }).click();
		const responses = workbench.locator('.interactive-response').filter({ visible: true });
		const response = await waitForObserved(
			'a completed non-empty Copilot response',
			async () => {
				const count = await responses.count();
				const text = count ? await responses.nth(count - 1).innerText().catch(() => '') : '';
				const stopVisible = await workbench.getByRole('button', { name: /^Stop/ })
					.isVisible()
					.catch(() => false);
				return { stopVisible, text: text.trim() };
			},
			{
				accept: value =>
					!value.stopVisible
					&& value.text.length > 0
					&& value.text !== 'Working',
				describe: value =>
					`stopVisible=${value.stopVisible}, response=${JSON.stringify(value.text.slice(0, 500))}`,
				timeoutMs: 180_000,
			},
		);
		observations.prompt = 'What agents can you use';
		observations.response = response.text;
		observations.finalComparison = {
			backingFiles: await readAllBackingInventory(),
			customizations: (observations['05-post-reload'] as { customizations: string[] }).customizations,
			dropdown: (observations['05-post-reload'] as { dropdown: string[] }).dropdown,
		};
		await screenshot(workbench, '07-copilot-agent-inventory-response');
	});
} finally {
	await evidence.write(join(rootDir, 'console.json'));
	await writeFile(
		join(rootDir, 'observations.json'),
		`${JSON.stringify(observations, undefined, 2)}\n`,
	);
	await writeRunTiming(
		join(rootDir, 'timing.json'),
		orchestrationStartedAt,
		automationStartedAt,
	);
	await browser.close();
}
