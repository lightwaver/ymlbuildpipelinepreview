// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { Url, URL } from 'url';
import * as vscode from 'vscode';
import { GitExtension } from './typings/git';
import * as azdev from "azure-devops-node-api";
import { url } from 'inspector';
import { parse } from 'path';
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

		let devOpsUrl: URL | undefined;
		const devOpsUrlStr = getSetting("azureDevOpsUrl", "");
		if (devOpsUrlStr) { devOpsUrl = new URL(devOpsUrlStr); }

		if (!devOpsUrl) {
			devOpsUrl = getDevOpsUrlFromRepo();
		}

		if (!devOpsUrl) {
			let url = await vscode.window.showInputBox({
				placeHolder: "DevOpsUrl",
				title: "Url of the Azure DevOps tenant you are using including the path to the Project. (e.g. https://dev.azure.com/{Organisation}/{Project} or https://{Organisation}.visualstudio.com/DefaultCollection/{Project})",
			});
			if (!url) {
				vscode.window.showErrorMessage('😕 please provide an Azure DevOpsUrl to connect to it! aborting..');
				return;
			}
			devOpsUrl = new URL(url);
		}

		let organisation: string = "";
		let project: string = "";

		let prjConfig = parseDevOpsUrl(devOpsUrl);
		if (prjConfig) {
			organisation = prjConfig.organisation;
			project = prjConfig.project;
		}

		console.log(`using project ${project} in organisation ${organisation}`);

		let apiPAT = await getSettingAndPrompt("devOpsApiPAT", `Please enter Personal Access Token for the DevOpsAPI in ${organisation} -> ${project}`, "PAT:", "Personal Access Token");
		if (!apiPAT) {
			vscode.window.showErrorMessage('no PAT no build 😥 - aborting...');
			return;
		}

		let pipelineId = await getSettingAndPrompt("pipelineID", `Please enter a valid PipelineID`, "Id:", "Pipeline ID");
		if (!pipelineId) {
			vscode.window.showErrorMessage('no Pipeline ID no build 😥 - aborting...');
			return;
		}
		// https://developercommunity.visualstudio.com/t/ability-to-test-yaml-builds-locally/366517
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

		if (!yml) {
			vscode.window.showErrorMessage('😣 i was not able to fetch yml data from th editor');
			return;
		}

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
		try {
			const response = await api.rest.create<PostResult>(apiUrl, postData, undefined);
			if (response.statusCode === 200) {
				if (response.result?.id ?? 0 <= 0) {
					vscode.window.showInformationMessage('👌 invoked api with success - Syntax seems to be ok');
					return;
				}
				vscode.window.showErrorMessage('👌 invoked api with success opening build');

				var buildRunUrl = `https://dev.azure.com/${organisation}/${project}/_build/results?buildId=${response.result?.id}`;
				vscode.env.openExternal(vscode.Uri.parse(buildRunUrl));
			} else {
				vscode.window.showErrorMessage('invoked api with an error: ' + response.statusCode);
			}
		} catch (error: any) {
			const mappedError: PostResultError = error;

			//vscode.window.showErrorMessage('invoked api with an error: ' + mappedError.statusCode, mappedError.message);
			const doc = vscode.window.activeTextEditor?.document;
			if (mappedError.statusCode === 400) {

				var test = /.*\(Line: (\d+).*, Col: (\d+).*/.exec(mappedError.message);
				if (test?.length === 3) {
					var line = parseInt(test[1]);
					var col = parseInt(test[2]);

					const editor = vscode.window.activeTextEditor;
					if (editor && doc) {
						vscode.window.showErrorMessage(`validation showed an Error at ${line}:${col}`, "Jump there").then(t => {
							if (t === "Jump there") {
								vscode.window.showTextDocument(doc);
								const position = editor?.selection.active;
								var newPosition = position?.with(line - 1, col);
								if (newPosition) {
									var newSelection = new vscode.Selection(newPosition, newPosition);
									editor.selection = newSelection;
								}
							}
						});
					}
				} else {
					vscode.window.showErrorMessage('validation showed an Error: ' + mappedError.statusCode + "\r\n" + mappedError.message);
				}
			} else {
				vscode.window.showErrorMessage('validation showed an Error: ' + mappedError.statusCode + "\r\n" + mappedError.message);
			}
		}
	});

	context.subscriptions.push(disposable);
}

function getDevOpsUrlFromRepo() {

	const gitExtension = vscode.extensions?.getExtension<GitExtension>('vscode.git')?.exports;
	if (!gitExtension) {
		vscode.window.showErrorMessage('sorry not able to determine the git path ... expecting it to be in a azure devops git...');
		return;
	}
	const git = gitExtension.getAPI(1);
	const document = vscode.window.activeTextEditor?.document;
	if (!document || !document.uri) {
		vscode.window.showErrorMessage('sorry not able to determine the document uri ... expecting it to be in a azure devops git...');
		return;
	}

	const repository = git.getRepository(document.uri);

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

	return repoUrl;
}

function parseDevOpsUrl(repoUrl: URL) {
	let organisation: string = "";
	let project: string = "";
	if (repoUrl.hostname === "dev.azure.com") {
		organisation = repoUrl.username;
		project = repoUrl.pathname.substring(organisation.length+2, repoUrl.pathname.indexOf('/', organisation.length+2));
	}
	else if (repoUrl.hostname.endsWith("visualstudio.com")) {
		organisation = repoUrl.hostname.substr(0, repoUrl.hostname.indexOf("."));
		project = repoUrl.pathname.substr(1, repoUrl.pathname.indexOf("/", 1) - 1);
		if (project === "DefaultCollection") { project = repoUrl.pathname.substr(19, repoUrl.pathname.indexOf("/", 19) - 19); }
	}

	return { organisation, project };
}

async function getSettingAndPrompt(name: string, title: string, prompt: string, placeHolder: string, defaultValue: string = "") {
	let options: vscode.InputBoxOptions = {
		title,
		prompt,
		placeHolder
	};

	let settingValue = getSetting(name, defaultValue);
	if (!settingValue) {
		const value = await vscode.window.showInputBox(options);
		if (!value) { return; }
		settingValue = value;
		vscode.workspace.getConfiguration("ymlbuildpipelinepreview").update(name, settingValue);
	}
	return settingValue;
}


function getSetting<T>(name: string, defaultValue: T): T {
	return vscode.workspace.getConfiguration("ymlbuildpipelinepreview").get<T>(name, defaultValue);
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

declare interface PostResultError {
	statusCode: number;
	message: string;
	result: {
		$id: number,
		errorcode: number;
		eventId: number;
		innerException: any;
		message: string;
		typeKey: "PipelineValidationException";
		typeName: string;
	}
}