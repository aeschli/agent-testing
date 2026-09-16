import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Locator, Page } from 'playwright';
import {
	connectToWorkbench,
	EvidenceRecorder,
	parseTimestamp,
	readRequiredEnvironment,
	runCommand,
	runStep,
	visibleElementCount,
	visibleTexts,
	waitForObserved,
	writeRunTiming,
} from '../../.github/skills/tpi-test/playwright-workbench-utils.mts';

interface CheckResult {
	actual: unknown;
	expected: string;
	name: string;
	passed: boolean;
	timestamp: string;
}

const rootDir = readRequiredEnvironment('TEST_ROOT_DIR');
const endpoint = readRequiredEnvironment('VSCODE_CDP_ENDPOINT');
const orchestrationStartedAt = parseTimestamp(
	readRequiredEnvironment('ORCHESTRATION_STARTED_AT'),
	'orchestration start',
);
const automationStartedAt = new Date();
const screenshotsDir = join(rootDir, 'screenshots');
const workspaceDir = join(rootDir, 'workspace');
const agentOnePath = join(workspaceDir, '.github', 'agents', 'agent-one.agent.md');
const agentTwoPath = join(workspaceDir, '.github', 'agents', 'agent-two.agent.md');
const agentThreePath = join(workspaceDir, '.github', 'agents', 'agent-three.agent.md');
const checks: CheckResult[] = [];
const notes: string[] = [];
const evidence = new EvidenceRecorder();
const { browser, workbench } = await connectToWorkbench(endpoint);
evidence.attach(workbench);

function recordCheck(name: string, expected: string, actual: unknown, passed: boolean): void {
	checks.push({
		actual,
		expected,
		name,
		passed,
		timestamp: new Date().toISOString(),
	});
}

async function exists(path: string): Promise<boolean> {
	return access(path).then(() => true, () => false);
}

async function screenshot(page: Page, name: string): Promise<void> {
	await page.screenshot({ path: join(screenshotsDir, name), fullPage: true });
}

async function openReadme(page: Page): Promise<void> {
	await page.keyboard.press('Control+P');
	const quickInput = page.locator('.quick-input-widget').filter({ visible: true });
	await quickInput.getByRole('textbox').fill('README.md');
	await quickInput.getByRole('option').filter({ hasText: 'README.md' }).first().waitFor();
	await quickInput.getByRole('textbox').press('Enter');
	await page.getByText('# VS Code Customization Migration Test', { exact: true })
		.filter({ visible: true })
		.first()
		.waitFor();
}

async function selectCopilotHarness(page: Page): Promise<void> {
	const copilotButton = page.getByRole('button', { name: 'Copilot', exact: true })
		.filter({ visible: true });
	if (await copilotButton.count()) {
		return;
	}
	await page.getByRole('button', { name: 'Local', exact: true })
		.filter({ visible: true })
		.click();
	const menu = page.locator('.context-view').filter({ visible: true });
	await menu.getByText('Copilot', { exact: true }).click();
	await copilotButton.waitFor();
}

async function openAgents(page: Page): Promise<void> {
	const backToList = page.getByRole('button', { name: 'Back to list', exact: true })
		.filter({ visible: true });
	if (await backToList.count()) {
		await backToList.click();
		await page.getByText('Workspace', { exact: true })
			.filter({ visible: true })
			.waitFor();
		return;
	}
	const openCustomizations = page.getByText('Agent Customizations', { exact: true })
		.filter({ visible: true });
	if (await openCustomizations.count()) {
		const workspace = page.getByText('Workspace', { exact: true }).filter({ visible: true });
		if (!await workspace.count()) {
			await page.getByText('Agents', { exact: true })
				.filter({ visible: true })
				.last()
				.click();
			await workspace.waitFor();
		}
		return;
	}
	const openCustomizationsButton = page.getByRole('button', {
		name: 'Open Customizations',
		exact: true,
	}).filter({ visible: true });
	if (await openCustomizationsButton.count()) {
		await openCustomizationsButton.click();
	} else {
		await runCommand(page, 'Chat: Open Customizations');
	}
	await page.getByText('Agent Customizations', { exact: true })
		.filter({ visible: true })
		.waitFor();
	await page.getByText('Agents', { exact: true })
		.filter({ visible: true })
		.last()
		.click();
	await page.getByText('Workspace', { exact: true })
		.filter({ visible: true })
		.waitFor();
}

