# ymlbuildpipelinepreview README

Yaml BuildPipeLine Preview is a small extension to check the syntax and "runabilitly" for a pipeline.

## Features

It adds a ability to test your current yaml - pipeline file with the preview api from azure devops to check the syntax of your file - **without need to check it in or run a real build/release**

You just need to open up the yml file and select the command in the context menu or the commandlist



## Requirements

You need a azure devOps project and a created pipeline in the specific project you want to run it in.

Additionally the App needs an Personal Access Token to invoke the API.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `ymlbuildpipelinepreview.devOpsApiPAT`: Personal Access Token for invoking the API
* `ymlbuildpipelinepreview.pipelineID`: Pipeline ID to be used for simulating the pipeline run
* `ymlbuildpipelinepreview.azureDevOpsUrl`: devOps Url where your project and pipelines are hosted.
   if hosted in an azure devops git repo the extension tries to identifiy it from there.

if the settings are not set you get asked on the first run of the extension in your project.

## Known Issues

none so far but you are in the early stage of development 😅.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of it :P

