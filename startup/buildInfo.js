// @ts-check

const appId = process.env.ADAPTABLE_APP_ID;
if (appId == null) throw new Error("No ADAPTABLE_APP_ID found");

const revId = process.env.ADAPTABLE_APPREVISION_ID;
if (revId == null) throw new Error("No ADAPTABLE_APPREVISION_ID");

const buildpackImage = "paketobuildpacks/builder:0.2.6-full";
module.exports.buildpackImage = buildpackImage;

/**
 * @type {import("@adaptable/client/dist/api-types/builds").CreateBuild}
 */
const imageBuildProps = {
    appId,
    config: {
        type: "buildpack",
        builder: buildpackImage,
    },
    imageName: "appimage",
    plan: "hobby",
    revId,
};
module.exports.imageBuildProps = imageBuildProps;