function workspaceList(page: Page, anchor: string): Locator {
	return page.locator('.monaco-list')
		.filter({ visible: true })
		.filter({ hasText: anchor })
		.first();
}

async function workspaceNames(page: Page, anchor: string): Promise<string[]> {
	return visibleTexts(workspaceList(page, anchor).locator('.item-name'));
}

async function waitForWorkspaceNames(
	page: Page,
	anchor: string,
	present: string[],
	absent: string[] = [],
): Promise<string[]> {
	return waitForObserved(
		`Workspace agents to contain ${present.join(', ')} and omit ${absent.join(', ') || '(none)'}`,
		() => workspaceNames(page, anchor),
		{
			accept: names => present.every(name => names.filter(value => value === name).length === 1)
				&& absent.every(name => !names.includes(name)),
			describe: names => `visible Workspace agents: ${JSON.stringify(names)}`,
			timeoutMs: 60_000,
		},
	);
}

async function recordAgentDropdown(
	page: Page,
	buttonName: string,
	screenshotName: string,
	present: string[],
	absent: string[],
	select?: string,
): Promise<void> {
	await page.getByRole('button', { name: buttonName, exact: true })
		.filter({ visible: true })
		.waitFor();
	await page.keyboard.press('Control+Period');
	const menu = page.locator('.context-view')
		.filter({ visible: true })
		.filter({ hasText: 'Configure Custom Agents...' })
		.first();
	await menu.waitFor();
	await waitForObserved(
		`Chat agent dropdown inventory for ${present.join(', ')}`,
		async () => {
			const counts: Record<string, number> = {};
			for (const name of [...present, ...absent]) {
				counts[name] = await visibleElementCount(menu.getByText(name, { exact: true }));
			}
			return counts;
		},
		{
			accept: counts => present.every(name => counts[name] === 1)
				&& absent.every(name => counts[name] === 0),
			describe: counts => JSON.stringify(counts),
			timeoutMs: 60_000,
		},
	);
	const actual: Record<string, number> = {};
	for (const name of [...present, ...absent]) {
		actual[name] = await visibleElementCount(menu.getByText(name, { exact: true }));
	}
	recordCheck(
		`Chat dropdown: ${screenshotName}`,
		`Exactly one of ${present.join(', ')}; none of ${absent.join(', ')}`,
		actual,
		present.every(name => actual[name] === 1) && absent.every(name => actual[name] === 0),
	);
	await screenshot(page, screenshotName);
	if (select && buttonName !== select) {
		await menu.getByText(select, { exact: true }).click();
		await page.getByRole('button', { name: select, exact: true })
			.filter({ visible: true })
			.waitFor();
	} else {
		if (select === buttonName) {
			notes.push(`${select} was already selected automatically after creation.`);
		}
		await page.keyboard.press('Escape');
	}
}

