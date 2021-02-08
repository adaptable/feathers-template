import temp from "temp";
import * as fs from "fs";
import { loadAdaptableConfig } from "./template-support";

temp.track();

export interface GCloudConfig {
    projectId: string;
    creds: string;
    region: string;
}

export interface Config {
    gcloud: GCloudConfig;
}

function setupGCloud(config: GCloudConfig) {
    process.env.CLOUDSDK_CORE_PROJECT = config.projectId;

    let account;
    try {
        const key = JSON.parse(config.creds);
        account = key.client_email;
    } catch (err) {
        throw new Error(`Error parsing gcloud.creds (must be JSON service account key file): ${err.message}`);
    }
    if (!account) throw new Error(`Invalid service account key JSON in gcloud.creds: "client_email" property not valid`);
    process.env.CLOUDSDK_CORE_ACCOUNT = account;

    const credsFile = temp.openSync({ prefix: "gcloud-creds-", suffix: ".json" });
    fs.writeSync(credsFile.fd, config.creds);
    fs.closeSync(credsFile.fd);
    process.env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE = credsFile.path;
}

export const config = loadAdaptableConfig<Config>();
setupGCloud(config.gcloud);
