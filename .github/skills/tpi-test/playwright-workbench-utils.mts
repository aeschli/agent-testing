import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
	chromium,
	type Browser,
	type ConsoleMessage,
	type Locator,
	type Page,
	type Request,
} from 'playwright';

export interface WaitOptions<T> {
	accept: (value: T) => boolean;
	describe?: (value: T) => string;
	intervalMs?: number;
	timeoutMs?: number;
}

export interface InventoryExpectation {
	absent?: string[];
	exact?: string[];
	present?: string[];
}

export interface ScreenshotOptions {
	fullPage?: boolean;
	retryIntervalMs?: number;
	timeoutMs?: number;
	transient?: boolean;
}

export interface EvidenceEntry {
	message: string;
	source?: string;
	timestamp: string;
	type: 'console' | 'pageerror' | 'requestfailed';
}

export interface EvidenceRecorderOptions {
	consoleTypes?: ReturnType<ConsoleMessage['type']>[];
	shouldRecord?: (entry: EvidenceEntry) => boolean;
}

export interface RunTiming {
	automationDurationMs: number;
	automationEndedAt: string;
	automationStartedAt: string;
	orchestrationDurationMs: number;
	orchestrationStartedAt: string;
}

export function readRequiredEnvironment(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}.`);
	}
	return value;
}

export function parseTimestamp(value: string, description: string): Date {
	const timestamp = new Date(value);
	if (Number.isNaN(timestamp.getTime())) {
		throw new Error(`Invalid ${description} timestamp: ${value}.`);
	}
	return timestamp;
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function formatValue(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

export async function waitForObserved<T>(
	description: string,
	observe: () => Promise<T>,
	options: WaitOptions<T>,
): Promise<T> {
	const timeoutMs = options.timeoutMs ?? 30_000;
	const intervalMs = options.intervalMs ?? 100;
	const deadline = Date.now() + timeoutMs;
	let lastObserved = 'no observation completed';

	while (Date.now() < deadline) {
		try {
			const value = await observe();
			lastObserved = options.describe?.(value) ?? formatValue(value);
			if (options.accept(value)) {
				return value;
			}
		} catch (error) {
			lastObserved = `observation failed: ${describeError(error)}`;
		}
		await delay(intervalMs);
	}

	throw new Error(
		`Timed out after ${timeoutMs}ms waiting for ${description}. Last observed: ${lastObserved}`,
	);
}

export async function connectToWorkbench(
	endpoint: string,
	timeoutMs = 60_000,
): Promise<{ browser: Browser; workbench: Page }> {
	const browser = await chromium.connectOverCDP(endpoint);
	try {
		return {
			browser,
			workbench: await reacquireWorkbench(browser, timeoutMs),
		};
	} catch (error) {
		await browser.close();
		throw error;
	}
}

export async function reacquireWorkbench(
	browser: Browser,
	timeoutMs = 60_000,
): Promise<Page> {
	return waitForObserved(
		'a visible VS Code workbench page',
		async () => {
			const pages = browser.contexts().flatMap(context => context.pages());
			const candidates = pages.filter(page =>
				!page.isClosed() && page.url().includes('workbench.html')
			);

			for (const page of candidates) {
				const workbench = page.locator('.monaco-workbench');
				if (await workbench.isVisible().catch(() => false)) {
					await page.bringToFront();
					return { page, urls: pages.map(candidate => candidate.url()) };
				}
			}
			return { page: undefined, urls: pages.map(page => page.url()) };
		},
		{
			accept: value => value.page !== undefined,
			describe: value => `open pages: ${value.urls.join(', ') || '(none)'}`,
			timeoutMs,
		},
	).then(value => value.page!);
}

export async function runCommand(
	workbench: Page,
	command: string,
	timeoutMs = 30_000,
): Promise<void> {
	await workbench.keyboard.press('Escape');
	await workbench.keyboard.press('F1');
	const quickInput = workbench.locator('.quick-input-widget').filter({ visible: true });
	await quickInput.waitFor({ state: 'visible', timeout: timeoutMs });

	const input = quickInput.getByRole('textbox');
	await input.fill(`>${command}`);
	await clickExactQuickPickOption(quickInput, command, timeoutMs);
	await quickInput.waitFor({ state: 'hidden', timeout: timeoutMs }).catch(error => {
		if (!workbench.isClosed()) {
			throw error;
		}
	});
}

export async function clickExactQuickPickOption(
	quickInput: Locator,
	label: string,
	timeoutMs = 30_000,
): Promise<void> {
	const options = quickInput.getByRole('option');
	const selection = await waitForObserved(
		`exact quick-pick option "${label}"`,
		async () => {
			const elements = await options.all();
			const visibleOptions = await Promise.all(elements.map(async (option, index) => {
				if (!await option.isVisible().catch(() => false)) {
					return undefined;
				}
				const text = (await option.innerText().catch(() => '')).trim();
				const hasExactLabel = await option
					.getByText(label, { exact: true })
					.first()
					.isVisible()
					.catch(() => false);
				return {
					hasExactLabel,
					index,
					text,
				};
			}));
			const visible = visibleOptions.filter(
				(value): value is NonNullable<typeof value> => value !== undefined,
			);
			const exact = visible.filter(value =>
				value.hasExactLabel || value.text.split(/\r?\n/, 1)[0].trim() === label
			);
			return { exact, visible };
		},
		{
			accept: value => value.exact.length === 1,
			describe: value =>
				`exact matches: ${formatValue(value.exact)}; visible options: ${formatValue(value.visible)}`,
			timeoutMs,
		},
	);
	await options.nth(selection.exact[0].index).click();
}

export async function selectQuickPickCheckbox(
	quickInput: Locator,
	label: string,
	timeoutMs = 30_000,
): Promise<void> {
	const labelElement = quickInput.getByText(label, { exact: true }).filter({ visible: true });
	await labelElement.waitFor({ state: 'visible', timeout: timeoutMs });
	const entry = labelElement.locator(
		'xpath=ancestor-or-self::*[contains(@class, "quick-input-tree-entry")][1]',
	);
	const checkbox = entry.getByRole('checkbox');
	await checkbox.waitFor({ state: 'visible', timeout: timeoutMs });
	await checkbox.click();
	await waitForObserved(
		`quick-pick checkbox "${label}" to be selected`,
		async () =>
			await checkbox.isChecked().catch(() => false)
			|| await checkbox.getAttribute('aria-checked') === 'true',
		{
			accept: checked => checked,
			timeoutMs,
		},
	);
}

export async function visibleElementCount(locator: Locator): Promise<number> {
	const elements = await locator.all();
	const visibility = await Promise.all(
		elements.map(element => element.isVisible().catch(() => false)),
	);
	return visibility.filter(Boolean).length;
}

export async function visibleTexts(locator: Locator): Promise<string[]> {
	const elements = await locator.all();
	const values = await Promise.all(elements.map(async element => {
		if (!await element.isVisible().catch(() => false)) {
			return undefined;
		}
		const text = await element.innerText().catch(() => '');
		return text.trim() || undefined;
	}));
	return values.filter((value): value is string => value !== undefined);
}

export async function visibleCustomizationNames(rows: Locator): Promise<string[]> {
	const elements = await rows.all();
	const names = await Promise.all(elements.map(async row => {
		if (!await row.isVisible().catch(() => false)) {
			return undefined;
		}
		const itemName = row.locator('.item-name').first();
		const text = await itemName.isVisible().catch(() => false)
			? await itemName.innerText()
			: await row.innerText();
		return text.split(/\r?\n/, 1)[0].trim() || undefined;
	}));
	return names.filter((value): value is string => value !== undefined);
}

function inventoryMatches(
	values: string[],
	expectation: InventoryExpectation,
): boolean {
	const counts = new Map<string, number>();
	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}

	if (expectation.present?.some(value => counts.get(value) !== 1)) {
		return false;
	}
	if (expectation.absent?.some(value => counts.has(value))) {
		return false;
	}
	if (expectation.exact) {
		const actual = [...values].sort();
		const expected = [...expectation.exact].sort();
		return actual.length === expected.length
			&& actual.every((value, index) => value === expected[index]);
	}
	return true;
}

export async function waitForInventory(
	rows: Locator,
	expectation: InventoryExpectation,
	timeoutMs = 30_000,
): Promise<string[]> {
	return waitForObserved(
		'the scoped inventory to match',
		() => visibleTexts(rows),
		{
			accept: values => inventoryMatches(values, expectation),
			describe: values => `visible entries: ${formatValue(values)}`,
			timeoutMs,
		},
	);
}

export async function waitForCustomizationInventory(
	rows: Locator,
	expectation: InventoryExpectation,
	timeoutMs = 30_000,
): Promise<string[]> {
	return waitForObserved(
		'the scoped customization inventory to match',
		() => visibleCustomizationNames(rows),
		{
			accept: values => inventoryMatches(values, expectation),
			describe: values => `visible customization names: ${formatValue(values)}`,
			timeoutMs,
		},
	);
}

export async function activeModalEditorUri(
	workbench: Page,
	timeoutMs = 30_000,
): Promise<string> {
	return waitForObserved(
		'an active modal editor with one backing URI',
		async () => {
			const editors = await workbench
				.locator('.monaco-modal-editor-block .monaco-editor[data-uri]')
				.all();
			const uris = await Promise.all(editors.map(async editor =>
				await editor.isVisible().catch(() => false)
					? await editor.getAttribute('data-uri')
					: undefined
			));
			return uris.filter((uri): uri is string => !!uri);
		},
		{
			accept: uris => uris.length === 1,
			describe: uris => `visible modal editor URIs: ${formatValue(uris)}`,
			timeoutMs,
		},
	).then(uris => uris[0]);
}

export async function prepareHandoffSignal(path: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await rm(path, { force: true });
}

export async function waitForHandoffSignal(
	path: string,
	description: string,
	timeoutMs = 120_000,
): Promise<string> {
	console.log(`[tpi] WAIT ${description}; create signal file: ${path}`);
	const contents = await waitForObserved(
		`handoff signal for ${description}`,
		() => readFile(path, 'utf8'),
		{
			accept: () => true,
			describe: value => `signal contents: ${formatValue(value)}`,
			intervalMs: 250,
			timeoutMs,
		},
	);
	console.log(`[tpi] RESUME ${description}`);
	return contents;
}

async function withTimeout<T>(
	action: Promise<T>,
	timeoutMs: number,
	description: string,
): Promise<T> {
	return Promise.race([
		action,
		delay(timeoutMs).then(() => {
			throw new Error(`Timed out after ${timeoutMs}ms while ${description}.`);
		}),
	]);
}

export async function captureScreenshot(
	workbench: Page,
	path: string,
	options: ScreenshotOptions = {},
): Promise<void> {
	const timeoutMs = options.timeoutMs ?? 15_000;
	const retryIntervalMs = options.retryIntervalMs ?? 250;
	const deadline = Date.now() + timeoutMs;
	let lastError = 'no screenshot attempt completed';

	await mkdir(dirname(path), { recursive: true });
	while (Date.now() < deadline) {
		try {
			const remainingMs = Math.max(1, deadline - Date.now());
			const attemptTimeoutMs = Math.min(5_000, remainingMs);
			if (options.transient) {
				const session = await workbench.context().newCDPSession(workbench);
				try {
					const result = await withTimeout(
						session.send('Page.captureScreenshot', { format: 'png' }),
						attemptTimeoutMs,
						'capturing a transient CDP screenshot',
					);
					await writeFile(path, Buffer.from(result.data, 'base64'));
				} finally {
					await session.detach().catch(() => undefined);
				}
			} else {
				await workbench.screenshot({
					fullPage: options.fullPage ?? true,
					path,
					timeout: attemptTimeoutMs,
				});
			}
			return;
		} catch (error) {
			lastError = describeError(error);
			await delay(Math.min(retryIntervalMs, Math.max(0, deadline - Date.now())));
		}
	}

	throw new Error(`Unable to capture screenshot ${path}: ${lastError}`);
}

export class EvidenceRecorder {
	readonly entries: EvidenceEntry[] = [];
	readonly #attachedPages = new WeakSet<Page>();
	readonly #consoleTypes: Set<ReturnType<ConsoleMessage['type']>>;
	readonly #shouldRecord: (entry: EvidenceEntry) => boolean;

	constructor(options: EvidenceRecorderOptions = {}) {
		this.#consoleTypes = new Set(options.consoleTypes ?? ['warning', 'error']);
		this.#shouldRecord = options.shouldRecord ?? (() => true);
	}

	attach(page: Page): void {
		if (this.#attachedPages.has(page)) {
			return;
		}
		this.#attachedPages.add(page);

		page.on('console', message => this.#recordConsole(message));
		page.on('pageerror', error => {
			this.#record({
				message: error.message,
				timestamp: new Date().toISOString(),
				type: 'pageerror',
			});
		});
		page.on('requestfailed', request => this.#recordFailedRequest(request));
	}

	async write(path: string): Promise<void> {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, `${JSON.stringify(this.entries, undefined, 2)}\n`);
	}

	#recordConsole(message: ConsoleMessage): void {
		if (!this.#consoleTypes.has(message.type())) {
			return;
		}
		this.#record({
			message: message.text(),
			source: sanitizeUrl(message.location().url),
			timestamp: new Date().toISOString(),
			type: 'console',
		});
	}

	#recordFailedRequest(request: Request): void {
		this.#record({
			message: request.failure()?.errorText ?? 'Request failed',
			source: sanitizeUrl(request.url()),
			timestamp: new Date().toISOString(),
			type: 'requestfailed',
		});
	}

	#record(entry: EvidenceEntry): void {
		if (this.#shouldRecord(entry)) {
			this.entries.push(entry);
		}
	}
}

function sanitizeUrl(value: string): string | undefined {
	if (!value) {
		return undefined;
	}
	try {
		const url = new URL(value);
		url.hash = '';
		url.search = '';
		return url.toString();
	} catch {
		return value.split(/[?#]/, 1)[0];
	}
}

export async function runStep<T>(
	name: string,
	workbench: Page,
	screenshotsDir: string,
	action: () => Promise<T>,
): Promise<T> {
	const startedAt = Date.now();
	console.log(`[tpi] START ${name}`);
	try {
		const result = await action();
		console.log(`[tpi] PASS ${name} (${Date.now() - startedAt}ms)`);
		return result;
	} catch (error) {
		const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		const screenshotPath = join(screenshotsDir, `${safeName || 'failed-step'}.png`);
		const capturedScreenshot = await captureScreenshot(workbench, screenshotPath)
			.then(() => true, () => false);
		console.error(`[tpi] FAIL ${name} (${Date.now() - startedAt}ms): ${describeError(error)}`);
		throw new Error(
			`Step "${name}" failed. ${
				capturedScreenshot ? `Screenshot: ${screenshotPath}.` : 'Failure screenshot was unavailable.'
			} ${describeError(error)}`,
			{ cause: error },
		);
	}
}

export async function writeRunTiming(
	path: string,
	orchestrationStartedAt: Date,
	automationStartedAt: Date,
	automationEndedAt = new Date(),
): Promise<RunTiming> {
	for (const [description, value] of [
		['orchestration start', orchestrationStartedAt],
		['automation start', automationStartedAt],
		['automation end', automationEndedAt],
	] as const) {
		if (Number.isNaN(value.getTime())) {
			throw new Error(`Invalid ${description} timestamp.`);
		}
	}

	const timing: RunTiming = {
		automationDurationMs: automationEndedAt.getTime() - automationStartedAt.getTime(),
		automationEndedAt: automationEndedAt.toISOString(),
		automationStartedAt: automationStartedAt.toISOString(),
		orchestrationDurationMs: automationEndedAt.getTime() - orchestrationStartedAt.getTime(),
		orchestrationStartedAt: orchestrationStartedAt.toISOString(),
	};
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(timing, undefined, 2)}\n`);
	return timing;
}
