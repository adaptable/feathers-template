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

let { builderType } = appConfig;

// IMPORTANT: Update config.schema.json when the buildpack/nixpacks image changes
// Node, Python, or other runtime versions.
const defaultBuilderImage = "paketobuildpacks/builder:0.2.443-full";
const oldBuilderImage = "paketobuildpacks/builder:0.2.6-full";
const nixpacksVersion = "1.18.0";

const userEnv = appConfig.buildEnvironment || {};

if (tags.includes("go") || tags.includes("php")) {
    if (builderType === "paketo") {
        const msg = `${tags.join("+")} not currently supported with paketo builderType. Use nixpacks instead.`;
        // eslint-disable-next-line no-console
        console.log(msg);
        throw new Error(msg);
    }
    builderType = "nixpacks";
} else if (!builderType) {
    builderType = "paketo";
}

/**
 * @type {import("@adaptable/client/dist/api-types/builds").CreateBuild}
 */
let imageBuildProps;

if (builderType === "paketo") {
    /**
     * @type Record<string, string | undefined>
     */
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

    imageBuildProps = {
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

            // Older builder errors if BP_NODE_RUN_SCRIPTS is the empty string
            if (!env.BP_NODE_RUN_SCRIPTS) delete env.BP_NODE_RUN_SCRIPTS;
        }

        imageBuildProps.config.buildpacks = [
            "paketo-buildpacks/nodejs",
            // buildpack-launch is required for BP_LAUNCH_COMMAND
            "adaptable/buildpack-launch:0.0.7",
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
} else {
    // Nixpacks

    let providers;

    if (tags.includes("nodejs")) providers = ["node"];
    else if (tags.includes("python")) providers = ["python"];
    else if (tags.includes("go")) providers = ["go"];
    else if (tags.includes("php")) providers = ["php"];

    if (tags.includes("php") && !appConfig.startCommand) {
        // This is the same command as nixpacks generates except it uses
        // php-fpm -D instead of backgrounding via shell ("&"). This allows
        // php-fpm to start and background itself so that it is ready to
        // accept connections when nginx is started.
        appConfig.startCommand = "perl /assets/prestart.pl /assets/nginx.template.conf /nginx.conf && (php-fpm -D -y /assets/php-fpm.conf && nginx -c /nginx.conf)";
    }

    const setIfDefined = {
        NIXPACKS_NODE_VERSION: appConfig.nodeVersion,
        NIXPACKS_PYTHON_VERSION: appConfig.pythonVersion,
    };

    const variables = {};

    Object.entries(setIfDefined).forEach(([key, val]) => {
        if (val != null) variables[key] = val;
    });

    /**
     * @type Record<string, any>
     */
    const plan = {
        providers,
        variables,
        phases: {},
    };

    // Install phase
    if (appConfig.installCommand) {
        plan.phases.install = {
            cmds: [appConfig.installCommand],
        };
    }

    // Build phase
    if (appConfig.nodeRunScripts && appConfig.buildCommand) {
        throw new Error(`Cannot specify both nodeRunScripts and buildCommand together`);
    }

    if (appConfig.nodeRunScripts) {
        const cmds = appConfig.nodeRunScripts.split(",").map((s) => `npm run ${s}`);
        plan.phases.build = { cmds };
    } else if (appConfig.buildCommand) {
        plan.phases.build = {
            cmds: [appConfig.buildCommand],
        };
    }

    if (Object.keys(plan.phases).length === 0) delete plan.phases;

    if (appConfig.startCommand) {
        plan.start = {
            cmd: appConfig.startCommand,
        };
    }

    imageBuildProps = {
        appId,
        config: {
            type: "nixpacks",
            version: nixpacksVersion,
            plan,
        },
        env: userEnv,
        imageName: "appimage",
        plan: "hobby",
        revId,
    };
}

if (appConfig.repoSubdir) imageBuildProps.subdir = appConfig.repoSubdir;

module.exports.imageBuildProps = imageBuildProps;
