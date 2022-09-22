// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */

const { loadAdaptableAppConfig } = require("@adaptable/template");

/**
 * @type {import("../common").Config}
 */
const appConfig = loadAdaptableAppConfig();

const appId = process.env.ADAPTABLE_APP_ID;
if (appId == null) throw new Error("No ADAPTABLE_APP_ID found");

const revId = process.env.ADAPTABLE_APPREVISION_ID;
if (revId == null) throw new Error("No ADAPTABLE_APPREVISION_ID");

const tags = (process.env.ADAPTABLE_TEMPLATE_TAGS || "").split(",");

// IMPORTANT: Update config.schema.json when the buildpack image changes
// Node/Python versions.
const defaultBuilderImage = "paketobuildpacks/builder:0.2.182-full";

const userEnv = appConfig.buildEnvironment || {};
const env = {
    // BP_LAUNCH_COMMAND is a JSON-format string
    BP_LAUNCH_COMMAND: JSON.stringify(appConfig.startCommand),
    BP_NODE_PROJECT_PATH: appConfig.projectPath,
    BP_NODE_RUN_SCRIPTS: appConfig.nodeRunScripts,
    BP_NODE_VERSION: appConfig.nodeVersion,
    BP_CPYTHON_VERSION: appConfig.pythonVersion,
    // User can override the top level settings
    ...userEnv,
};

/**
 * @type {import("@adaptable/client/dist/api-types/builds").CreateBuild}
 */
const imageBuildProps = {
    appId,
    config: {
        type: "buildpack",
        builder: defaultBuilderImage,
    },
    env,
    imageName: "appimage",
    plan: "hobby",
    revId,
};
module.exports.imageBuildProps = imageBuildProps;

if (tags.includes("python")) {
    if (appConfig.pythonVersion === "3.6") {
        imageBuildProps.config.builder = "paketobuildpacks/builder:0.2.6-full";
    }

    imageBuildProps.config.buildpacks = [
        "paketo-buildpacks/python",
        // buildpack-launch is required for BP_LAUNCH_COMMAND
        "adaptable/buildpack-launch:0.0.7",
    ];
}
