import { config as adaptableConfig, Database, HttpsLoadBalancer } from "@adaptable/cloud";
import Adapt, {
    Group,
    handle,
    useMethod,
    useAsync,
    callInstanceMethod,
} from "@adpt/core";
import { mergeEnvPairs, useConnectTo } from "@adpt/cloud";
import { LocalNodeImage } from "@adpt/cloud/nodejs";
import { DockerImageInstance } from "@adpt/cloud/docker";
import { CloudRun, CloudRunInstance } from "@adpt/cloud/gcloud";
import { URL } from "url";
import { config } from "./common";
import { prodStyle } from "./styles";

const { adaptableDomainName, appId, appName } = adaptableConfig();

function App() {
    const { region } = config.gcloud;
    const srcDir = process.env.ADAPTABLE_SOURCE_REPO;
    if (!srcDir) throw new Error(`ADAPTABLE_SOURCE_REPO must be set`);

    const imgHand = handle<DockerImageInstance>();
    const image = useMethod(imgHand, "latestImage");
    const imageStr = image?.registryRef;

    const runHand = handle<CloudRunInstance>();
    const runUrl = useAsync(
        () => callInstanceMethod<string | undefined>(runHand, undefined, "url"),
        undefined,
    );
    let runHost: string | undefined;
    if (runUrl) {
        const u = new URL(runUrl);
        runHost = u.hostname;
    }

    const dbHand = handle();
    const dbEnv = useConnectTo(dbHand);
    const env = mergeEnvPairs(dbEnv, { NODE_ENV: "production" });

    return (
        <Group key="app">
            <LocalNodeImage
                key="app-img"
                handle={imgHand}
                options={{
                    imageName: "myapp",
                    packageManager: "yarn",
                }}
                srcDir={srcDir}
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
                <CloudRun
                    key="app"
                    handle={runHand}
                    allowUnauthenticated
                    env={env}
                    image={imageStr}
                    port={80}
                    region={region}
                />
            ) : null}

            {runHost ? (
                <HttpsLoadBalancer
                    key="lb"
                    appId={appId}
                    hostname={`${appName}.${adaptableDomainName}`}
                    name="main"
                    target={runHost}
                    hostHeader={runHost}
                />
            ) : null}
        </Group>
    );
}

Adapt.stack("default", <App />, prodStyle());
