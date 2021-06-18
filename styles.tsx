/* eslint-disable react/jsx-wrap-multilines */
/* eslint-disable import/prefer-default-export */
import Adapt, { Style } from "@adpt/core";
import { BuildKitImage, LocalDockerImage, LocalDockerImageProps } from "@adpt/cloud/docker";
import { UserError } from "@adpt/utils";

export const prodStyle = () => {
    const fullRepo = process.env.ADAPTABLE_DOCKER_REPO;
    if (!fullRepo) {
        throw new UserError("ADAPTABLE_DOCKER_REPO must be set");
    }
    const [registry, ...repoPath] = fullRepo.split("/");
    return (
        <Style>
            {LocalDockerImage}
            {Adapt.rule<LocalDockerImageProps>(({ handle, options = {}, ...props }) => {
                const imageName = [
                    ...repoPath,
                    options.imageName ?? "app-image",
                ].join("/");
                return (
                    <BuildKitImage
                        {...props}
                        options={{ ...options, buildKitHost: process.env.BUILDKIT_HOST }}
                        output={{
                            ...options,
                            type: "registry",
                            registry,
                            imageName,
                        }}
                    />
                );
            })}
        </Style>
    );
};
