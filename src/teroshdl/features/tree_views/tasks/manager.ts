// Copyright 2023
// Carlos Alberto Ruiz Naranjo [carlosruiznaranjo@gmail.com]
// Ismael Perez Rojo [ismaelprojo@gmail.com]
//
// This file is part of TerosHDL
//
// Colibri is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Colibri is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with TerosHDL.  If not, see <https://www.gnu.org/licenses/>.

import * as vscode from "vscode";
import * as element from "./element";
import { Multi_project_manager } from 'colibri/project_manager/multi_project_manager';
import { Task, TaskDecorator } from "./element";
import { ChildProcess, spawn } from "child_process";
import { LogView } from "../../views/logs";
import * as tree_kill from 'tree-kill';
import { BaseView } from "../baseView";
import { e_viewType } from "../common";
import { getFamilyDeviceFromQuartusProject, get_icon } from "../utils";
import { toolLogger } from "../../../logger";
import { openRTLAnalyzer } from "./quartus_utils";
import { TimingReportView } from "../../views/timing/timing_report";
import { runSandpiperConversion, runSandpiperDiagramGeneration, runSandpiperNavTlvGeneration } from './sandpiper_utils';
import { ProjectEmitter } from "colibri/project_manager/projectEmitter";
import { e_artifact_type, e_element_type, e_reportType, e_taskState, e_taskType, terminalTypeMap } from "colibri/project_manager/tool/common";
import { check_if_path_exist } from "colibri/utils/file_utils";
import { p_result } from "colibri/process/common";

enum e_VIEW_STATE {
    IDLE = 0,
    RUNNING = 1,
    FINISHED = 2,
    FAILED = 3
}

export class Tasks_manager extends BaseView {
    private tree: element.ProjectProvider;
    private project_manager: Multi_project_manager;
    private state: e_VIEW_STATE = e_VIEW_STATE.IDLE;
    private latesRunTask: ChildProcess | undefined = undefined;
    private latestTask: e_taskType | undefined | string = undefined;
    private logView: LogView;
    private statusBar: vscode.StatusBarItem | undefined = undefined;
    private emitterProject: ProjectEmitter;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Constructor
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(context: vscode.ExtensionContext, manager: Multi_project_manager, logView: LogView,
        emitterProject: ProjectEmitter, timingReportView: TimingReportView) {

        super(e_viewType.TASKS);

        this.set_commands();

        this.project_manager = manager;
        this.tree = new element.ProjectProvider(manager);
        this.logView = logView;
        this.emitterProject = emitterProject;

        const provider = new TaskDecorator();
        context.subscriptions.push(vscode.window.registerFileDecorationProvider(provider));

        context.subscriptions.push(vscode.window.registerTreeDataProvider(element.ProjectProvider.getViewID(),
            this.tree as unknown as element.BaseTreeDataProvider<element.Task>));
    }

