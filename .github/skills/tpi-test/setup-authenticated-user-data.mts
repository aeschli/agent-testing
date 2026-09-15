import { join } from 'node:path';
import {
	defaultAuthenticatedUserDataDir,
	launchCodeInsiders,
	readOption,
} from './vscode-launch-utils.mts';

interface SetupOptions {
	userDataDir: string;
	sharedDataDir?: string;
}

function parseArgs(args: string[]): SetupOptions {
	const options: SetupOptions = {
		userDataDir: defaultAuthenticatedUserDataDir,
	};

	for (let index = 0; index < args.length; index++) {
		const option = args[index];
		switch (option) {
			case '--user-data-dir': {
				const result = readOption(args, index, option);
				options.userDataDir = result.value;
				index = result.nextIndex;
				break;
			}
			case '--shared-data-dir': {
				const result = readOption(args, index, option);
				options.sharedDataDir = result.value;
				index = result.nextIndex;
				break;
			}
			default:
				throw new Error(`Unknown argument: ${option}`);
		}
	}

	return options;
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const sharedDataDir = options.sharedDataDir ?? join(options.userDataDir, 'shared-data');

	console.log('Opening the authenticated VS Code Insiders profile:');
	console.log(`  User data:   ${options.userDataDir}`);
	console.log(`  Shared data: ${sharedDataDir}`);

	await launchCodeInsiders([
		'--user-data-dir', options.userDataDir,
		'--shared-data-dir', sharedDataDir,
		'--new-window',
	]);

	console.log(`
In the opened window:
1. Sign in to GitHub from the Accounts menu.
2. Confirm that the expected GitHub account is shown.
3. Close the window to flush and unlock its storage databases.`);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
