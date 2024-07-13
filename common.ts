import { ResourceConfig } from "@adaptable/cloud";
import { loadAdaptableAppConfig } from "@adaptable/template";
import { EnvSimple } from "@adpt/cloud";

export interface ConfigDomain {
    name?: string;
    domainName: string;
    endpoint?: string;
}

export type ConfigDomains = ConfigDomain[];

export type BuilderType = "paketo" | "dockerfile" | "nixpacks";

export interface StaticConfig {
    root: string;
    singlePageApp?: boolean;
}

export interface Config {
    buildCommand?: string;
    buildEnvironment?: EnvSimple;
    builderType?: BuilderType;
    databaseType: "mongodb" | "mssql" | "none" | "postgres";
    dockerfile?: string;
    domains: ConfigDomains;
    environment?: EnvSimple;
    installCommand?: string;
    nodeRunScripts?: string;
    nodeStartScript?: "start";
    nodeVersion?: string;
    projectPath?: string;
    pythonVersion?: string;
    repoSubdir?: string;
    resourceConfig?: ResourceConfig;
    startCommand?: string;
    static?: StaticConfig;
}

export const config = loadAdaptableAppConfig<Config>();
