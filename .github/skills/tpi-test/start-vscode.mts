import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
	launchCodeInsiders,
	parsePort,
	readOption,
} from './vscode-launch-utils.mts';

interface LaunchOptions {
	rootDir?: string;
	rendererPort?: number;
	extensionHostPort?: number;
	sourceUserDataDir: string;
	sourceSharedDataDir?: string;
}

interface ParsedLaunchOptions extends LaunchOptions {
	rootDir: string;
}

interface PortReservation {
	rendererPort: number;
	extensionHostPort: number;
	release(): Promise<void>;
}

interface DebugTarget {
	title?: string;
	type?: string;
	url?: string;
	webSocketDebuggerUrl?: string;
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function waitForJsonEndpoint<T>(
	url: string,
	description: string,
	validate: (value: unknown) => T,
	timeoutMs = 60_000,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	let lastError = 'endpoint did not respond';

	while (Date.now() < deadline) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status} ${response.statusText}`);
			}
			return validate(await response.json());
		} catch (error) {
			lastError = describeError(error);
			await delay(250);
		}
	}

	throw new Error(
		`Timed out waiting for ${description} at ${url}: ${lastError}`,
	);
}

function validateObject(value: unknown, description: string): object {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${description} returned an invalid JSON object.`);
	}
	return value;
}

function isDebugTarget(value: unknown): value is DebugTarget {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateTargets(value: unknown, description: string): DebugTarget[] {
	if (
		!Array.isArray(value)
		|| value.length === 0
		|| !value.every(isDebugTarget)
	) {
		throw new Error(`${description} did not expose any debug targets.`);
	}
	return value;
}

async function waitForDebugEndpoints(
	rendererPort: number,
	extensionHostPort: number,
): Promise<void> {
	const rendererEndpoint = `http://127.0.0.1:${rendererPort}`;
	const extensionHostEndpoint = `http://127.0.0.1:${extensionHostPort}`;

	await waitForJsonEndpoint(
		`${rendererEndpoint}/json/version`,
		'renderer debugger version endpoint',
		value => validateObject(value, 'Renderer debugger version endpoint'),
	);
	const rendererTargets = await waitForJsonEndpoint(
		`${rendererEndpoint}/json/list`,
		'renderer debugger target endpoint',
		value => validateTargets(value, 'Renderer debugger target endpoint'),
	);
	const workbenchTargets = rendererTargets.filter(target => target.type === 'page');
	if (workbenchTargets.length !== 1) {
		throw new Error(
			`Expected exactly one renderer workbench target, found ${workbenchTargets.length}.`,
		);
	}

	await waitForJsonEndpoint(
		`${extensionHostEndpoint}/json/list`,
		'extension-host debugger target endpoint',
		value => validateTargets(value, 'Extension-host debugger target endpoint'),
	);

	console.log('VS Code Insiders debug endpoints are ready.');
	console.log(`Renderer debug port: ${rendererPort}`);
	console.log(`Renderer endpoint: ${rendererEndpoint}`);
	console.log(`Extension-host debug port: ${extensionHostPort}`);
	console.log(`Extension-host endpoint: ${extensionHostEndpoint}`);
}

function closeServer(server: Server): Promise<void> {
	return new Promise((resolveClose, rejectClose) => {
		server.close(error => error ? rejectClose(error) : resolveClose());
	});
}

async function reservePort(
	requestedPort: number | undefined,
	option: string,
): Promise<{ port: number; server: Server }> {
	const server = createServer();
	server.unref();
	const port = requestedPort ?? 0;

	await new Promise<void>((resolveListen, rejectListen) => {
		server.once('error', error => {
			rejectListen(new Error(
				`Cannot reserve ${option} port ${requestedPort ?? 'automatically'} on 127.0.0.1: ${error.message}`,
			));
		});
		server.listen({
			host: '127.0.0.1',
			port,
			exclusive: true,
		}, resolveListen);
	});

	const address = server.address();
	if (!address || typeof address === 'string') {
		await closeServer(server);
		throw new Error(`Cannot determine the reserved ${option} port.`);
	}
	return { port: address.port, server };
}

async function reserveDebugPorts(options: LaunchOptions): Promise<PortReservation> {
	const servers: Server[] = [];
	let released = false;
	let rendererPort: number;
	let extensionHostPort: number;

	try {
		const renderer = await reservePort(options.rendererPort, '--renderer-port');
		rendererPort = renderer.port;
		servers.push(renderer.server);

		const extensionHost = await reservePort(
			options.extensionHostPort,
			'--extension-host-port',
		);
		extensionHostPort = extensionHost.port;
		servers.push(extensionHost.server);
	} catch (error) {
		await Promise.all(servers.map(closeServer));
		throw error;
	}

	return {
		rendererPort,
		extensionHostPort,
		async release(): Promise<void> {
			if (released) {
				return;
			}
			released = true;
			await Promise.all(servers.map(closeServer));
		},
	};
}

function parseArgs(args: string[]): ParsedLaunchOptions {
	const options: LaunchOptions = {
		sourceUserDataDir: join(homedir(), 'authenticated-user-data-dir'),
	};

	for (let index = 0; index < args.length; index++) {
		const option = args[index];
		const result = readOption(args, index, option);
		index = result.nextIndex;

		switch (option) {
			case '--root-dir':
				options.rootDir = result.value;
				break;
			case '--renderer-port':
				options.rendererPort = parsePort(result.value, option);
				break;
			case '--extension-host-port':
				options.extensionHostPort = parsePort(result.value, option);
				break;
			case '--source-user-data-dir':
				options.sourceUserDataDir = result.value;
				break;
			case '--source-shared-data-dir':
				options.sourceSharedDataDir = result.value;
				break;
			default:
				throw new Error(`Unknown argument: ${option}`);
		}
	}

	if (!options.rootDir) {
		throw new Error('Missing required argument: --root-dir.');
	}
	return {
		...options,
		rootDir: options.rootDir,
	};
}

function resolveChildPath(parent: string, child: string, description: string): string {
	const resolved = resolve(parent, child);
	const relativePath = relative(parent, resolved);
	if (
		!relativePath
		|| relativePath === '..'
		|| relativePath.startsWith(`..${sep}`)
		|| isAbsolute(relativePath)
	) {
		throw new Error(`${description} resolves outside its parent directory: ${child}`);
	}
	return resolved;
}

function assertPathExists(path: string, description: string): void {
	try {
		statSync(path);
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
			throw new Error(`${description} does not exist: ${path}`);
		}
		throw error;
	}
}

