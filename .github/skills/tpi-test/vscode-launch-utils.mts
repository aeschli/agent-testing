import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

export const defaultAuthenticatedUserDataDir = join(homedir(), 'authenticated-user-data-dir');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cachePath = resolve(scriptDir, '..', '..', '..', '.vscode-test');

export function downloadLatestVSCodeInsiders(): Promise<string> {
	return downloadAndUnzipVSCode({
		version: 'insiders',
		cachePath,
	});
}

export async function launchCodeInsiders(
	args: string[],
	beforeSpawn?: () => Promise<void>,
): Promise<void> {
	const executable = await downloadLatestVSCodeInsiders();
	await beforeSpawn?.();
	const child = spawn(executable, args, {
		detached: true,
		stdio: 'ignore',
		windowsHide: false,
	});

	await new Promise<void>((resolveLaunch, rejectLaunch) => {
		child.once('spawn', resolveLaunch);
		child.once('error', rejectLaunch);
	});
	child.unref();
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
