import { loadAdaptableAppConfig } from "@adaptable/template";
import { EnvSimple } from "@adpt/cloud";

export interface Config {
    buildEnvironment?: EnvSimple;
    databaseType: "mongodb" | "mssql";
    environment?: EnvSimple;
    nodeRunScripts?: string;
    nodeStartScript?: "start";
    nodeVersion?: string;
    projectPath?: string;
}

export const config = loadAdaptableAppConfig<Config>();
