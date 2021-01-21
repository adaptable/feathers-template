import { loadAdaptableConfig } from "./template-support";

export interface GCloudConfig {
    projectId: string;
    creds: string;
    region: string;
}

export interface Config {
    gcloud: GCloudConfig;
}

export const config = loadAdaptableConfig<Config>();
