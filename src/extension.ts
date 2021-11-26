// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import axios from 'axios';
import { URL } from 'url';
import * as vscode from 'vscode';
import { GitExtension } from './typings/git';
import * as azdev from "azure-devops-node-api";
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
	let disposable = vscode.commands.registerCommand('ymlbuildpipelinepreview.testPipeline', async () => {
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

		let repoUrl: URL | null = null;
		for (const remote of remotes) {
			const { fetchUrl } = remote;
			vscode.window.showInformationMessage("targetting gitrepo: " + fetchUrl);
			if (fetchUrl) { repoUrl = new URL(fetchUrl); }
		}
		if (!repoUrl) {
			vscode.window.showErrorMessage('sorry not able to determine the remote url\r\n pls connect to azure devops git repo...');
			return;
		}

		let organisation: string = "";
		let project: string = "";
		if (repoUrl.hostname.endsWith("visualstudio.com")) {
			organisation = repoUrl.hostname.substr(0, repoUrl.hostname.indexOf("."));
			project = repoUrl.pathname.substr(1, repoUrl.pathname.indexOf("/", 1) - 1);
			if (project === "DefaultCollection") { project = repoUrl.pathname.substr(19, repoUrl.pathname.indexOf("/", 19) - 19); }
		}

		console.log(`using project ${project} in organisation ${organisation}`);

		var devopsUri = repoUrl;

		let options: vscode.InputBoxOptions = {
			title: `Please enter Personal for the DevOpsAPI in ${organisation} -> ${project}`,
			prompt: "PAT: ",
			placeHolder: "(placeholder)"
		};

		let apiPAT = vscode.workspace.getConfiguration("ymlbuildpipelinepreview").get<string>("devOpsApiPAT", "");
		if (!apiPAT) {
			const value = await vscode.window.showInputBox(options);
			if (!value) {
				vscode.window.showErrorMessage('no PAT no build 😥 - aborting...');
				return;
			}
			apiPAT = value;
			vscode.workspace.getConfiguration("ymlbuildpipelinepreview").update("pipelineID", apiPAT);
		}

		options = {
			title: `Please enter Pipeline ID`,
			prompt: "PAT: ",
			placeHolder: "(placeholder)"
		};
		let pipelineId = vscode.workspace.getConfiguration("ymlbuildpipelinepreview").get<string>("pipelineID", "");
		if (!pipelineId) {
			const value = await vscode.window.showInputBox(options);
			if (!value) {
				vscode.window.showErrorMessage('no Pipeline ID no build 😥 - aborting...');
				return;
			}
			pipelineId = value;
			vscode.workspace.getConfiguration("ymlbuildpipelinepreview").update("pipelineID", apiPAT);
		}
		//  https://developercommunity.visualstudio.com/t/ability-to-test-yaml-builds-locally/366517
		// https://code.visualstudio.com/api/get-started/extension-anatomy
		var apiUrl = `https://dev.azure.com/${organisation}/${project}/_apis/pipelines/${pipelineId}/runs?api-version=5.1-preview`;
		/*
		{
			"PreviewRun": true,
			"YamlOverride": "
			# your YAML here
			"
		}*/


		var yml = vscode.window.activeTextEditor?.document.getText();
		const postData: PipelinesPostData = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			PreviewRun: true,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			YamlOverride: yml
		};

		let serverUrl = "https://dev.azure.com/" + organisation;
		let authHandler = azdev.getPersonalAccessTokenHandler(apiPAT);
		let connection = new azdev.WebApi(serverUrl, authHandler);

		let api = new azdev.WebApi(serverUrl, authHandler, undefined);
		const response = await api.rest.create<PostResult>(apiUrl, postData, undefined);

		if (response.statusCode === 200) {
			if (!response.result?.id) {
				vscode.window.showErrorMessage('invoked api with success but got no id 😮');
				return;
			}
			vscode.window.showErrorMessage('invoked api with success :P');
			var buildRunUrl = `https://dev.azure.com/${organisation}/${project}/_build/results?buildId=${response.result.id}`;
			vscode.env.openExternal(vscode.Uri.parse(buildRunUrl));
		} else {
			vscode.window.showErrorMessage('invoked api with an error: ' + response.statusCode);
		}
	});

	context.subscriptions.push(disposable);
}



// this method is called when your extension is deactivated
export function deactivate() { }


declare interface PipelinesPostData {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	PreviewRun: boolean;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	YamlOverride: string;
}

declare interface PostResult {
	id: number; // we only need the id 
	_links: {
		web: { href: string }
	}
}