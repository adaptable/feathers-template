import {
    config as adaptableConfig,
    ContainerImage,
    ContainerService,
    Database,
    HttpsLoadBalancer,
} from "@adaptable/cloud";
import Adapt, {
    Group,
    handle,
    useMethod,
    useAsync,
    callInstanceMethod,
} from "@adpt/core";
import { mergeEnvSimple, useConnectTo } from "@adpt/cloud";
import { DockerImageInstance } from "@adpt/cloud/docker";
import { URL } from "url";
import { config } from "./common";
import { prodStyle } from "./styles";

const {
    adaptableDomainName, appId, appName, revisionId,
} = adaptableConfig();

function App() {
    const imgHand = handle<DockerImageInstance>();
    const image = useMethod(imgHand, "latestImage");
    const imageStr = image?.registryRef;

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
    const env = mergeEnvSimple(dbEnv, { NODE_ENV: "production" }, config.environment);

    return (
        <Group key="app">
            <ContainerImage
                key="app-img"
                handle={imgHand}
                appId={appId}
                config={{
                    type: "buildpack",
                    builder: "paketobuildpacks/builder:base",
                }}
                imageName="appimage"
                plan="hobby"
                revId={revisionId}
            />
            <Database
                key="db"
                handle={dbHand}
                appId={appId}
                name="main"
                plan="hobby"
                type="mssql"
            />
            {imageStr && dbEnv ? (
                <ContainerService
                    key="app"
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
                    hostname={`${appName}.${adaptableDomainName}`}
                    name="main"
                    target={ctrHost}
                    hostHeader={ctrHost}
                />
            ) : null}
        </Group>
    );
}

Adapt.stack("default", <App />, prodStyle());
