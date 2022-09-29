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
// major Node versions.
const buildpackImage = "paketobuildpacks/builder:0.2.6-full";
module.exports.buildpackImage = buildpackImage;

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
        builder: buildpackImage,
    },
    env,
    imageName: "appimage",
    plan: "hobby",
    revId,
};
module.exports.imageBuildProps = imageBuildProps;

// This works around the following issues:
//   https://github.com/paketo-buildpacks/python-start/issues/196
//   https://github.com/paketo-buildpacks/python-start/pull/128
// When we update to a version that has both of these fixes integrated,
// this workaround can be removed.
const pythonWorkaround = `#!/bin/sh

touch __adaptable.py
`;

if (tags.includes("python")) {
    imageBuildProps.config.buildpacks = [
        "paketo-buildpacks/python",
        // buildpack-launch is required for BP_LAUNCH_COMMAND
        "adaptable/buildpack-launch:0.0.7",
    ];
    imageBuildProps.config.preBuildScript = pythonWorkaround;
}
