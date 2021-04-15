/*
 * @Descripttion: 
 * @version: 0.x
 * @Author: zhai
 * @Date: 2021-03-25 16:15:15
 * @LastEditors: zhai
 * @LastEditTime: 2021-04-15 17:59:50
 */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';

import * as path from 'path';

import "reflect-metadata";
import { container } from "tsyringe";
import { ELECTRON_ENV_VARS, ELECTRON_INSTALL_PATH, OUTPUT_CHANNEL } from "./lib/api";

import { ElectronInstaller } from "./lib/electron-installer";
import { ElectronManager } from "./lib/electron-manager";
import { ChildProcess } from 'child_process';

import * as dialog from './util/webviewDialog';
import { Reminder } from './reminder';
import { allowedNodeEnvironmentFlags } from 'node:process';

export function formatMinutesText(minutespass: number, minutes: number | string) {
	return `$(clock) [${minutespass}/${minutes}]分钟`;
}


let reminder: Reminder;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "seat" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const spawn_env = JSON.parse(JSON.stringify(process.env));
	delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
	delete spawn_env.ELECTRON_RUN_AS_NODE;

	container.register(ELECTRON_INSTALL_PATH, { useValue: "./electron" });
	container.register(OUTPUT_CHANNEL, { useValue: vscode.window.createOutputChannel('VS ELECTRON') });
	container.register(ELECTRON_ENV_VARS, { useValue: spawn_env });

	const installer = container.resolve(ElectronInstaller);
	const electronManager = container.resolve(ElectronManager);

	const statusItemEnable = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	statusItemEnable.command = 'kk.seat.switch_enable';
	statusItemEnable.show();

	const statusItemMinutes = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999);
	statusItemMinutes.command = 'kk.seat.set_minutes';

	// const reminderOnText = "$(getting-started-item-checked) 久坐提醒: 开";
	// const reminderOffText = "$(getting-started-item-unchecked) 久坐提醒: 关";

	const reminderOnText = "$(pass) 久坐提醒: 开";
	const reminderOffText = "$(circle-slash) 久坐提醒: 关";

	{
		let config = vscode.workspace.getConfiguration("seat");
		let enable = config.get<boolean>('enable', true);
		statusItemEnable.text = enable ? reminderOnText : reminderOffText;

		let minutes = config.get<number>('reminderIntervalInMinutes', 45);
		statusItemMinutes.text = formatMinutesText(0, minutes);

		if (enable) {
			statusItemMinutes.show();
		}

		reminder = new Reminder(statusItemMinutes);
		reminder.minutes = minutes;
		reminder.enable = enable;
	}

	let disposables = [
		vscode.commands.registerCommand('kk.demo.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from seat!');
		}),

		vscode.commands.registerCommand('kk.electron.validate', (version?: string) => installer.validate(version)),

		vscode.commands.registerCommand('kk.electron.install', (version?: string) => installer.install(version)),

		vscode.commands.registerCommand('kk.electron.run', async (file: string, ...args) => {
			let version = "latest";
			let params = args;

			if (args[0].hasOwnProperty("version") && args[0].hasOwnProperty("params")) {
				version = args[0].version;
				params = args[0].params;
			}
			return electronManager.run(file, version, ...params);
		}),

		vscode.commands.registerCommand('kk.seat.remind', async () => {
			let version = "v12.0.1";
			let params: string[] = [];

			const file = path.resolve(__dirname, `electron/main/index.js`);

			const child = await electronManager.run(file, version, ...params);
			if (child) {
				child.on("exit", (code) => {
					console.log('child process exit..');

				});

				child.on('message', (msg) => {
					console.log('receive electron msg:', msg);
					if (msg === "no") {
						reminder.remindLater();
					}
				});

				child.send("ping");
			}
		}),

		vscode.commands.registerCommand('kk.electron.openUri', openUriCommand),

		vscode.commands.registerCommand('kk.demo.showWebview', showWebview),

		vscode.commands.registerCommand('kk.seat.switch_enable', () => {
			let config = vscode.workspace.getConfiguration("seat");
			let enable = config.get<boolean>('enable', true);

			if (enable) {
				config.update('enable', false);
				statusItemEnable.text = reminderOffText;
				statusItemMinutes.hide();
				vscode.window.showInformationMessage('seat reminder off');

				reminder.enable = false;
			}
			else {
				config.update('enable', true);
				statusItemEnable.text = reminderOnText;
				statusItemMinutes.show();
				vscode.window.showInformationMessage('seat reminder on');

				reminder.enable = true;
				reminder.minutespass = 0;
			}
		}),

		vscode.commands.registerCommand('kk.seat.set_minutes', () => {
			let config = vscode.workspace.getConfiguration("seat");

			let items: vscode.QuickPickItem[] = [
				{ label: "1", description: "每[1]分钟提醒一次" },
				{ label: "30", description: "每[30]分钟提醒一次" },
				{ label: "45", description: "每[45]分钟提醒一次" },
				{ label: "60", description: "每[60]分钟提醒一次" },
				{ label: "90", description: "每[90]分钟提醒一次" },
				{ label: "120", description: "每[120]分钟提醒一次" }
			];

			vscode.window.showQuickPick(items).then(selection => {
				if (selection) {
					statusItemMinutes.text = formatMinutesText(0, selection.label);
					config.update('reminderIntervalInMinutes', parseInt(selection.label));

					reminder.minutes = parseInt(selection.label);
					reminder.minutespass = 0;
				}
			});
		})
	];

	context.subscriptions.push(...disposables);

	vscode.workspace.onDidChangeTextDocument((ev) => {
		console.log(ev);
		if (reminder) {
			reminder.active();
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }


function openUriCommand(): void {

	vscode.window.showInputBox({
		value: "",
		placeHolder: "https://www.google.com",
		prompt: "insert website to load",
		validateInput: (value) => value ? "" : "Enter a valid uri"
	}).then(async (value) => {

		if (value) {
			const electron_app = path.resolve(__dirname, `electron-main.js`);

			const params = {
				version: 'v12.0.2',
				params: [value]
			};
			const process = await vscode.commands.executeCommand<ChildProcess>('seat.erun', electron_app, params);

			if (process) {
				process.on("message", (message: any) => {
					console.log(message);
				}
				);
			} else {
				console.log("no process ...");
			}
		}
	});
}

interface TestDialogResult {
	name: string;
}

async function showWebview(): Promise<void> {
	// const testDir = path.resolve(__dirname, '../src/dlg');
	const testDir = path.resolve(__dirname, './kedou');

	const d = new dialog.WebviewDialog<TestDialogResult>('webview-dialog-test', testDir, 'index.html');

	const result: TestDialogResult | null = await d.getResult();

	if (result) {
		vscode.window.showInformationMessage(
			"Webview dialog result: " + JSON.stringify(result));
	} else {
		vscode.window.showInformationMessage(
			"The webview dialog was cancelled.");
	}
}

