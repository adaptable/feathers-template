import {
    config as adaptableConfig,
    ContainerImage,
    ContainerService,
    Database,
    HttpsLoadBalancer,
} from "@adaptable/cloud";
import Adapt, {
    handle,
    useAsync,
    callInstanceMethod,
    useState,
    Sequence,
} from "@adpt/core";
import { EnvSimple, mergeEnvSimple, useConnectTo } from "@adpt/cloud";
import { DockerImageInstance } from "@adpt/cloud/docker";
import { URL } from "url";
import { config } from "./common";
import { prodStyle } from "./styles";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { imageBuildProps } = require("./startup/buildInfo");

const {
    adaptableDomainName, appId, appName,
} = adaptableConfig();

const computeRegistryRef = (imageName: string) => {
    const revNumber = process.env.ADAPTABLE_APPREVISION_NUMBER;
    const dockerRepo = process.env.ADAPTABLE_DOCKER_REPO;
    return `${dockerRepo}/${imageName}:${revNumber}`;
};

function App() {
    const imgHand = handle<DockerImageInstance>();
    // Workaround state update issue when Container is errored out
    // Instead of the logic below, that requires a state loop turn
    // just calculate what the image name directly.
    //
    // const image = useMethod(imgHand, "latestImage");
    // const imageStr = image?.registryRef;
    const imageStr = computeRegistryRef(imageBuildProps.imageName);
    const [initialDatabaseType] = useState(config.databaseType);

    if (config.databaseType !== initialDatabaseType) {
        throw new Error(`databaseType cannot be changed from ${initialDatabaseType} to ${config.databaseType} without data loss.  Please restore the value of databaseType in the config or contact support for help.`);
    }

    const ctrHand = handle();
    const ctrUrl = useAsync(
        () => callInstanceMethod<string | undefined>(ctrHand, undefined, "url"),
        undefined,
    );
    let ctrHost: string | undefined;
    if (ctrUrl) {
        const u = new URL(ctrUrl);
        ctrHost = u.hostname;
    }

    const dbHand = handle();
    const dbEnv = useConnectTo(dbHand);
    const externalHostname = `${appName}.${adaptableDomainName}`;
    const standardEnv: EnvSimple = {
        EXTERNAL_HOSTNAME: externalHostname,
        EXTERNAL_URL: `https://${externalHostname}`,
        NODE_ENV: "production",
    };
    const env = mergeEnvSimple(dbEnv, standardEnv, config.environment);

    return (
        <Sequence key="app">
            <ContainerImage
                key="app-img"
                handle={imgHand}
                {...imageBuildProps}
            />
            <Database
                key="db"
                handle={dbHand}
                appId={appId}
                name="main"
                plan="hobby"
                type={config.databaseType}
            />
            {imageStr && dbEnv ? (
                <ContainerService
                    key="app-ctr"
                    handle={ctrHand}
                    appId={appId}
                    env={env}
                    image={imageStr}
                    name="app"
                    plan="hobby"
                    port={80}
                />
            ) : null}
            {ctrHost ? (
                <HttpsLoadBalancer
                    key="lb"
                    appId={appId}
                    hostname={externalHostname}
                    name="main"
                    target={ctrHost}
                    hostHeader={ctrHost}
                />
            ) : null}
        </Sequence>
    );
}

Adapt.stack("default", <App />, prodStyle());
