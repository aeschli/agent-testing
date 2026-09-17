import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
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
	writeRunTiming,
} from '../../.github/skills/tpi-test/playwright-workbench-utils.mts';

const rootDir = readRequiredEnvironment('TEST_ROOT_DIR');
const endpoint = readRequiredEnvironment('VSCODE_CDP_ENDPOINT');
const orchestrationStartedAt = parseTimestamp(
	readRequiredEnvironment('ORCHESTRATION_STARTED_AT'),
	'orchestration start',
);
const automationStartedAt = new Date();
const screenshotsDir = join(rootDir, 'screenshots');
const targetPath = join(homedir(), '.copilot', 'agents', 'user-agent.agent.md');
const observations: Record<string, unknown> = {
	targetPath,
};
const evidence = new EvidenceRecorder();
const { browser, workbench: initialWorkbench } = await connectToWorkbench(endpoint);
let workbench = initialWorkbench;
evidence.attach(workbench);

try {
	await runStep('Verify setup and create user agent', workbench, screenshotsDir, async () => {
		await assert.rejects(
			() => import('node:fs/promises').then(({ access }) => access(targetPath)),
			{ code: 'ENOENT' },
			'The protected user-agent file must not exist before test setup.',
		);
		await mkdir(dirname(targetPath), { recursive: true });
		await writeFile(
			targetPath,
			[
				'---',
				'name: user-agent',
				'description: User-level agent discovery test fixture',
				'---',
				'',
				'You are the user-agent discovery test agent.',
				'',
			].join('\n'),
			{ encoding: 'utf8', flag: 'wx' },
		);
		observations.createdTarget = true;
	});

	await runStep('Reload and verify authenticated workbench', workbench, screenshotsDir, async () => {
		await runCommand(workbench, 'Developer: Reload Window');
		workbench = await reacquireWorkbench(browser);
		evidence.attach(workbench);
		await workbench.getByRole('button', { name: /^Models,/ }).waitFor({
			state: 'visible',
			timeout: 60_000,
		});
		await workbench.getByRole('button', { name: 'Copilot status' }).waitFor({
			state: 'visible',
			timeout: 30_000,
		});
		observations.authenticatedWorkbench = true;
	});

	await runStep('Verify user customization discovery', workbench, screenshotsDir, async () => {
		await workbench.getByRole('button', { name: 'Open Customizations' }).click();
		await workbench.getByText('Agent Customizations', { exact: true }).first().waitFor({
			state: 'visible',
			timeout: 30_000,
		});
		await workbench.locator('[role="listitem"][aria-label^="Agents,"]').click();
		await workbench.getByRole('heading', { name: 'Agents', exact: true }).waitFor({
			state: 'visible',
			timeout: 30_000,
		});

		const userGroup = workbench.locator('.customization-card-section').filter({
			has: workbench.getByRole('heading', { name: 'User', exact: true }),
		});
		const workspaceGroup = workbench.locator('.customization-card-section').filter({
			has: workbench.getByRole('heading', { name: 'Workspace', exact: true }),
		});
		const userRows = userGroup.locator('.item-name');
		const workspaceRows = workspaceGroup.locator('.item-name');
		const userInventory = await waitForInventory(userRows, { present: ['user-agent'] }, 60_000);
		const workspaceInventory = await visibleTexts(workspaceRows);
		assert.equal(
			workspaceInventory.filter(value => value === 'user-agent').length,
			0,
			'user-agent must not appear in the Workspace group.',
		);
		assert.equal(
			userInventory.filter(value => value === 'user-agent').length,
			1,
			'user-agent must appear exactly once in the User group.',
		);
		observations.customizations = { userInventory, workspaceInventory };
		await mkdir(screenshotsDir, { recursive: true });
		await workbench.screenshot({
			path: join(screenshotsDir, '01-user-agent-customizations.png'),
			fullPage: true,
		});

		await userGroup.getByText('user-agent', { exact: true }).click();
		const backingEditor = workbench.locator('.monaco-modal-editor-block .monaco-editor[data-uri^="file:"]');
		await backingEditor.waitFor({ state: 'visible', timeout: 30_000 });
		const resourceUri = await backingEditor.getAttribute('data-uri');
		assert.ok(resourceUri, 'The opened customization editor must expose its backing file URI.');
		assert.equal(
			normalize(fileURLToPath(resourceUri)).toLowerCase(),
			normalize(targetPath).toLowerCase(),
			`Opened agent must resolve to ${targetPath}.`,
		);
		observations.openedBackingFile = { resourceUri };
		await workbench.screenshot({
			path: join(screenshotsDir, '02-user-agent-backing-file.png'),
			fullPage: true,
		});
	});

	await runStep('Verify chat agent dropdown', workbench, screenshotsDir, async () => {
		await workbench.getByRole('button', { name: /^Close Modal Editor/ }).click();
		const agentPicker = workbench.getByRole('button', { name: 'Agent', exact: true });
		await agentPicker.waitFor({ state: 'visible', timeout: 30_000 });
		await agentPicker.click();
		const menu = workbench.locator('.context-view').filter({ visible: true });
		await menu.waitFor({ state: 'visible', timeout: 30_000 });
		const userAgentOptions = menu.getByRole('menuitemcheckbox', { name: /^user-agent(?:,|$)/i });
		await userAgentOptions.first().waitFor({ state: 'visible', timeout: 30_000 });
		assert.equal(
			await visibleElementCount(userAgentOptions),
			1,
			'user-agent must appear exactly once in the Chat agent dropdown.',
		);
		observations.chatAgentMenu = await visibleTexts(menu.locator('.monaco-list-row'));
		const cdpSession = await workbench.context().newCDPSession(workbench);
		const capturedDropdown = await cdpSession.send('Page.captureScreenshot', { format: 'png' });
		await writeFile(
			join(screenshotsDir, '03-user-agent-chat-dropdown.png'),
			Buffer.from(capturedDropdown.data, 'base64'),
		);
		await cdpSession.detach();
		await userAgentOptions.click();
		await workbench.getByRole('button', { name: 'user-agent', exact: true }).waitFor({
			state: 'visible',
			timeout: 30_000,
		});
		observations.chatAgentSelectable = true;
		await workbench.screenshot({
			path: join(screenshotsDir, '04-user-agent-selected.png'),
			fullPage: true,
		});
	});
} finally {
	await writeFile(
		join(rootDir, 'observations.json'),
		`${JSON.stringify(observations, undefined, 2)}\n`,
		'utf8',
	);
	await evidence.write(join(rootDir, 'console.json'));
	await writeRunTiming(
		join(rootDir, 'timing.json'),
		orchestrationStartedAt,
		automationStartedAt,
	);
	await browser.close();
}
