/* eslint-disable prefer-destructuring */
import { CreateBuild } from "@adaptable/client/dist/api-types/builds";
import {
    config as adaptableConfig,
    ContainerImage,
    ContainerService,
    Database,
    Domain,
    HttpsLoadBalancer,
} from "@adaptable/cloud";
import Adapt, {
    callInstanceMethod,
    Group,
    handle,
    Sequence,
    useAsync,
    useImperativeMethods,
    useState,
} from "@adpt/core";
import {
    ConnectToInstance, EnvSimple, mergeEnvSimple, useConnectTo,
} from "@adpt/cloud";
import { sha256hex } from "@adpt/utils";
import { DockerImageInstance } from "@adpt/cloud/docker";
import { URL } from "url";
import { inspect } from "util";
import { config, ConfigDomains } from "./common";
import { prodStyle } from "./styles";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const buildInfo = require("./startup/buildInfo");

const adaptEnv = buildInfo.adaptEnv;
const imageBuildProps: CreateBuild = buildInfo.imageBuildProps;

// Apply adaptEnv to the current process environment
Object.assign(process.env, adaptEnv || {});

const {
    adaptableDomainName, appId, appName,
} = adaptableConfig();

const computeRegistryRef = (imageName: string) => {
    const revNumber = process.env.ADAPTABLE_APPREVISION_NUMBER;
    const dockerRepo = process.env.ADAPTABLE_DOCKER_REPO;
    return `${dockerRepo}/${imageName}:${revNumber}`;
};

function NoDatabase() {
    useImperativeMethods<ConnectToInstance>(() => ({
        connectEnv: () => ({
            NO_DATABASE: "true",
        }),
    }));
    return null;
}

function parsePort(port: string) {
    const m = /^\s*(\d+)\s*$/.exec(port);
    if (m) {
        const p = parseInt(m[1], 10);
        if (!Number.isNaN(p) && p > 0 && p < 65536) {
            return p;
        }
    }

    const msg = `Invalid value '${port}' for PORT in Runtime Environment`;
    // eslint-disable-next-line no-console
    console.log(`\n\nERROR: ${msg}\n`);
    throw new Error(msg);
}

function makeDomainName(s: string) {
    const subs = s.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 48).toLowerCase();
    const hash = sha256hex(s).slice(0, 6);
    return `${subs}-${hash}`;
}

export interface DomainsFromConfigProps {
    domains?: ConfigDomains;
    defaultEndpoint?: string;
    endpoints?: { [ep: string]: { lbId: string | undefined } };
}

export function DomainsFromConfig(
    { domains, endpoints: epsIn, defaultEndpoint }: DomainsFromConfigProps,
) {
    if (domains == null) return null;
    const endpoints = epsIn ?? {};
    return (
        <Group key="domains">
            {domains.map((d) => {
                const ep = d.endpoint ?? defaultEndpoint;
                if (ep == null) throw new Error(`Domain configuration ${d} must specify endpoint`);
                const epInfo = endpoints[ep];
                if (d.endpoint != null && epInfo == null) throw new Error(`Cannot find endpoint ${ep} for domain ${d}`);
                if (epInfo == null) throw new Error(`No information for default endpoint ${ep} in endpoints ${endpoints}`);
                const { lbId } = epInfo;
                if (lbId == null) return null;
                return (
                    <Domain
                        key={d.domainName}
                        appId={appId}
                        name={d.name ?? makeDomainName(d.domainName)}
                        domainName={d.domainName}
                        lbId={lbId}
                    />
                );
            })}
        </Group>
    );
}

function App() {
    const imgHand = handle<DockerImageInstance>();
    // Workaround state update issue when Container is errored out
    // Instead of the logic below, that requires a state loop turn
    // just calculate what the image name directly.
    //
    // const image = useMethod(imgHand, "latestImage");
    // const imageStr = image?.registryRef;
    const imageStr = computeRegistryRef(imageBuildProps.imageName);
    const [initialDatabaseType, setInitialDatabaseType] = useState(config.databaseType);

    // Debug code for an error seen only once in system testing
    if (typeof initialDatabaseType !== "string") {
        throw new Error(`InternalError: initialDatabaseType was not a string, got ${inspect(initialDatabaseType, false, null)}, config.databaseType is ${inspect(config.databaseType, false, null)}`);
    }

    if (config.databaseType !== initialDatabaseType) {
        if (initialDatabaseType === "none") {
            // Allow one time change from none
            setInitialDatabaseType(config.databaseType);
        } else {
            throw new Error(`databaseType cannot be changed from ${initialDatabaseType} to ${config.databaseType} without data loss.  Please restore the value of databaseType in the config or contact support for help.`);
        }
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
        // The load balancer + container service architecture has
        // two reverse proxies.
        ADAPTABLE_TRUST_PROXY_DEPTH: "2",
    };

    if (imageBuildProps.config.type === "buildpack") {
        standardEnv.HOME = "/home/cnb"; // Override our runtime default in the container service
    }

    // Remove PORT from the container environment
    const { PORT, ...env } = mergeEnvSimple(dbEnv, standardEnv, config.environment) || {};
    const port = PORT ? parsePort(PORT) : 80;

    const lbHand = handle<HttpsLoadBalancer>();
    const lbId: string | undefined = useAsync(
        () => callInstanceMethod<string | undefined>(lbHand, undefined, "id"),
        undefined,
    );

    return (
        <Sequence key="app">
            <ContainerImage
                key="app-img"
                handle={imgHand}
                {...imageBuildProps}
            />
            {config.databaseType === "none"
                ? (<NoDatabase key="no-db" handle={dbHand} />)
                : (
                    <Database
                        key="db"
                        handle={dbHand}
                        appId={appId}
                        name="main"
                        plan="hobby"
                        type={config.databaseType}
                    />
                ) }
            {imageStr && dbEnv ? (
                <ContainerService
                    key="app-ctr"
                    handle={ctrHand}
                    appId={appId}
                    env={env}
                    image={imageStr}
                    name="app"
                    plan="hobby"
                    port={port}
                    resourceConfig={config.resourceConfig ?? {}}
                />
            ) : null}
            {ctrHost ? (
                <HttpsLoadBalancer
                    key="lb"
                    handle={lbHand}
                    appId={appId}
                    hostname={externalHostname}
                    name="main"
                    target={ctrHost}
                    hostHeader={ctrHost}
                />
            ) : null}
            <DomainsFromConfig
                domains={config.domains}
                defaultEndpoint="main"
                endpoints={{ main: { lbId } }}
            />
        </Sequence>
    );
}

Adapt.stack("default", <App />, prodStyle());
