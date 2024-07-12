// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */

const { loadAdaptableAppConfig } = require("@adaptable/template");
const { certBundle1, getEnv, REQUIRED } = require("@adaptable/utils");

// A little duplicated from @adaptable/cloud but adding that lib causes
// weird errors.
const adaptableDomainName = getEnv("ADAPTABLE_DOMAIN_NAME", REQUIRED);
const appId = getEnv("ADAPTABLE_APP_ID", REQUIRED);
const appName = getEnv("ADAPTABLE_APP_NAME", REQUIRED);
const revId = getEnv("ADAPTABLE_APPREVISION_ID", REQUIRED);

const externalHostname = `${appName}.${adaptableDomainName}`;
const externalUrl = `https://${externalHostname}`;

/**
 * @typedef {import("../common").Config} AppConfig
 * @typedef {import("../common").BuilderType} BuilderType
 * @typedef {import("@adaptable/client/dist/api-types/builds").CreateBuild} CreateBuild
 * @typedef {CreateBuild["config"]} BuildConfig
 *
 * @typedef {object} BuildInfo
 * @property {BuildConfig} config
 * @property {Record<string, string | undefined>} env
 * @property {Record<string, unknown>} extraBuildProps
 */

// IMPORTANT: Update config.schema.json when the buildpack/nixpacks image changes
// Node, Python, or other runtime versions.
const defaultBuilderImage = "paketobuildpacks/builder:0.2.443-full";
const oldBuilderImage = "paketobuildpacks/builder:0.2.6-full";

// Versions:
// - Go: 1.18-1.22 (defaults to 1.22 on version mismatch)
// - Node: 18, 20, 22
// - PHP: 8.1-8.3
// - Python: 3.7-3.12
const nixpacksCurrentVersion = "1.24.1";

// Last version to support Node 16
const nixpacksOldVersion = "1.21.3";

/**
 * @param {Record<string, string | undefined>} obj
 * @returns {Record<string, string>}
 */
function stripUndef(obj) {
    /** @type Record<string, string> */
    const ret = {};

    Object.entries(obj).forEach(([key, val]) => {
        if (val != null) ret[key] = val;
    });

    return ret;
}

/**
 * @param {AppConfig} appConfig
 * @param {string[]} tags
 * @returns {BuildInfo}
 */
function paketoBuilder(appConfig, tags) {
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
    };

    /**
     * @type BuildConfig
     */
    const config = {
        type: "buildpack",
        builder: defaultBuilderImage,
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
            config.builder = oldBuilderImage;

            // Older builder errors if BP_NODE_RUN_SCRIPTS is the empty string
            if (!env.BP_NODE_RUN_SCRIPTS) delete env.BP_NODE_RUN_SCRIPTS;
        }

        config.buildpacks = [
            "paketo-buildpacks/nodejs",
            // buildpack-launch is required for BP_LAUNCH_COMMAND
            "adaptable/buildpack-launch:0.0.7",
        ];
    } else if (tags.includes("python")) {
        // Use the older builder for versions < 3.10
        if (["3.6", "3.7", "3.8", "3.9"].includes(appConfig.pythonVersion || "")) {
            config.builder = oldBuilderImage;

            // Workaround is only required for the older builder
            config.preBuildScript = pythonWorkaround;
        }

        config.buildpacks = [
            "paketo-buildpacks/python",
            // buildpack-launch is required for BP_LAUNCH_COMMAND
            "adaptable/buildpack-launch:0.0.7",
        ];
    }

    if (appConfig.projectPath != null
        && appConfig.repoSubdir != null
        && appConfig.projectPath !== appConfig.repoSubdir) {
        throw new Error("If both projectPath and repoSubdir are specified, they must be the same");
    }

    return {
        config,
        env,
        extraBuildProps: {},
    };
}

/**
 * @param {AppConfig} appConfig
 * @param {string[]} tags
 * @returns {BuildInfo}
 */
function dockerfileBuilder(appConfig, tags) {
    /** @type BuildConfig */
    const config = {
        type: "dockerfile",
    };
    if (appConfig.dockerfile) config.dockerfile = appConfig.dockerfile;

    return {
        config,
        env: {},
        extraBuildProps: {
            ...(appConfig.repoSubdir ? { subdir: appConfig.repoSubdir } : {}),
        },
    };
}

/**
 * @param {AppConfig} appConfig
 * @param {string[]} tags
 * @returns {BuildInfo}
 */