function copyMissingAuthenticationSeed(
	source: string,
	destination: string,
	requiredPaths: string[],
): boolean {
	try {
		statSync(source);
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
			return false;
		}
		throw error;
	}

	for (const relativePath of requiredPaths) {
		const sourcePath = join(source, relativePath);
		assertPathExists(sourcePath, 'Authentication source path');

		const destinationPath = join(destination, relativePath);
		if (existsSync(destinationPath)) {
			continue;
		}
		mkdirSync(dirname(destinationPath), { recursive: true });
		cpSync(sourcePath, destinationPath, { recursive: true, force: true });
	}
	return true;
}

async function setupAuthenticationSource(
	scriptDir: string,
	sourceUserDataDir: string,
	sourceSharedDataDir: string,
): Promise<void> {
	const child = spawn(process.execPath, [
		join(scriptDir, 'setup-authenticated-user-data.mts'),
		'--user-data-dir', sourceUserDataDir,
		'--shared-data-dir', sourceSharedDataDir,
	], {
		stdio: 'inherit',
	});

	await new Promise<void>((resolveSetup, rejectSetup) => {
		child.once('error', rejectSetup);
		child.once('close', (code, signal) => {
			if (code === 0) {
				resolveSetup();
				return;
			}
			rejectSetup(new Error(
				`Authentication setup exited with ${signal ? `signal ${signal}` : `code ${code}`}.`,
			));
		});
	});
}

