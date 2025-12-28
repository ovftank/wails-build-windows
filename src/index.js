import core from '@actions/core';
import { exec } from '@actions/exec';
import path from 'node:path';
import fs from 'node:fs';
import { exec as execSync } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(execSync);

let startTime;

const run = async () => {
	try {
		startTime = Date.now();

		core.startGroup('Setup Dependencies for Windows');

		const goPath = process.env.GOPATH || path.join(process.env.USERPROFILE, 'go');
		core.exportVariable('GOPATH', goPath);

		await exec('corepack', ['enable', 'pnpm']);

		const frontendDir = path.join(process.cwd(), 'frontend');
		if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
			core.info('Installing frontend dependencies with pnpm...');
			await exec('pnpm', ['install'], { cwd: frontendDir });
		} else {
			core.info(
				'No frontend/package.json found, skipping frontend dependencies installation',
			);
		}

		const installPs1 = String.raw`.\install.ps1`;

		await exec('powershell', [
			'-NoProfile',
			'-Command',
			[
				`$ErrorActionPreference = 'Stop'`,
				`Write-Host "Installing Scoop..."`,
				`Invoke-WebRequest -Uri "https://get.scoop.sh" -OutFile "install.ps1"`,
				`${installPs1} -RunAsAdmin`,
				`Write-Host "Installing NSIS and UPX via Scoop..."`,
				`scoop bucket add extras`,
				`scoop bucket add main`,
				`scoop install nsis`,
				`scoop install main/upx`,
				`Write-Host "NSIS and UPX installed successfully via Scoop"`,
			].join('; '),
		]);

		const scoopShimPath = path.join(process.env.USERPROFILE, 'scoop', 'shims');
		core.addPath(scoopShimPath);
		core.info(`Added ${scoopShimPath} to PATH`);

		core.info('Installing Wails CLI (latest)...');
		await exec('go', ['install', 'github.com/wailsapp/wails/v2/cmd/wails@latest']);

		const goBinDir = path.join(goPath, 'bin');
		core.addPath(goBinDir);
		core.info(`Added ${goBinDir} to PATH`);

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
			await exec('wails', [
				'build',
				'-nsis',
				'-clean',
				'-ldflags',
				'-w -s',
				'-upx',
				'-upxflags',
				'-9',
			]);

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

run();

