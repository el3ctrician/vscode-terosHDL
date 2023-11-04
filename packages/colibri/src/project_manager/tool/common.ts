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

import { e_config } from "../../config/config_declaration";
import { t_file } from "../common";

export interface TestItem {
    test_type: string | undefined,
    location: {
        file_name: string;
        length: number;
        offset: number;
    } | undefined;
    name: string;
}

/** Character location */
export type t_location = {
    filename: string;
    length: number;
    offset: number;
}

/** Test declaration */
export type t_test_declaration = {
    suite_name: string;
    /** Test name */
    name: string;
    /** Test type */
    test_type: string;
    /** Filename */
    filename: string;
    /** Test location */
    location: t_location | undefined;
}

/** Artifact type */
export enum e_artifact_type {
    CONSOLE_LOG = "console_log",
    SUMMARY = "summary",
    OTHER = "other",
    WAVEFORM = "waveform",
    BUILD = "folder"
}

/** File type */
export enum e_element_type {
    HTML_FILE = "html_file",
    TEXT_FILE = "text_file",
    HTML = "html",
    TEXT = "text",
    FILE = "file",
    FOLDER = "folder",
    FST = "fst",
}

/** Test artifact */
export type t_test_artifact = {
    /** Artifact name */
    name: string;
    /** Artifact path */
    path: string;
    /** If associated command */
    command: string;
    /** Type of artifact */
    artifact_type: e_artifact_type,
    /** Type of file */
    element_type: e_element_type,
    content: string | undefined
}

/** Test result */
export type t_test_result = {
    suite_name: string;
    /** Test name */
    name: string;
    config: e_config;
    edam: any;
    config_summary_path: string;
    /** Artifact generated by the test. E.g: binary, HTML result */
    artifact: t_test_artifact[];
    /** True if test pass */
    successful: boolean;
    build_path: string;
    stdout: string;
    stderr: string;
    time: number;
    test_path: string;
}

export enum e_clean_step {
    Analyze = "Analyze",
    Synthesize = "Synthesize",
    Packing = "Packing",
    Place = "Place",
    Route = "Route",
    Sta = "Sta",
    Bitstream = "Bitstream"
}

export type t_board_list = {
    family: string;
    part_list: string[];
}

export type t_loader_boards_result = {
    board_list: t_board_list[];
    successful: boolean;
    msg: string;
}

export type t_loader_file_list_result = {
    file_list: t_file[];
    successful: boolean;
    msg: string;
}

export type t_loader_prj_info_result = {
    prj_name: string;
    prj_revision: string;
    prj_top_entity: string;
    successful: boolean;
    msg: string;
}

export type t_loader_action_result = {
    successful: boolean;
    msg: string;
}