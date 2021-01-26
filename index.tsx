import Adapt, {
    SFCDeclProps,
    SFCBuildProps,
    Group,
    handle,
    useMethod,
} from "@adpt/core";
import { CloudRun } from "@adpt/cloud/gcloud";
import { LocalNodeImage } from "@adpt/cloud/nodejs";
import { DockerImageInstance } from "@adpt/cloud/docker";
import { config, GCloudConfig } from "./common";
import { prodStyle } from "./styles";

interface GCloudProps {
    gcloud: GCloudConfig;
}

interface MainRepoProps extends GCloudProps {}
interface DatabaseProps extends GCloudProps {}

// FIXME(manishv) instantiate a proper Postgres CloudSQL instance here
function Database(props: SFCDeclProps<DatabaseProps>) { return null; }

function MainRepo(props: SFCDeclProps<MainRepoProps>) {
    const { key, gcloud } = props as SFCBuildProps<MainRepoProps>;
    const { region } = gcloud;
    const srcDir = process.env.ADAPTABLE_SOURCE_REPO;
    if (!srcDir) throw new Error(`ADAPTABLE_SOURCE_REPO must be set`);

    const imgHand = handle<DockerImageInstance>();
    const image = useMethod(imgHand, "latestImage");
    const imageStr = image?.registryRef;

    return (
        <Group key={key}>
            <LocalNodeImage
                key={`${key}-img`}
                handle={imgHand}
                options={{
                    imageName: "myapp",
                    packageManager: "yarn",
                }}
                srcDir={srcDir}
            />
            {imageStr ? (
                <CloudRun
                    key={key}
                    allowUnauthenticated
                    image={imageStr}
                    port={80}
                    region={region}
                />
            )
                : null}
        </Group>
    );
}

function App() {
    // Download gcloud tools here
    // Insert gcloud credentials into gcloud app here.
    return (
        <Group key="app">
            <MainRepo key="main-repo" gcloud={config.gcloud} />
            <Database key="database" gcloud={config.gcloud} />
        </Group>
    );
}

Adapt.stack("default", <App />, prodStyle());
