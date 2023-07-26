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
const defaultBuilderImage = "paketobuildpacks/builder:0.2.443-full";
const oldBuilderImage = "paketobuildpacks/builder:0.2.6-full";

const userEnv = appConfig.buildEnvironment || {};
const env = {
    // BP_LAUNCH_COMMAND is a JSON-format string
    BP_LAUNCH_COMMAND: JSON.stringify(appConfig.startCommand),
    BP_NODE_PROJECT_PATH: appConfig.projectPath,
    // The default in newer buildpacks is to run the "build" script if
    // BP_NODE_RUN_SCRIPTS is not set. We want to disable that default, so
    // set to empty string when nodeRunScripts is falsey.
    BP_NODE_RUN_SCRIPTS: appConfig.nodeRunScripts || "",
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

// This works around the following issues:
//   https://github.com/paketo-buildpacks/python-start/issues/196
//   https://github.com/paketo-buildpacks/python-start/pull/128
// When we update to a version that has both of these fixes integrated,
// this workaround can be removed.
const pythonWorkaround = `#!/bin/sh

touch __adaptable.py
`;

if (tags.includes("nodejs")) {
    // Use the older builder for versions < 18
    if (["12", "14", "16"].includes(appConfig.nodeVersion || "")) {
        imageBuildProps.config.builder = oldBuilderImage;
    }

    imageBuildProps.config.buildpacks = [
        "paketo-buildpacks/nodejs",
    ];
} else if (tags.includes("python")) {
    // Use the older builder for versions < 3.10
    if (["3.6", "3.7", "3.8", "3.9"].includes(appConfig.pythonVersion || "")) {
        imageBuildProps.config.builder = oldBuilderImage;

        // Workaround is only required for the older builder
        imageBuildProps.config.preBuildScript = pythonWorkaround;
    }

    imageBuildProps.config.buildpacks = [
        "paketo-buildpacks/python",
        // buildpack-launch is required for BP_LAUNCH_COMMAND
        "adaptable/buildpack-launch:0.0.7",
    ];
}
