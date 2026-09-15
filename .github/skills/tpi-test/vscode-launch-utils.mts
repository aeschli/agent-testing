import { homedir } from 'node:os';
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

export function downloadLatestVSCodeInsiders(): Promise<string> {
	return downloadAndUnzipVSCode({
		version: 'insiders',
		cachePath,
	});
}

export async function launchCodeInsiders(
	args: string[],
	options: LaunchCodeOptions = {},
): Promise<void> {
	const executable = await downloadLatestVSCodeInsiders();
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