function createInitialSettings(userDataDir: string, rootDir: string): void {
	const userDir = join(userDataDir, 'User');
	const settingsPath = join(userDir, 'settings.json');
	if (existsSync(settingsPath)) {
		return;
	}

	mkdirSync(userDir, { recursive: true });
	writeFileSync(settingsPath, `${JSON.stringify({
		'workbench.startupEditor': 'none',
		'window.dialogStyle': 'custom',
		"workbench.colorTheme": "Monokai",
		"files.autoSave": "afterDelay",
		"files.simpleDialog.enable": true,
		"window.title": `Testing Agent — ${rootDir}`
	}, undefined, '\t')}\n`);
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const scriptDir = dirname(fileURLToPath(import.meta.url));
	const repositoryRoot = resolve(scriptDir, '..', '..', '..');
	const outputRoot = resolveChildPath(repositoryRoot, options.rootDir, 'Root directory');

	const sourceSharedDataDir = options.sourceSharedDataDir
		?? join(options.sourceUserDataDir, 'shared-data');
	const userDataDir = join(outputRoot, 'user-data-dir');
	const extensionsDir = join(outputRoot, 'extensions-dir');
	const sharedDataDir = join(userDataDir, 'shared-data');
	const workspace = join(outputRoot, 'workspace');
	const screenshotsDir = join(outputRoot, 'screenshots');
	const vscodeLogsDir = join(outputRoot, 'vscode-logs');
	const reportedIssuesDir = join(outputRoot, 'reported-issues');

	const userDataSeedPaths = [
		'Local State',
		'machineid',
		join('User', 'globalStorage', 'state.vscdb'),
	];
	const sharedDataSeedPaths = ['sharedStorage'];
	const foundUserDataSource = copyMissingAuthenticationSeed(
		options.sourceUserDataDir,
		userDataDir,
		userDataSeedPaths,
	);
	const foundSharedDataSource = copyMissingAuthenticationSeed(
		sourceSharedDataDir,
		sharedDataDir,
		sharedDataSeedPaths,
	);

	if (!foundUserDataSource || !foundSharedDataSource) {
		await setupAuthenticationSource(
			scriptDir,
			options.sourceUserDataDir,
			sourceSharedDataDir,
		);
		if (
			!copyMissingAuthenticationSeed(
				options.sourceUserDataDir,
				userDataDir,
				userDataSeedPaths,
			)
			|| !copyMissingAuthenticationSeed(
				sourceSharedDataDir,
				sharedDataDir,
				sharedDataSeedPaths,
			)
		) {
			throw new Error('VS Code closed without creating the authentication source directories.');
		}
	}

	for (const path of [
		userDataDir,
		extensionsDir,
		sharedDataDir,
		workspace,
		screenshotsDir,
		vscodeLogsDir,
		reportedIssuesDir,
	]) {
		mkdirSync(path, { recursive: true });
	}
	createInitialSettings(userDataDir, outputRoot);

	const reservation = await reserveDebugPorts(options);
	const launchedAt = new Date().toISOString();
	let launch;
	try {
		launch = await launchCodeInsiders([
			'--user-data-dir', userDataDir,
			'--extensions-dir', extensionsDir,
			'--shared-data-dir', sharedDataDir,
			'--remote-debugging-address=127.0.0.1',
			`--remote-debugging-port=${reservation.rendererPort}`,
			`--inspect-extensions=${reservation.extensionHostPort}`,
			'--disable-workspace-trust',
			'--skip-welcome',
			'--skip-release-notes',
			workspace,
		], { beforeSpawn: () => reservation.release() });
	} finally {
		await reservation.release();
	}
	await waitForDebugEndpoints(
		reservation.rendererPort,
		reservation.extensionHostPort,
	);

	const launchMetadataPath = join(outputRoot, 'launch-metadata.json');
	const launchMetadata = {
		schemaVersion: 1,
		channel: 'insiders',
		version: launch.version,
		commit: launch.commit,
		buildDate: launch.buildDate,
		architecture: launch.architecture,
		executablePath: launch.executablePath,
		processId: launch.processId,
		launchedAt,
		rootDir: outputRoot,
		renderer: {
			port: reservation.rendererPort,
			endpoint: `http://127.0.0.1:${reservation.rendererPort}`,
		},
		extensionHost: {
			port: reservation.extensionHostPort,
			endpoint: `http://127.0.0.1:${reservation.extensionHostPort}`,
			note: 'This is the initial endpoint; the extension host can select another port after reload.',
		},
	};
	writeFileSync(
		launchMetadataPath,
		`${JSON.stringify(launchMetadata, undefined, 2)}\n`,
	);
	console.log(`VS Code Insiders version: ${launch.version}`);
	console.log(`VS Code Insiders commit: ${launch.commit}`);
	console.log(`VS Code Insiders build date: ${launch.buildDate}`);
	console.log(`VS Code Insiders root process ID: ${launch.processId}`);
	console.log(`Launch metadata: ${launchMetadataPath}`);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
