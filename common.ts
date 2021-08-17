import { EnvSimple } from "@adpt/cloud";
import { loadAdaptableConfig } from "./template-support";

export interface Config {
    environment?: EnvSimple;
}

export const config = loadAdaptableConfig<Config>();
