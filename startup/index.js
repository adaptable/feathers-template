/* eslint-disable @typescript-eslint/no-var-requires */
const { default: apiClient } = require("@adaptable/client");
const { imageBuildProps } = require("./buildInfo");

// This will initiate a build with the same parameters that adapt will use
// When adapt sees the build already in progress, it will adopt the build
// as its own.
// However, the build will have started in parallel with the adapt startup
// reducing the total time to app ready.
async function doBuild(props) {
    const client = await apiClient();
    await client.service("builds").create(props);
}

doBuild(imageBuildProps)
    .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e.message);
        process.exit(1);
    });
