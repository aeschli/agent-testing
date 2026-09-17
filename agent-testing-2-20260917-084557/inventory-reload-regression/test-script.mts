import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
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
	visibleTexts,
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
const observations: Array<{
	inventory: string[];
	step: string;
	surface: 'Chat dropdown' | 'Customizations';
	timestamp: string;
}> = [];
const automationStartedAt = new Date();
const evidence = new EvidenceRecorder();
const { browser, workbench: initialWorkbench } = await connectToWorkbench(endpoint);
let workbench = initialWorkbench;
let discoveryStartedAt: Date | undefined;

function assertWithinBound(): void {
	if (discoveryStartedAt && Date.now() - discoveryStartedAt.getTime() > 5 * 60_000) {
		throw new Error('The five-minute post-discovery execution bound was exceeded.');
	}
}

function customizationRows(page: Page): Locator {
	return page.locator('.monaco-list-row').filter({ hasText: /^agent-/ });
}

function dropdownRows(page: Page): Locator {
	return page.locator('.context-view .monaco-list-row').filter({ hasText: /^agent-/ });
}

async function agentNames(rows: Locator): Promise<string[]> {
	const texts = await visibleTexts(rows);
	return texts
		.map(text => text.split(/\r?\n/, 1)[0].trim())
		.filter(name => /^agent-[a-z0-9-]+$/.test(name));
}

async function waitForAgents(
	rows: Locator,
	expected: string[],
	description: string,
): Promise<string[]> {
	const sortedExpected = [...expected].sort();
	return waitForObserved(description, () => agentNames(rows), {
		accept: names => {
			const sortedNames = [...names].sort();
			return sortedNames.length === sortedExpected.length
				&& sortedNames.every((name, index) => name === sortedExpected[index]);
		},
		describe: names => `visible agent entries: ${JSON.stringify(names)}`,
		timeoutMs: 20_000,
	});
}

async function ensureCopilot(page: Page): Promise<void> {
	const local = page.getByRole('button', { name: 'Local', exact: true });
	if (await local.isVisible().catch(() => false)) {
		await local.click();
		await page.getByText('Copilot', { exact: true }).locator('..').click();
	}
	await page.getByRole('button', { name: 'Copilot', exact: true }).waitFor({
		state: 'visible',
		timeout: 20_000,
	});
}

async function runCommandWithF1(page: Page, command: string): Promise<void> {
	await page.keyboard.press('Escape');
	await page.keyboard.press('F1');
	const quickInput = page.locator('.quick-input-widget').filter({ visible: true });
	await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
	const input = quickInput.getByRole('textbox');
	await input.fill(`>${command}`);
	await waitForObserved(
		`command "${command}" to appear in the command palette`,
		() => visibleTexts(quickInput.getByRole('option')),
		{
			accept: values => values.some(value => value.includes(command)),
			describe: values => `visible options: ${JSON.stringify(values)}`,
			timeoutMs: 20_000,
		},
	);
	await input.press('Enter');
	await quickInput.waitFor({ state: 'hidden', timeout: 20_000 });
}

async function openCustomizations(page: Page): Promise<void> {
	await page.keyboard.press('Escape');
	await runCommandWithF1(page, 'Chat: Open Customizations');
	await page.getByText('Agent Customizations', { exact: true }).filter({ visible: true }).waitFor({
		state: 'visible',
		timeout: 20_000,
	});
	const agentsNavigation = page.getByRole('listitem', { name: /Agents, \d+ items/ });
	await agentsNavigation.waitFor({ state: 'visible', timeout: 20_000 });
	await agentsNavigation.click();
	await page.getByText('Workspace', { exact: true }).filter({ visible: true }).waitFor({
		state: 'visible',
		timeout: 20_000,
	});
}

async function openAgentDropdown(page: Page): Promise<void> {
	await page.keyboard.press('Escape');
	for (const name of ['Agent', 'agent-one', 'agent-two', 'agent-two-new', 'agent-three']) {
		const button = page.getByRole('button', { name, exact: true }).filter({ visible: true });
		if (await button.count() > 0) {
			await button.first().click();
			await page.getByText('Configure Custom Agents...', { exact: true }).waitFor({
				state: 'visible',
				timeout: 10_000,
			});
			return;
		}
	}
	throw new Error('Could not locate the Chat agent dropdown button.');
}

async function observeCustomizations(step: string, expected: string[]): Promise<void> {
	await openCustomizations(workbench);
	const inventory = await waitForAgents(
		customizationRows(workbench),
		expected,
		`${step} Customizations inventory`,
	);
	observations.push({
		inventory,
		step,
		surface: 'Customizations',
		timestamp: new Date().toISOString(),
	});
	await workbench.screenshot({
		path: join(screenshotsDir, `${step}-customizations.png`),
		fullPage: true,
	});
}