function nixpacksBuilder(appConfig, tags) {
    const providers = [];
    let version = nixpacksCurrentVersion;

    if (tags.includes("nodejs") || appConfig.nodeVersion) providers.push("node");
    if (tags.includes("python") || appConfig.pythonVersion) providers.push("python");
    if (tags.includes("go")) providers.push("go");
    if (tags.includes("php")) providers.push("php");

    const variables = stripUndef({
        NIXPACKS_NODE_VERSION: appConfig.nodeVersion,
        NIXPACKS_PYTHON_VERSION: appConfig.pythonVersion,
        // Ensure HOME is set correctly. The built image doesn't seem to contain
        // an explicit setting and Kubernetes' runtime seems to default to
        // using /home, which is different from Docker which defaults to /root.
        HOME: "/root",
    });

    if (tags.includes("php") && !appConfig.startCommand) {
        // This is the same command as nixpacks generates except it uses
        // php-fpm -D instead of backgrounding via shell ("&"). This allows
        // php-fpm to start and background itself so that it is ready to
        // accept connections when nginx is started.
        appConfig.startCommand = "node /assets/scripts/prestart.mjs /assets/nginx.template.conf /nginx.conf && (php-fpm -D -y /assets/php-fpm.conf && nginx -c /nginx.conf)";
    }

    if (tags.includes("laravel")) {
        variables.APP_URL = externalUrl;
        variables.ASSET_URL = externalUrl;
    }

    if (tags.includes("nodejs")) {
        switch (appConfig.nodeVersion) {
            case "12":
            case "14":
                throw new Error(`builderType nixpacks does not support Node v${appConfig.nodeVersion}. Use builderType paketo.`);
            case "16":
                version = nixpacksOldVersion;
                break;
            default:
                // Normal case
                break;
        }
    }

    if (tags.includes("python")) {
        switch (appConfig.pythonVersion) {
            case "3.6":
                throw new Error(`builderType nixpacks does not support Python v${appConfig.pythonVersion}. Use builderType paketo.`);
            default:
                // Normal case
                break;
        }
    }

    /**
     * @type Record<string, any>
     */
    const plan = {
        providers,
        variables,
        phases: {},
    };

    // Adaptable setup
    plan.phases.asetup = {
        onlyIncludeFiles: [
            certBundle1.imagePathRel,
        ],
        cmds: [
            `cp ${certBundle1.imagePathRel} /usr/local/share/ca-certificates/adaptable1.crt && update-ca-certificates`,
        ],
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

    let subdir;
    if (appConfig.projectPath != null
        || appConfig.repoSubdir != null) {
        if (appConfig.projectPath != null
            && appConfig.repoSubdir != null
            && appConfig.projectPath !== appConfig.repoSubdir) {
            throw new Error("If both projectPath and repoSubdir are specified, they must be the same");
        }
        subdir = appConfig.repoSubdir ?? appConfig.projectPath;
    }

    return {
        config: {
            type: "nixpacks",
            version,
            plan,
        },
        env: {},
        extraBuildProps: { ...(subdir != null ? { subdir } : {}) },
    };
}

/**
 * @type {Record<BuilderType, (ac: AppConfig, tags: string[]) => BuildInfo>}
 */
const builders = {
    dockerfile: dockerfileBuilder,
    nixpacks: nixpacksBuilder,
    paketo: paketoBuilder,
};

/**
 * @returns {BuilderType}
 */
function getBuilderType() {
    /**
     * @type {AppConfig}
     */
    const appConfig = loadAdaptableAppConfig();
    const { builderType } = appConfig;
    const tags = (process.env.ADAPTABLE_TEMPLATE_TAGS || "").split(",");

    if (tags.includes("go") || tags.includes("php")) {
        if (builderType === "paketo") {
            const msg = `${tags.join("+")} not currently supported with paketo builderType. Use nixpacks instead.`;
            // eslint-disable-next-line no-console
            console.log(msg);
            throw new Error(msg);
        }
        return "nixpacks";
    }
    if (tags.includes("dockerfile")) {
        return "dockerfile";
    }
    if (!builderType) {
        return "paketo";
    }
    return builderType;
}

/**
 * @returns {CreateBuild}
 */
function makeBuildProps() {
    /**
     * @type {AppConfig}
     */
    const appConfig = loadAdaptableAppConfig();

    const tags = (process.env.ADAPTABLE_TEMPLATE_TAGS || "").split(",");

    const userEnv = appConfig.buildEnvironment || {};

    const builderType = getBuilderType();

    const builder = builders[builderType];
    if (!builder) throw new Error(`Internal error: no builder for '${builderType}'`);

    const { config, env, extraBuildProps } = builder(appConfig, tags);

    /** @type {CreateBuild} */
    const imageBuildProps = {
        appId,
        config,
        env: {
            ...stripUndef(env),
            // User can override builder env
            ...userEnv,
        },
        imageName: "appimage",
        plan: "hobby",
        revId,
        ...extraBuildProps,
    };

    return imageBuildProps;
}

/**
 * @returns {Record<string,string|undefined>}
 */
function makeAdaptEnv() {
    /**
     * @type {Record<string,string|undefined>}
     */
    const env = {};

    const builderType = getBuilderType();

    switch (builderType) {
        case "dockerfile":
            env.IMAGE_WORKSPACE_DIR = "/";
            break;
        case "nixpacks":
            env.IMAGE_WORKSPACE_DIR = "/app";
            break;
        case "paketo":
            env.IMAGE_WORKSPACE_DIR = "/workspace";
            break;
        default:
            throw new Error(`Unhandled builderType '${builderType}'`);
    }

    return env;
}

module.exports.imageBuildProps = makeBuildProps();
module.exports.adaptEnv = makeAdaptEnv();
