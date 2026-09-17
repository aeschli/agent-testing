import { homedir } from 'node:os';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

export const defaultAuthenticatedUserDataDir = join(homedir(), 'authenticated-user-data-dir');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cachePath = resolve(scriptDir, '..', '..', '..', '.vscode-test');

interface LaunchCodeOptions {
	beforeSpawn?: () => Promise<void>;
	waitForExit?: boolean;
}

export interface VSCodeBuildMetadata {
	architecture: NodeJS.Architecture;
	buildDate: string;
	commit: string;
	executablePath: string;
	version: string;
}

export interface LaunchCodeResult extends VSCodeBuildMetadata {
	processId: number;
}

export function downloadLatestVSCodeInsiders(): Promise<string> {
	return downloadAndUnzipVSCode({
		version: 'insiders',
		cachePath,
	});
}

function readJsonObject(path: string, description: string): Record<string, unknown> {
	const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${description} is not a JSON object: ${path}`);
	}
	return value as Record<string, unknown>;
}

function findApplicationMetadataDir(executablePath: string): string {
	const executableDir = dirname(executablePath);
	const candidates = [
		join(executableDir, 'resources', 'app'),
		join(executableDir, 'Resources', 'app'),
		resolve(executableDir, '..', 'Resources', 'app'),
	];

	for (const entry of readdirSync(executableDir, { withFileTypes: true })) {
		if (entry.isDirectory() && /^[0-9a-f]{10}$/i.test(entry.name)) {
			candidates.push(join(executableDir, entry.name, 'resources', 'app'));
		}
	}

	const applicationDir = candidates.find(candidate =>
		existsSync(join(candidate, 'package.json'))
		&& existsSync(join(candidate, 'product.json'))
	);
	if (!applicationDir) {
		throw new Error(
			`Cannot locate VS Code package.json and product.json from executable: ${executablePath}`,
		);
	}
	return applicationDir;
}

export function readVSCodeBuildMetadata(executablePath: string): VSCodeBuildMetadata {
	const applicationDir = findApplicationMetadataDir(executablePath);
	const packageJson = readJsonObject(
		join(applicationDir, 'package.json'),
		'VS Code package metadata',
	);
	const productJson = readJsonObject(
		join(applicationDir, 'product.json'),
		'VS Code product metadata',
	);

	const version = packageJson.version;
	const commit = productJson.commit;
	const buildDate = productJson.date;
	if (typeof version !== 'string' || !version) {
		throw new Error('VS Code package metadata does not contain a version.');
	}
	if (typeof commit !== 'string' || !commit) {
		throw new Error('VS Code product metadata does not contain a commit.');
	}
	if (typeof buildDate !== 'string' || Number.isNaN(Date.parse(buildDate))) {
		throw new Error('VS Code product metadata does not contain a valid build date.');
	}

	return {
		architecture: process.arch,
		buildDate,
		commit,
		executablePath,
		version,
	};
}

export async function launchCodeInsiders(
	args: string[],
	options: LaunchCodeOptions = {},
): Promise<LaunchCodeResult> {
	const executable = await downloadLatestVSCodeInsiders();
	const buildMetadata = readVSCodeBuildMetadata(executable);
	await options.beforeSpawn?.();
	const waitForExit = options.waitForExit ?? false;
	const child = spawn(executable, args, {
		detached: !waitForExit,
		stdio: 'ignore',
		windowsHide: false,
	});

	await new Promise<void>((resolveLaunch, rejectLaunch) => {
		child.once('error', rejectLaunch);
		child.once('spawn', () => {
			if (!waitForExit) {
				child.unref();
				resolveLaunch();
			}
		});
		if (waitForExit) {
			child.once('close', (code, signal) => {
				if (code === 0) {
					resolveLaunch();
					return;
				}
				rejectLaunch(new Error(
					`VS Code Insiders exited with ${signal ? `signal ${signal}` : `code ${code}`}.`,
				));
			});
		}
	});

	if (child.pid === undefined) {
		throw new Error('VS Code Insiders launched without reporting a process ID.');
	}
	return {
		...buildMetadata,
		processId: child.pid,
	};
}

export function readOption(
	args: string[],
	index: number,
	option: string,
): { value: string; nextIndex: number } {
	const value = args[index + 1];
	if (!value || value.startsWith('--')) {
		throw new Error(`Missing value for ${option}.`);
	}
	return { value, nextIndex: index + 1 };
}

export function parsePort(value: string, option: string): number {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`${option} must be an integer between 1 and 65535.`);
	}
	return port;
}
