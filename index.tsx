import Adapt, {
    SFCDeclProps,
    SFCBuildProps,
    Group,
    handle,
} from "@adpt/core";
import { CloudRunAdapter } from "@adpt/cloud/gcloud";
import { LocalDockerImage } from "@adpt/cloud/docker";
import { prodStyle } from "./styles";

interface GCloudProps {
    projectId: string;
}

interface MainRepoProps extends GCloudProps {}
interface DatabaseProps extends GCloudProps {}

// FIXME(manishv) instantiate a proper Postgres CloudSQL instance here
function Database(props: SFCDeclProps<DatabaseProps>) { return null; }

function MainRepo(props: SFCDeclProps<MainRepoProps>) {
    const { key, projectId } = props as SFCBuildProps<MainRepoProps>;
    const img = handle();
    return (
        <Group key={key}>
            <LocalDockerImage key={`${key}-img`} handle={img} />
            <CloudRunAdapter key={key} image={img} region="us-central-1b" port={80} registryUrl={`gcr.io/${projectId}`} />
        </Group>
    );
}

function App() {
    return (
        <Group key="app">
            <MainRepo key="main-repo" projectId={process.env.GCLOUD_PROJECT || "unknown"} />
            <Database key="database" projectId={process.env.GCLOUD_PROJECT || "unknown"} />
        </Group>
    );
}

Adapt.stack("default", <App />, prodStyle);
