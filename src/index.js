import core from '@actions/core';
import { exec } from '@actions/exec';
import path from 'node:path';
import fs from 'node:fs';
import { exec as execSync } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(execSync);

let startTime;

const GO_VERSION = '1.25.5';

const run = async () => {
	try {
		startTime = Date.now();

		core.startGroup('Setup Dependencies for Windows');

		const goPath = process.env.GOPATH || path.join(process.env.USERPROFILE, 'go');
		core.exportVariable('GOPATH', goPath);

		core.info(`Checking Go version (expected: go${GO_VERSION})...`);
		try {
			const { stdout: goOutput } = await execAsync('go version');
			core.info(`Go version: ${goOutput.trim()}`);
			core.setOutput('go-version', goOutput.trim());
		} catch (error) {
			core.warning(`Could not determine Go version: ${error.message}`);
		}

		core.info('Checking Node.js version...');
		try {
			const { stdout: nodeOutput } = await execAsync('node --version');
			core.info(`Node.js version: ${nodeOutput.trim()}`);
		} catch (error) {
			core.warning(`Could not determine Node.js version: ${error.message}`);
		}

		core.info('Enabling pnpm using Corepack...');
		try {
			await exec('corepack', ['enable', 'pnpm']);
			const { stdout: pnpmOutput } = await execAsync('pnpm --version');
			core.info(`pnpm version: ${pnpmOutput.trim()}`);
		} catch {
			core.warning(`Corepack not available, installing pnpm manually...`);
			await exec('npm', ['install', '-g', 'pnpm@latest']);
		}

		core.info('Installing dependencies with pnpm...');
		await exec('pnpm', ['install']);

		core.info('Checking NSIS installation...');
		try {
			const { stdout: makensisOutput } = await execAsync('makensis --version');
			core.info(`NSIS found: ${makensisOutput.trim()}`);
		} catch {
			core.warning('NSIS not found, installing via chocolatey...');
			await exec('choco', ['install', 'nsis', '-y']);
			core.info('NSIS installed successfully');
		}

		core.info('Installing Wails CLI (latest)...');
		await exec('go', ['install', 'github.com/wailsapp/wails/v2/cmd/wails@latest']);

		let installedWailsVersion = 'latest';
		try {
			const { stdout: wailsOutput } = await execAsync('wails version');
			installedWailsVersion = wailsOutput.trim();
			core.info(`Wails version: ${installedWailsVersion}`);
		} catch (error) {
			core.warning(`Could not determine Wails version: ${error.message}`);
		}

		core.endGroup();

		core.setOutput('wails-version', installedWailsVersion);

		core.startGroup('Building Wails Application for Windows with NSIS installer');

		core.info('Running: wails build -nsis -clean');

		let installerPath = '';
		let binaryPath = '';

		try {
			await exec('wails', ['build', '-nsis', '-clean']);

			const buildDir = path.join(process.cwd(), 'build', 'bin');
			if (fs.existsSync(buildDir)) {
				const files = fs.readdirSync(buildDir);

				const installer = files.find((f) => f.endsWith('-installer.exe'));
				if (installer) {
					installerPath = path.join(buildDir, installer);
				}

				const executable = files.find(
					(f) => f.endsWith('.exe') && !f.includes('-installer'),
				);
				if (executable) {
					binaryPath = path.join(buildDir, executable);
				}
			}

			core.info('Build completed successfully!');
		} catch (error) {
			core.error(`Build failed: ${error.message}`);
			throw error;
		}

		core.endGroup();

		const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);

		core.setOutput('build-status', 'success');
		core.setOutput('installer-path', installerPath);
		core.setOutput('binary-path', binaryPath);
		core.setOutput('build-time', `${buildTime}s`);

		core.info(`Build Time: ${buildTime}s`);
		core.info(`Installer: ${installerPath || 'Not found'}`);
		core.info(`Binary: ${binaryPath || 'Not found'}`);
	} catch (error) {
		core.setFailed(`Action failed: ${error.message}`);
		core.setOutput('build-status', 'failed');
	}
};

export { run };

if (import.meta.url === `file://${process.argv[1]}`) {
	run();
}
