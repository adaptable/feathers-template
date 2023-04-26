import { loadAdaptableAppConfig } from "@adaptable/template";
import { EnvSimple } from "@adpt/cloud";

export interface ConfigDomain {
    name?: string;
    domainName: string;
    endpoint?: string;
}

export type ConfigDomains = ConfigDomain[];

export interface Config {
    buildEnvironment?: EnvSimple;
    databaseType: "mongodb" | "mssql" | "none" | "postgres";
    domains: ConfigDomains;
    environment?: EnvSimple;
    nodeRunScripts?: string;
    nodeStartScript?: "start";
    nodeVersion?: string;
    projectPath?: string;
    pythonVersion?: string;
    startCommand?: string;
}

export const config = loadAdaptableAppConfig<Config>();
