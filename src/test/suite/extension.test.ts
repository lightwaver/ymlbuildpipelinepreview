import * as assert from 'assert';
import { parseDevOpsUrl } from '../../extension';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { URL } from 'url';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('parseUrl', () => {
		const result = parseDevOpsUrl(new URL("https://dev.azure.com/organisation/project/"));
		assert.strictEqual(result.organisation, "organisation");
		assert.strictEqual(result.project, "project");
	});
});
