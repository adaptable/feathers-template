import { loadAdaptableAppConfig } from "@adaptable/template";
import { EnvSimple } from "@adpt/cloud";

export interface ConfigDomain {
    name?: string;
    domainName: string;
    endpoint?: string;
}

export type ConfigDomains = ConfigDomain[];

export interface Config {
    buildCommand?: string;
    buildEnvironment?: EnvSimple;
    builderType?: "paketo" | "nixpacks";
    databaseType: "mongodb" | "mssql" | "none" | "postgres";
    domains: ConfigDomains;
    environment?: EnvSimple;
    installCommand?: string;
    nodeRunScripts?: string;
    nodeStartScript?: "start";
    nodeVersion?: string;
    projectPath?: string;
    pythonVersion?: string;
    repoSubdir?: string;
    startCommand?: string;
}

export const config = loadAdaptableAppConfig<Config>();
