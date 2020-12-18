import Adapt, {
    SFCDeclProps,
    SFCBuildProps,
    Group,
    handle,
} from "@adpt/core";
import { CloudRunAdapter } from "@adpt/cloud/gcloud";
import { LocalDockerImage } from "@adpt/cloud/docker";
import { prodStyle } from "./styles";
import { loadAdaptableConfig } from "./template-support";

interface GCloudConfig {
    projectId: string;
    creds: string;
    region: string;
}

interface Config {
    gcloud: GCloudConfig;
}

const config = loadAdaptableConfig<Config>();

interface GCloudProps {
    gcloud: GCloudConfig;
}

interface MainRepoProps extends GCloudProps {}
interface DatabaseProps extends GCloudProps {}

// FIXME(manishv) instantiate a proper Postgres CloudSQL instance here
function Database(props: SFCDeclProps<DatabaseProps>) { return null; }

function MainRepo(props: SFCDeclProps<MainRepoProps>) {
    const { key, gcloud } = props as SFCBuildProps<MainRepoProps>;
    const { projectId, region } = gcloud;
    const img = handle();
    return (
        <Group key={key}>
            <LocalDockerImage key={`${key}-img`} handle={img} />
            <CloudRunAdapter key={key} image={img} region={region} port={80} registryUrl={`gcr.io/${projectId}`} />
        </Group>
    );
}

function App() {
    // Download gcloud tools here
    // Insert gcloud credentials into gcloud app here.
    return (
        <Group key="app">
            <MainRepo key="main-repo" gcloud={config.gcloud || "unknown"} />
            <Database key="database" gcloud={config.gcloud || "unknown"} />
        </Group>
    );
}

Adapt.stack("default", <App />, prodStyle);
