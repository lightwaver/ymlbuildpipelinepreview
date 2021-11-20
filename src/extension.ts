// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitExtension } from './typings/git';
//import GitExtension from './git';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	//console.log('Congratulations, your extension "ymlbuildpipelinepreview" is now active!');
	//vscode.window.showInformationMessage('YMLBuildPipelinePreview loaded');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('ymlbuildpipelinepreview.testPipeline', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		var currentlyOpenTabfilePath = vscode.window.activeTextEditor?.document.fileName;

		if (!currentlyOpenTabfilePath) {
			vscode.window.showErrorMessage('no file editor opened - pls open the yaml file!');
			return;
		}
		if (!currentlyOpenTabfilePath?.endsWith(".yml") && !currentlyOpenTabfilePath?.endsWith(".yaml")) {
			vscode.window.showErrorMessage('thats no yml file!!! please open the yaml-pipeline file!');
			return;
		}

		
		const gitExtension = vscode.extensions?.getExtension<GitExtension>('vscode.git')?.exports;
		if (!gitExtension) {
			vscode.window.showErrorMessage('sorry not able to determine the git path ... expecting it to be in a azure devops git...');
			return;
		}
		const git = gitExtension.getAPI(1);

		if (!vscode.window.activeTextEditor?.document.uri) {
			vscode.window.showErrorMessage('sorry not able to determine the document uri ... expecting it to be in a azure devops git...');
			return;
		}

		const repository = git.getRepository(vscode.window.activeTextEditor?.document.uri);

		if (!repository) {
			vscode.window.showErrorMessage('sorry not able to determine the repository ... expecting it to be in a azure devops git...');
			return;
		}

		const { remotes, HEAD } = repository.state;

		let repoUrl: string | null = null;
		for (const remote of remotes) {
			const { fetchUrl } = remote;
			vscode.window.showInformationMessage("targetting gitrepo: " + fetchUrl);
			repoUrl = fetchUrl ?? null;
		}
		if (repoUrl == null) {
			vscode.window.showErrorMessage('sorry not able to determine the remote url\r\n pls connect to azure devops git repo...');
			return;
		}

		var yml = vscode.window.activeTextEditor?.document.getText();
		const postData: PipelinesPostData = {
			PreviewRun: true,
			YamlOverride: yml
		};

		let options: vscode.InputBoxOptions = {
			prompt: "Label: ",
			placeHolder: "(placeholder)"
		}
		

		let apiKey = "";
		vscode.window.showInputBox(options).then(value => {
			if (!value) return;
			apiKey = value;
			// show the next dialog, etc.
		});

		//  https://developercommunity.visualstudio.com/t/ability-to-test-yaml-builds-locally/366517
		// https://dev.azure.com/%7Borganization%7D/%7Bproject%7D/_apis/pipelines/%7BpipelineId%7D/runs?api-version=5.1-preview
		/*
		{
			"PreviewRun": true,
			"YamlOverride": "
			# your YAML here
			"
		}*/

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}


declare interface PipelinesPostData {
	PreviewRun: boolean;
	YamlOverride: string;
}