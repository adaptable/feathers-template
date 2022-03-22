import { loadAdaptableAppConfig } from "@adaptable/template";
import { EnvSimple } from "@adpt/cloud";

export interface Config {
    environment?: EnvSimple;
    databaseType: "mongodb" | "mssql";
}

export const config = loadAdaptableAppConfig<Config>();
