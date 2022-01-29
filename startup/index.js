import apiClient from "@adaptable/client";
import { exit } from "process";

const appId = process.env.ADAPTABLE_APP_ID;
if (appId == null) throw new Error("No ADAPTABLE_APP_ID found");

const revId = process.env.ADAPTABLE_APPREVISION_ID;
if (revId == null) throw new Error("No ADAPTABLE_APPREVISION_ID");

const imageBuildProps = {
    appId,
    config: {
        type: "buildpack",
        builder: "paketobuildpacks/builder:full",
    },
    imageName: "appimage",
    plan: "hobby",
    revId,
};

// This will initiate a build with the same parameters that adapt will use
// When adapt sees the build already in progress, it will adopt the build
// as its own.
// However, the build will have started in parallel with the adapt startup
// reducing the total time to app ready.
async function doBuild(props) {
    const client = await apiClient.default();
    await client.service("builds").create(imageBuildProps);
}

doBuild(imageBuildProps)
    .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e.message);
        process.exit(1);
    });