async function observeChat(step: string, expected: string[]): Promise<void> {
	await openAgentDropdown(workbench);
	const inventory = await waitForAgents(
		dropdownRows(workbench),
		expected,
		`${step} Chat dropdown inventory`,
	);
	observations.push({
		inventory,
		step,
		surface: 'Chat dropdown',
		timestamp: new Date().toISOString(),
	});
	await workbench.screenshot({
		path: join(screenshotsDir, `${step}-chat-dropdown.png`),
		fullPage: true,
	});
	await workbench.keyboard.press('Escape');
}

async function selectChatAgent(name: string): Promise<void> {
	await openAgentDropdown(workbench);
	const row = dropdownRows(workbench).filter({ hasText: new RegExp(`^${name}$`) });
	await row.waitFor({ state: 'visible', timeout: 10_000 });
	await row.click();
	await workbench.getByRole('button', { name, exact: true }).filter({ visible: true }).waitFor({
		state: 'visible',
		timeout: 10_000,
	});
}

evidence.attach(workbench);
await mkdir(screenshotsDir, { recursive: true });

try {
	await runStep('Initial discovery', workbench, screenshotsDir, async () => {
		await ensureCopilot(workbench);
		await observeCustomizations('initial', ['agent-one', 'agent-two']);
		await observeChat('initial', ['agent-one', 'agent-two']);
		discoveryStartedAt = new Date();
	});

	await runStep('Rename agent-two', workbench, screenshotsDir, async () => {
		assertWithinBound();
		const path = join(agentsDir, 'agent-two.agent.md');
		const content = await readFile(path, 'utf8');
		await writeFile(path, content.replace('name: agent-two', 'name: agent-two-new'));
		await observeCustomizations('after-rename', ['agent-one', 'agent-two-new']);
		await observeChat('after-rename', ['agent-one', 'agent-two-new']);
	});

	await runStep('Create agent-three', workbench, screenshotsDir, async () => {
		assertWithinBound();
		await writeFile(join(agentsDir, 'agent-three.agent.md'), `---
name: agent-three
description: This is agent three.
model: GPT-5.4
tools: [execute, read, edit, search, web, agent, todo]
---
`);
		await observeCustomizations('after-create', ['agent-one', 'agent-three', 'agent-two-new']);
		await observeChat('after-create', ['agent-one', 'agent-three', 'agent-two-new']);
	});

	await runStep('Delete agent-one', workbench, screenshotsDir, async () => {
		assertWithinBound();
		await unlink(join(agentsDir, 'agent-one.agent.md'));
		await observeCustomizations('before-reload', ['agent-three', 'agent-two-new']);
		await observeChat('before-reload', ['agent-three', 'agent-two-new']);
	});

	await runStep('Reload and compare', workbench, screenshotsDir, async () => {
		assertWithinBound();
		await runCommand(workbench, 'Developer: Reload Window');
		workbench = await reacquireWorkbench(browser);
		evidence.attach(workbench);
		await ensureCopilot(workbench);
		await observeCustomizations('after-reload', ['agent-three', 'agent-two-new']);
		await observeChat('after-reload', ['agent-three', 'agent-two-new']);

		const files = (await Promise.all([
			'agent-one.agent.md',
			'agent-two.agent.md',
			'agent-three.agent.md',
		].map(async file => ({
			exists: await readFile(join(agentsDir, file), 'utf8').then(() => true, () => false),
			file,
		})))).filter(entry => entry.exists).map(entry => entry.file).sort();
		if (JSON.stringify(files) !== JSON.stringify(['agent-three.agent.md', 'agent-two.agent.md'])) {
			throw new Error(`Backing files did not match the expected final set: ${JSON.stringify(files)}`);
		}
	});

	await runStep('Open and select survivors', workbench, screenshotsDir, async () => {
		assertWithinBound();
		await openCustomizations(workbench);
		for (const [name, file] of [
			['agent-two-new', 'agent-two.agent.md'],
			['agent-three', 'agent-three.agent.md'],
		] as const) {
			const row = customizationRows(workbench).filter({ hasText: new RegExp(`^${name}`) });
			await row.click();
			await workbench.getByText(file, { exact: true }).filter({ visible: true }).waitFor({
				state: 'visible',
				timeout: 10_000,
			});
			await selectChatAgent(name);
		}
		await workbench.screenshot({
			path: join(screenshotsDir, 'survivors-opened-and-selected.png'),
			fullPage: true,
		});
	});

	assertWithinBound();
	await writeFile(
		join(rootDir, 'observations.json'),
		`${JSON.stringify(observations, undefined, 2)}\n`,
	);
} finally {
	const automationEndedAt = new Date();
	await evidence.write(join(rootDir, 'console.json'));
	const timing = await writeRunTiming(
		join(rootDir, 'timing.json'),
		orchestrationStartedAt,
		automationStartedAt,
		automationEndedAt,
	);
	await writeFile(
		join(rootDir, 'timing.json'),
		`${JSON.stringify({
			...timing,
			discoveryBoundDurationMs: discoveryStartedAt
				? automationEndedAt.getTime() - discoveryStartedAt.getTime()
				: null,
			discoveryStartedAt: discoveryStartedAt?.toISOString() ?? null,
			fiveMinuteBoundMs: 300_000,
		}, undefined, 2)}\n`,
	);
	await browser.close();
}