try {
	const pendingContextView = workbench.locator('.context-view').filter({ visible: true });
	if (await pendingContextView.count()) {
		await workbench.keyboard.press('Escape');
		await pendingContextView.waitFor({ state: 'hidden' });
	}
	const pendingQuickInput = workbench.locator('.quick-input-widget').filter({ visible: true });
	if (await pendingQuickInput.count()) {
		await workbench.keyboard.press('Escape');
		await pendingQuickInput.waitFor({ state: 'hidden' });
	}
	const pendingDialog = workbench.locator('.monaco-dialog-box').filter({ visible: true });
	if (await pendingDialog.count()) {
		await pendingDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
		await pendingDialog.waitFor({ state: 'hidden' });
	}
	const closeModalEditor = workbench.getByRole('button', {
		name: 'Close Modal Editor (Escape)',
		exact: true,
	}).filter({ visible: true });
	if (await closeModalEditor.count()) {
		await closeModalEditor.click();
		await closeModalEditor.waitFor({ state: 'hidden' });
	}
	await runStep('Verify root README', workbench, screenshotsDir, async () => {
		await openReadme(workbench);
		const readmeExists = await exists(join(workspaceDir, 'README.md'));
		recordCheck('Root README exists and opens', 'README.md at workspace root and visible in editor', {
			readmeExists,
			visibleHeading: true,
		}, readmeExists);
		await screenshot(workbench, 'readme-root.png');
	});

	await runStep('Select Copilot harness', workbench, screenshotsDir, async () => {
		await runCommand(workbench, 'Chat: Open Chat');
		await selectCopilotHarness(workbench);
		recordCheck('Copilot harness selected', 'Visible Copilot harness button', 'Copilot', true);
		await screenshot(workbench, 'copilot-harness-selected.png');
	});

	await runStep('Verify initial Workspace agents', workbench, screenshotsDir, async () => {
		await openAgents(workbench);
		const names = await waitForWorkspaceNames(workbench, 'agent-two', ['agent-one', 'agent-two']);
		const exactApprovedInventory = names.length === 2
			&& names.includes('agent-one')
			&& names.includes('agent-two');
		recordCheck(
			'Initial Workspace agent inventory',
			'Exactly agent-one and agent-two, once each',
			names,
			exactApprovedInventory,
		);
		if (!exactApprovedInventory) {
			notes.push(`Initial Workspace inventory differed from the approved exact list: ${names.join(', ')}.`);
		}
		await screenshot(workbench, 'initial-workspace-agents.png');
	});

	await runStep('Open and rename agent-two', workbench, screenshotsDir, async () => {
		const list = workspaceList(workbench, 'agent-two');
		await list.locator('.item-name').getByText('agent-two', { exact: true }).click();
		await workbench.getByText('agent-two.agent.md', { exact: true })
			.filter({ visible: true })
			.waitFor();
		const nameLine = workbench.locator('.view-line')
			.filter({ visible: true })
			.filter({ hasText: 'name: agent-two' });
		await nameLine.click();
		await workbench.keyboard.press('Home');
		await workbench.keyboard.press('Shift+End');
		await workbench.keyboard.type('name: agent-two-new');
		await workbench.keyboard.press('Control+S');
		const content = await waitForObserved(
			'agent-two frontmatter name to be saved',
			() => readFile(agentTwoPath, 'utf8'),
			{
				accept: value => /^name:\s*agent-two-new\s*$/m.test(value),
				describe: value => value.split(/\r?\n/).slice(0, 4).join(' | '),
				timeoutMs: 30_000,
			},
		);
		recordCheck(
			'Rename persisted to frontmatter',
			'Only name changes to agent-two-new',
			content,
			/^name:\s*agent-two-new\s*$/m.test(content)
				&& /description:\s*This is agent two\./.test(content),
		);
	});

	await runStep('Verify renamed agent in both surfaces', workbench, screenshotsDir, async () => {
		await openAgents(workbench);
		const names = await waitForWorkspaceNames(
			workbench,
			'agent-two-new',
			['agent-one', 'agent-two-new'],
			['agent-two'],
		);
		recordCheck(
			'Renamed Customizations inventory',
			'agent-two-new once; agent-two absent',
			names,
			names.filter(name => name === 'agent-two-new').length === 1 && !names.includes('agent-two'),
		);
		await screenshot(workbench, 'renamed-customizations.png');
		await workbench.keyboard.press('Escape');
		await recordAgentDropdown(
			workbench,
			'Agent',
			'renamed-chat-dropdown.png',
			['agent-two-new'],
			['agent-two'],
		);
	});

	await runStep('Create Workspace agent-three', workbench, screenshotsDir, async () => {
		await openAgents(workbench);
		await workbench.getByRole('button', { name: 'New Agent', exact: true })
			.filter({ visible: true })
			.first()
			.click();
		const locationPicker = workbench.locator('.quick-input-widget').filter({ visible: true });
		await locationPicker.getByRole('option').filter({ hasText: '.github' }).first().click();
		const namePicker = workbench.locator('.quick-input-widget').filter({ visible: true });
		const nameInput = namePicker.getByRole('textbox');
		await nameInput.waitFor();
		await nameInput.fill('agent-three');
		await nameInput.press('Enter');
		await waitForObserved(
			'agent-three.agent.md to be created',
			() => exists(agentThreePath),
			{
				accept: value => value,
				describe: value => `file exists: ${value}`,
				timeoutMs: 30_000,
			},
		);
		const content = await waitForObserved(
			'generated agent-three frontmatter to be populated',
			() => readFile(agentThreePath, 'utf8'),
			{
				accept: value => value.startsWith('---') && /^name:\s*agent-three\s*$/m.test(value),
				describe: value => value.split(/\r?\n/).slice(0, 5).join(' | '),
				timeoutMs: 30_000,
			},
		);
		await workbench.keyboard.press('Control+S');
		recordCheck(
			'Workspace agent-three backing file',
			'Valid .github/agents/agent-three.agent.md with name agent-three',
			content,
			content.startsWith('---') && /^name:\s*agent-three\s*$/m.test(content),
		);
		await openAgents(workbench);
		const names = await waitForWorkspaceNames(
			workbench,
			'agent-three',
			['agent-one', 'agent-two-new', 'agent-three'],
			['agent-two'],
		);
		recordCheck(
			'Created Customizations inventory',
			'agent-three appears exactly once',
			names,
			names.filter(name => name === 'agent-three').length === 1,
		);
		await screenshot(workbench, 'created-customizations.png');
		await workbench.keyboard.press('Escape');
		await recordAgentDropdown(
			workbench,
			'agent-three',
			'created-chat-dropdown.png',
			['agent-three'],
			['agent-two'],
			'agent-three',
		);
	});

	await runStep('Delete agent-one from Customizations', workbench, screenshotsDir, async () => {
		await openAgents(workbench);
		const list = workspaceList(workbench, 'agent-one');
		await list.locator('.item-name').getByText('agent-one', { exact: true }).click({ button: 'right' });
		const contextMenu = workbench.locator('.context-view').filter({ visible: true });
		const deleteItem = contextMenu.getByRole('menuitem', { name: 'Delete', exact: true });
		await deleteItem.waitFor();
		await deleteItem.hover();
		await deleteItem.focus();
		await workbench.keyboard.press('Enter');
		const confirmation = workbench.locator('.monaco-dialog-box').filter({ visible: true });
		const deletionState = await waitForObserved(
			'deletion confirmation or agent-one file removal',
			async () => ({
				dialogVisible: await confirmation.count() > 0,
				fileExists: await exists(agentOnePath),
			}),
			{
				accept: value => value.dialogVisible || !value.fileExists,
				describe: value => JSON.stringify(value),
				timeoutMs: 30_000,
			},
		);
		if (deletionState.dialogVisible) {
			await screenshot(workbench, 'deletion-confirmation.png');
			const dialogText = await confirmation.innerText();
			notes.push(`Deletion confirmation shown: ${dialogText.replace(/\s+/g, ' ').trim()}`);
			await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
		} else {
			notes.push('No explicit deletion confirmation was shown.');
		}
		await waitForObserved(
			'agent-one backing file to be removed',
			() => exists(agentOnePath),
			{
				accept: value => !value,
				describe: value => `file exists: ${value}`,
				timeoutMs: 30_000,
			},
		);
		const names = await waitForWorkspaceNames(
			workbench,
			'agent-two-new',
			['agent-two-new', 'agent-three'],
			['agent-one', 'agent-two'],
		);
		recordCheck(
			'Final Customizations inventory',
			'agent-one and stale agent-two absent; agent-two-new and agent-three once each',
			names,
			!names.includes('agent-one')
				&& !names.includes('agent-two')
				&& names.filter(name => name === 'agent-two-new').length === 1
				&& names.filter(name => name === 'agent-three').length === 1,
		);
		await screenshot(workbench, 'final-customizations.png');
		await workbench.keyboard.press('Escape');
		await recordAgentDropdown(
			workbench,
			'agent-three',
			'final-chat-dropdown.png',
			['agent-two-new', 'agent-three'],
			['agent-one', 'agent-two'],
		);
	});

	const agentTwoContent = await readFile(agentTwoPath, 'utf8');
	const finalFiles = {
		agentOneExists: await exists(agentOnePath),
		agentThreeContent: await readFile(agentThreePath, 'utf8'),
		agentThreeExists: await exists(agentThreePath),
		agentTwoContent,
		agentTwoExists: await exists(agentTwoPath),
	};
	recordCheck(
		'Final backing files',
		'agent-one deleted; agent-two renamed in frontmatter; agent-three valid',
		finalFiles,
		!finalFiles.agentOneExists
			&& finalFiles.agentTwoExists
			&& /^name:\s*agent-two-new\s*$/m.test(finalFiles.agentTwoContent)
			&& finalFiles.agentThreeExists
			&& /^name:\s*agent-three\s*$/m.test(finalFiles.agentThreeContent),
	);
} finally {
	await evidence.write(join(rootDir, 'console.json'));
	await writeFile(
		join(rootDir, 'test-observations.json'),
		`${JSON.stringify({ checks, notes }, undefined, 2)}\n`,
	);
	await writeRunTiming(
		join(rootDir, 'timing.json'),
		orchestrationStartedAt,
		automationStartedAt,
	);
	await browser.close();
}
