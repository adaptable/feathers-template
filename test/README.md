# Simple manual test

## Pre-requisites

1. gcloud installed locally

2. gcloud default project set to adaptable-test

```console
gcloud config set core/project adaptable-test-284300
```

3. gcloud authenticated to GCP with permissions for adaptable-test

## Instructions

1. Run BuildKit as a container locally

```console
docker run -d --name buildkitd --privileged moby/buildkit:latest
```

2. Run Adapt

```console
DEBUG=adapt:cloud:* BUILDKIT_HOST=docker-container://buildkitd ADAPTABLE_SOURCE_REPO=test/backend ADAPTABLE_TEMPLATE_CONFIG_PATH=test/adaptable.config.json adapt run --deployID test
```

3. Tear down

```console
DEBUG=adapt:cloud:* BUILDKIT_HOST=docker-container://buildkitd ADAPTABLE_SOURCE_REPO=test/backend ADAPTABLE_TEMPLATE_CONFIG_PATH=test/adaptable.config.json adapt destroy test
```
