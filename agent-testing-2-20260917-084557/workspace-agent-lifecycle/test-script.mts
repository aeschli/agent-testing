import { access, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	connectToWorkbench,
	EvidenceRecorder,
	parseTimestamp,
	readRequiredEnvironment,
	runStep,
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
const agentsDir = join(workspaceDir, '.github', 'agents');
const deleteConfirmationSignal = join(rootDir, 'confirm-delete.signal');
const evidence = new EvidenceRecorder();
const observations: string[] = [];
const { browser, workbench } = await connectToWorkbench(endpoint);
evidence.attach(workbench);

async function screenshot(name: string): Promise<void> {
	await mkdir(screenshotsDir, { recursive: true });
	await workbench.screenshot({ path: join(screenshotsDir, `${name}.png`), fullPage: true });
}

async function openCustomizationsAgents(): Promise<Locator> {
	await workbench.keyboard.press('Control+Shift+P');
	const commandPalette = workbench.locator('.quick-input-widget').filter({ visible: true });
	await commandPalette.waitFor({ state: 'visible' });
	await commandPalette.getByRole('textbox').fill('>Chat: Open Customizations');
	const command = commandPalette.getByRole('option')
		.filter({ hasText: /^Chat: Open Customizations/ })
		.first();
	await command.waitFor({ state: 'visible' });
	await command.click();
	await commandPalette.waitFor({ state: 'hidden' });
	const heading = workbench.getByText(/Agent Customizations\(Copilot .* workspace\)/).filter({ visible: true });
	await heading.waitFor({ state: 'visible', timeout: 30_000 });
	const openAgents = workbench.getByRole('button', { name: 'Open Agents', exact: true }).filter({ visible: true });
	if (await openAgents.count()) {
		await openAgents.click();
	}
	const agentList = workbench.locator('.ai-customization-list-item').filter({ visible: true });
	await agentList.first().waitFor({ state: 'visible', timeout: 30_000 });
	return agentList.locator('.item-name');
}

async function closeCustomizations(): Promise<void> {
	const close = workbench.getByRole('button', { name: /Close Modal Editor/ }).filter({ visible: true });
	if (await close.count()) {
		await close.click();
	}
}

async function visibleChatAgents(): Promise<string[]> {
	const picker = workbench.getByRole('button', { name: 'Agent', exact: true }).filter({ visible: true });
	await picker.click();
	const menu = workbench.locator('.context-view').filter({ visible: true });
	await menu.waitFor({ state: 'visible' });
	const agents = menu.getByRole('menuitemcheckbox').filter({ hasText: /^agent-/ });
	const names = await visibleTexts(agents);
	await workbench.keyboard.press('Escape');
	return names;
}

async function waitForChatAgents(expected: string[]): Promise<void> {
	await waitForObserved(
		`Chat agent inventory ${JSON.stringify(expected)}`,
		visibleChatAgents,
		{
			accept: names => {
				const actual = [...names].sort();
				const wanted = [...expected].sort();
				return actual.length === wanted.length
					&& actual.every((name, index) => name === wanted[index]);
			},
			describe: names => `visible Chat agents: ${JSON.stringify(names)}`,
			timeoutMs: 30_000,
		},
	);
}

async function replaceActiveEditor(text: string): Promise<void> {
	const editor = workbench.locator('.editor-instance .monaco-editor').filter({ visible: true }).last();
	await editor.locator('.view-lines').click();
	await workbench.keyboard.press('Control+A');
	await workbench.keyboard.insertText(text);
	await workbench.keyboard.press('Control+S');
}

try {
	await runStep('Open root README', workbench, screenshotsDir, async () => {
		const readme = workbench.locator('.part.sidebar').getByText('README.md', { exact: true }).filter({ visible: true });
		await readme.dblclick();
		await workbench.getByText(/^# VS Code Customization Migration Test$/).filter({ visible: true })
			.waitFor({ state: 'visible', timeout: 30_000 });
		observations.push('Root README.md opened successfully.');
		await screenshot('01-readme-open');
	});

	await runStep('Select Copilot in Chat', workbench, screenshotsDir, async () => {
		const local = workbench.getByRole('button', { name: 'Local', exact: true }).filter({ visible: true });
		await local.click();
		const menu = workbench.locator('.context-view').filter({ visible: true });
		await menu.waitFor({ state: 'visible' });
		await menu.getByText('Copilot', { exact: true }).click();
		await workbench.getByText('Chat with Copilot', { exact: true }).filter({ visible: true })
			.waitFor({ state: 'visible', timeout: 30_000 });
		observations.push('Chat harness explicitly changed from Local to Copilot.');
		await screenshot('02-chat-copilot-selected');
	});

	await runStep('Verify initial workspace agents', workbench, screenshotsDir, async () => {
		const names = await openCustomizationsAgents();
		await waitForInventory(names, { exact: ['agent-one', 'agent-two'] });
		observations.push('Copilot Customizations showed exactly agent-one and agent-two in Workspace.');
		await screenshot('03-customizations-initial-agents');
	});

	await runStep('Rename agent-two', workbench, screenshotsDir, async () => {
		await workbench.getByText('agent-two', { exact: true }).filter({ visible: true }).click();
		const original = await readFile(join(agentsDir, 'agent-two.agent.md'), 'utf8');
		const updated = original.replace('name: agent-two', 'name: agent-two-new');
		if (updated === original) {
			throw new Error('Could not find the agent-two frontmatter name.');
		}
		await replaceActiveEditor(updated);
		await waitForObserved(
			'agent-two backing file to contain the renamed frontmatter',
			() => readFile(join(agentsDir, 'agent-two.agent.md'), 'utf8'),
			{
				accept: value => value.includes('name: agent-two-new') && !value.includes('name: agent-two\n'),
				timeoutMs: 15_000,
			},
		);
		await closeCustomizations();
		const names = await openCustomizationsAgents();
		await waitForInventory(names, { exact: ['agent-one', 'agent-two-new'] });
		observations.push('Renaming only the frontmatter name replaced agent-two with agent-two-new in Customizations.');
		await screenshot('04-customizations-after-rename');
		await closeCustomizations();
		await waitForChatAgents(['agent-one', 'agent-two-new']);
		observations.push('Chat agent picker replaced agent-two with agent-two-new without duplicates.');
		await workbench.getByRole('button', { name: 'Agent', exact: true }).filter({ visible: true }).click();
		await screenshot('05-chat-after-rename');
		await workbench.keyboard.press('Escape');
	});

	await runStep('Create agent-three', workbench, screenshotsDir, async () => {
		await openCustomizationsAgents();
		await workbench.getByRole('button', { name: 'New Agent', exact: true }).filter({ visible: true }).first().click();
		const locationPicker = workbench.locator('.quick-input-widget').filter({ visible: true });
		await locationPicker.waitFor({ state: 'visible' });
		await locationPicker.getByRole('option').filter({ hasText: '.github\\agents' }).click();
		const namePicker = workbench.locator('.quick-input-widget').filter({ visible: true });
		const nameInput = namePicker.getByRole('textbox', { name: 'Enter the name of the agent file' });
		await nameInput.waitFor({ state: 'visible' });
		await nameInput.fill('agent-three');
		await nameInput.press('Enter');
		await namePicker.waitFor({ state: 'hidden' });
		await workbench.getByText('agent-three.agent.md', { exact: true }).filter({ visible: true })
			.first()
			.waitFor({ state: 'visible', timeout: 30_000 });
		await workbench.keyboard.press('Control+S');
		await waitForObserved(
			'agent-three backing file with valid frontmatter',
			async () => {
				try {
					const content = await readFile(join(agentsDir, 'agent-three.agent.md'), 'utf8');
					return /^---\r?\nname: agent-three\r?\n[\s\S]*\r?\n---/m.test(content);
				} catch {
					return false;
				}
			},
			{ accept: value => value, timeoutMs: 15_000 },
		);
		await closeCustomizations();
		const names = await openCustomizationsAgents();
		await waitForInventory(names, { exact: ['agent-one', 'agent-two-new', 'agent-three'] });
		observations.push('Created agent-three with valid frontmatter; Customizations showed it exactly once.');
		await screenshot('06-customizations-after-create');
		await closeCustomizations();
		await waitForChatAgents(['agent-one', 'agent-two-new', 'agent-three']);
		observations.push('Chat agent picker showed agent-three exactly once.');
		await workbench.getByRole('button', { name: 'Agent', exact: true }).filter({ visible: true }).click();
		await screenshot('07-chat-after-create');
		await workbench.keyboard.press('Escape');
	});

	await runStep('Delete agent-one', workbench, screenshotsDir, async () => {
		const names = await openCustomizationsAgents();
		await waitForInventory(names, { exact: ['agent-one', 'agent-two-new', 'agent-three'] });
		await closeCustomizations();
		const explorer = workbench.locator('.explorer-viewlet');
		for (const folderName of ['.github', 'agents']) {
			const folder = explorer.getByRole('treeitem', { name: folderName, exact: true });
			await folder.waitFor({ state: 'visible' });
			if (await folder.getAttribute('aria-expanded') === 'false') {
				await folder.locator('.monaco-tl-twistie').click();
			}
		}
		const agentOneFile = explorer.getByRole('treeitem', { name: 'agent-one.agent.md', exact: true });
		await agentOneFile.waitFor({ state: 'visible' });
		await agentOneFile.click();
		await agentOneFile.focus();
		console.log('WAITING_FOR_DELETE_CONFIRMATION_SIGNAL');
		await waitForObserved(
			'the external confirmation signal',
			async () => {
				try {
					await access(deleteConfirmationSignal);
					return true;
				} catch {
					return false;
				}
			},
			{ accept: value => value, timeoutMs: 180_000 },
		);
		await workbench.keyboard.press('Delete');
		await waitForObserved(
			'agent-one backing file to be deleted',
			async () => {
				try {
					await access(join(agentsDir, 'agent-one.agent.md'));
					return false;
				} catch {
					return true;
				}
			},
			{ accept: value => value, timeoutMs: 120_000 },
		);
		observations.push('Accepted the Explorer deletion confirmation to move agent-one.agent.md to the Recycle Bin.');
		const namesAfterDelete = await openCustomizationsAgents();
		await waitForInventory(namesAfterDelete, { exact: ['agent-two-new', 'agent-three'] });
		observations.push('agent-one backing file was deleted and Customizations retained only the other two agents.');
		await screenshot('08-customizations-after-delete');
		await closeCustomizations();
		await waitForChatAgents(['agent-two-new', 'agent-three']);
		observations.push('Chat agent picker removed agent-one and retained exactly agent-two-new and agent-three.');
		await workbench.getByRole('button', { name: 'Agent', exact: true }).filter({ visible: true }).click();
		await screenshot('09-chat-after-delete');
		await workbench.keyboard.press('Escape');
	});
} finally {
	await evidence.write(join(rootDir, 'console.json'));
	await mkdir(rootDir, { recursive: true });
	await import('node:fs/promises').then(({ writeFile }) =>
		writeFile(join(rootDir, 'observations.json'), `${JSON.stringify(observations, undefined, 2)}\n`),
	);
	await writeRunTiming(
		join(rootDir, 'timing.json'),
		orchestrationStartedAt,
		automationStartedAt,
	);
	await browser.close();
}
