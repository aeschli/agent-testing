import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
	launchCodeInsiders,
	parsePort,
	readOption,
} from './vscode-launch-utils.mts';

interface LaunchOptions {
	tpiId?: string;
	rendererPort?: number;
	extensionHostPort?: number;
	sourceUserDataDir: string;
	sourceSharedDataDir?: string;
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

function parseArgs(args: string[]): LaunchOptions {
	const options: LaunchOptions = {
		sourceUserDataDir: join(homedir(), 'authenticated-user-data-dir'),
	};

	for (let index = 0; index < args.length; index++) {
		const option = args[index];
		const result = readOption(args, index, option);
		index = result.nextIndex;

		switch (option) {
			case '--tpi-id':
				options.tpiId = result.value;
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

	if (!options.tpiId) {
		throw new Error('Missing required argument: --tpi-id.');
	}
	return options;
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
): void {
	assertPathExists(source, 'Authentication source directory');

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
}

function createInitialSettings(userDataDir: string): void {
	const userDir = join(userDataDir, 'User');
	const settingsPath = join(userDir, 'settings.json');
	if (existsSync(settingsPath)) {
		return;
	}

	mkdirSync(userDir, { recursive: true });
	writeFileSync(settingsPath, `${JSON.stringify({
		'workbench.startupEditor': 'none',
		'window.dialogStyle': 'custom',
	}, undefined, '\t')}\n`);
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const scriptDir = dirname(fileURLToPath(import.meta.url));
	const repositoryRoot = resolve(scriptDir, '..', '..', '..');
	const testRoot = resolve(repositoryRoot, options.tpiId!);
	const relativeTestRoot = relative(repositoryRoot, testRoot);
	if (relativeTestRoot.startsWith('..') || isAbsolute(relativeTestRoot)) {
		throw new Error(`TPI ID resolves outside the repository: ${options.tpiId}`);
	}

	const sourceSharedDataDir = options.sourceSharedDataDir
		?? join(options.sourceUserDataDir, 'shared-data');
	const userDataDir = join(testRoot, 'user-data-dir');
	const extensionsDir = join(testRoot, 'extensions-dir');
	const sharedDataDir = join(testRoot, 'shared-data-dir');
	const workspace = join(testRoot, 'workspace');

	copyMissingAuthenticationSeed(options.sourceUserDataDir, userDataDir, [
		'Local State',
		'machineid',
		join('User', 'globalStorage', 'state.vscdb'),
	]);
	copyMissingAuthenticationSeed(sourceSharedDataDir, sharedDataDir, ['sharedStorage']);

	for (const path of [userDataDir, extensionsDir, sharedDataDir, workspace]) {
		mkdirSync(path, { recursive: true });
	}
	createInitialSettings(userDataDir);

	const reservation = await reserveDebugPorts(options);
	try {
		await launchCodeInsiders([
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
		], () => reservation.release());
	} finally {
		await reservation.release();
	}
	await waitForDebugEndpoints(
		reservation.rendererPort,
		reservation.extensionHostPort,
	);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