    /**
     * Sets up the commands for the task manager.
     */
    set_commands() {
        vscode.commands.registerCommand("teroshdl.view.tasks.report", async (item) =>
            await this.openReport(item, e_reportType.REPORT));
        vscode.commands.registerCommand("teroshdl.view.tasks.timing_analyzer", async (item) =>
            await this.openReport(item, e_reportType.TIMINGANALYZER));
        vscode.commands.registerCommand("teroshdl.view.tasks.technology_map_viewer", async (item) =>
            await this.openReport(item, e_reportType.TECHNOLOGYMAPVIEWER));
        vscode.commands.registerCommand("teroshdl.view.tasks.snapshotviewer", async (item) =>
            await this.openReport(item, e_reportType.SNAPSHOPVIEWER));
        vscode.commands.registerCommand("teroshdl.view.tasks.logs", async (item) =>
            await this.openReport(item, e_reportType.REPORTDB));

        vscode.commands.registerCommand("teroshdl.view.tasks.stop", () => this.stop());
        vscode.commands.registerCommand("teroshdl.view.tasks.run", (item) => this.run(item));
        vscode.commands.registerCommand("teroshdl.view.tasks.clean", () => this.clean());
        vscode.commands.registerCommand("teroshdl.view.tasks.device", () => this.device());
        vscode.commands.registerCommand("teroshdl.view.tasks.console", () => this.openConsole());


        // Quartus Commands
        vscode.commands.registerCommand("teroshdl.project.quartus.rtlAnalyzer",
            () => this.runQuartusTask(e_taskType.QUARTUS_RTL_ANALYZER));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.compileDesigh",
            () => this.runQuartusTask(e_taskType.QUARTUS_COMPILEDESIGN));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.analysisAndSynthesis",
            () => this.runQuartusTask(e_taskType.QUARTUS_ANALYSISSYNTHESIS));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.analysisAndElaboration",
            () => this.runQuartusTask(e_taskType.QUARTUS_ANALYSISELABORATION));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.synthesis",
            () => this.runQuartusTask(e_taskType.QUARTUS_SYNTHESIS));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.earlyTimingAnalysis",
            () => this.runQuartusTask(e_taskType.QUARTUS_EARLYTIMINGANALYSIS));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.fitter",
            () => this.runQuartusTask(e_taskType.QUARTUS_FITTER));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.fitterImplement",
            () => this.runQuartusTask(e_taskType.QUARTUS_FITTERIMPLEMENT));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.plan",
            () => this.runQuartusTask(e_taskType.QUARTUS_PLAN));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.place",
            () => this.runQuartusTask(e_taskType.QUARTUS_PLACE));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.route",
            () => this.runQuartusTask(e_taskType.QUARTUS_ROUTE));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.fitterFinalize",
            () => this.runQuartusTask(e_taskType.QUARTUS_FITTERFINALIZE));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.timingAnalysisSignoff",
            () => this.runQuartusTask(e_taskType.QUARTUS_TIMING));
        
        vscode.commands.registerCommand("teroshdl.project.quartus.assembler",
            () => this.runQuartusTask(e_taskType.QUARTUS_ASSEMBLER));
    }

    private runQuartusTask(task: e_taskType) {
        const allTaskItems = <element.Task[]>this.tree.data;
        function searchTask(taskItesm: element.Task[]) {
            for (const taskItem of taskItesm) {
                if (taskItem.taskDefinition.name === task) {
                    return taskItem;
                }
                if (taskItem.children) {
                    const result = searchTask(taskItem.children);
                    if (result) {
                        return result;
                    }
                }
            }
        }
        const taskItem = searchTask(allTaskItems);
        if (taskItem) {
            this.run(taskItem);
        }
    }

    /**
     * Stops the latest run task if it is still running.
     */
    stop() {
        if (this.latesRunTask && !this.latesRunTask.killed) {
            try {
                const pid = this.latesRunTask.pid;
                if (pid === undefined) {
                    return;
                }
                tree_kill(pid, 'SIGTERM', (err) => {
                    if (err) {
                        console.error(err);
                    } else {
                        toolLogger.warn(`${this.latestTask} stopped.`);
                        vscode.window.showInformationMessage(`${this.latestTask} stopped successfully.`);
                    }
                });
            } catch (error) {
                console.log(error);
            }
        }
    }

    async run(taskItem: element.Task) {
        if (taskItem.taskDefinition.name === e_taskType.QUARTUS_RTL_ANALYZER) {
            openRTLAnalyzer(this.project_manager, this.emitterProject);
            return;
        }
        if ( taskItem.taskDefinition.name === e_taskType.SANDPIPER_TLVERILOGTOVERILOG ) {
            await runSandpiperConversion(this.project_manager, this.emitterProject);
            return;
        }
        if (taskItem.taskDefinition.name === e_taskType.SANDPIPER_DIAGRAM_TAB) {
            await runSandpiperDiagramGeneration(this.project_manager, this.emitterProject);
            return;
        }
        if (taskItem.taskDefinition.name === e_taskType.SANDPIPER_NAV_TLV_TAB) {
            await runSandpiperNavTlvGeneration(this.project_manager, this.emitterProject);
            return;
        }
        if (this.checkRunning()) {
            return;
        }
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        try {
            const selectedProject = this.project_manager.get_selected_project();

            const task = taskItem.taskDefinition.name;
            const taskStatus = selectedProject.getTaskState(task);

            if (taskStatus === e_taskState.FINISHED) {
                const msg = `${taskItem.taskDefinition.name} has already run successfully. Do you want to run the task again?`;
                const result = await vscode.window.showInformationMessage(
                    msg,
                    'Yes',
                    'No'
                );
                if (result === 'No') {
                    return;
                }
            }

            this.state = e_VIEW_STATE.RUNNING;

            this.setStatusBarText(undefined);
            this.statusBar.show();

            const exec_i = selectedProject.runTask(task, (result: p_result) => {
                this.hideStatusBar();
                this.state = e_VIEW_STATE.IDLE;
                // Refresh view to set the finish decorators
                this.refresh_tree();
            });
            this.latesRunTask = exec_i;
            this.latestTask = taskItem.taskDefinition.name;
            // Refresh view to set the running decorators
            this.refresh_tree();

                toolLogger.show(true);
                if (exec_i.stdout) {
                    exec_i.stdout.on('data', (data: string) => {
                        const cleanOutput = data.replace(/File: /g, "file://");
                        toolLogger.log(cleanOutput);
                    });
                }

                if (exec_i.stderr) {
                    exec_i.stderr.on('data', (data: string) => {
                        const cleanOutput = data.replace(/File: /g, "file://");
                        toolLogger.log(cleanOutput);
                    });
                }
        }
        catch (error) {
            // Refresh view to set the finish decorators
            this.refresh_tree();
            this.hideStatusBar();
            this.state = e_VIEW_STATE.IDLE;
        }
    }

    async openConsole() {
        try {
            const selectedProject = this.project_manager.get_selected_project();

            const terminalTypeList = [...terminalTypeMap.keys()];
            const pickerValue = await vscode.window.showQuickPick(terminalTypeList, {
                placeHolder: "Select the Shell.",
            });

            if (pickerValue === undefined) {
                return;
            }

            const consoleDefinition = selectedProject.getTerminalCommand(
                terminalTypeMap.get(pickerValue) as string
            );
            if (!consoleDefinition) {
                return;
            }
            const terminal = vscode.window.createTerminal({
                name: consoleDefinition.name,
                shellPath: consoleDefinition.command,
                shellArgs: consoleDefinition.options,
                isTransient: true,
                iconPath: {
                    light: get_icon(consoleDefinition.iconName).light,
                    dark: get_icon(consoleDefinition.iconName).dark,
                }
            });
            terminal.show();
            terminal.sendText(consoleDefinition.postCommand);
        }
        catch (error) {
            return;
        }
    }

    async device() {
        const selectedProject = this.project_manager.get_selected_project();
        const config = selectedProject.get_config();
        const family = config.tools.quartus.family;
        const device = config.tools.quartus.device;

        const msg = `Family: ${family}\nDevice: ${device}\n. Do you want to change it?`;
        const result = await vscode.window.showInformationMessage(
            msg,
            'Yes',
            'No'
        );
        if (result === 'No') {
            return;
        }

        const deviceFamily = await getFamilyDeviceFromQuartusProject(this.project_manager, this.emitterProject);
        if (deviceFamily !== undefined &&
            deviceFamily.family !== "" && deviceFamily.device !== ""
            && deviceFamily.family !== undefined && deviceFamily.device !== undefined &&
            deviceFamily.family !== family && deviceFamily.device !== device) {
            config.tools.quartus.family = deviceFamily.family;
            config.tools.quartus.device = deviceFamily.device;
            selectedProject.set_config(config);
        }
    }

    async clean() {
        if (this.checkRunning()) {
            return;
        }

        const msg = "Do you want to clean the project? Cleaning revisions removes the project database and other files generated by the Quartus Prime Software, including report and programming files.";
        const result = await vscode.window.showInformationMessage(
            msg,
            'Yes',
            'No'
        );

        if (result === 'Yes') {
            this.state = e_VIEW_STATE.RUNNING;

            this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
            this.setStatusBarText("Clean Project");
            this.statusBar.show();
            try {
                const selectedProject = this.project_manager.get_selected_project();
                const exec_i = selectedProject.cleallAllProject((result: p_result) => {
                    this.hideStatusBar();
                    this.state = e_VIEW_STATE.IDLE;
                    // Refresh view to set the finish decorators
                    this.refresh_tree();
                });

                // Refresh view to set the running decorators
                this.refresh_tree();

                toolLogger.show(true);
                if (exec_i.stdout) {
                    exec_i.stdout.on('data', (data: string) => {
                        toolLogger.log(data);
                    });
                }

                if (exec_i.stderr) {
                    exec_i.stderr.on('data', (data: string) => {
                        toolLogger.log(data);
                    });
                }
            }
            catch (error) { }
            finally {
                this.hideStatusBar();
                this.state = e_VIEW_STATE.IDLE;
                // Refresh view to set the finish decorators
                this.refresh_tree();
            }
        }
    }

    /**
     * Checks if there is a task currently running.
     * 
     * @returns {boolean} Returns true if there is a task running, otherwise false.
     */
    checkRunning() {
        if (this.state === e_VIEW_STATE.RUNNING) {
            vscode.window.showInformationMessage("There is a task running. Please wait until it finishes.");
            return true;
        }
        return false;
    }

    async openReport(taskItem: element.Task, reportType: e_reportType) {
        const selectedProject = this.project_manager.get_selected_project();
        const task = taskItem.taskDefinition.name;
        const report = await selectedProject.getArtifact(task, reportType);
        if (reportType === e_reportType.TECHNOLOGYMAPVIEWER) {
            vscode.window.showWarningMessage("Technology Map Viewer is not supported yet.");
            return;
        }
        else if (reportType === e_reportType.SNAPSHOPVIEWER) {
            vscode.window.showWarningMessage("Snapshop Viewer is not supported yet.");
            return;
        }

        if (report.artifact_type === e_artifact_type.COMMAND) {
            // shelljs.exec(report.command, { async: true, cwd: report.path });
            spawn(report.command, {
                shell: true,
                cwd: report.path,
                stdio: 'inherit'
            });
        }
        if (report.artifact_type === e_artifact_type.SUMMARY
            && report.element_type === e_element_type.TEXT_FILE) {
            if (!check_if_path_exist(report.path)) {
                toolLogger.show();
                toolLogger.warn(`The report ${report.path} does not exist.`);
                vscode.window.showWarningMessage("The report does not exist.");
                return;
            }
            vscode.window.showTextDocument(vscode.Uri.file(report.path));
        }
        if (report.artifact_type === e_artifact_type.SUMMARY
            && report.element_type === e_element_type.HTML) {
            const content = report.content;
            vscode.commands.executeCommand('teroshdl.openwebview', content);
        }

        if (report.artifact_type === e_artifact_type.LOG
            && report.element_type === e_element_type.DATABASE) {
            if (!check_if_path_exist(report.path)) {
                toolLogger.show();
                toolLogger.warn(`The report ${report.path} does not exist.`);
                vscode.window.showWarningMessage("The report database does not exist.");
                return;
            }
            this.logView.sendLogs(report.path);
        }
    }

    setStatusBarText(text: string | undefined) {
        if (this.statusBar !== undefined) {
            if (text === undefined) {
                this.statusBar.text = `$(sync~spin) Running Quartus task...`;
            }
            else {
                this.statusBar.text = `$(sync~spin) Running Quartus task: ${text}...`;
            }
        }
    }

    hideStatusBar() {
        if (this.statusBar !== undefined) {
            this.statusBar.hide();
        }
    }

    refresh_tree() {
        const selected_project = this.project_manager.get_selected_project();
        const currentTask = selected_project.getTaskStatus().currentTask;
        if (currentTask !== undefined && this.statusBar !== undefined) {
            this.setStatusBarText(currentTask);
        }
        this.tree.refresh();
    }
}

function showTaskWarningMessage(task: string) {
    vscode.window.showWarningMessage(`The task ${task} has not finished yet. Please wait until it finishes to open the report.`);
}