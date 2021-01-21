/* eslint-disable react/jsx-wrap-multilines */
/* eslint-disable import/prefer-default-export */
import Adapt, { Style } from "@adpt/core";
import { BuildKitImage, LocalDockerImage, LocalDockerImageProps } from "@adpt/cloud/docker";
import { config } from "./common";

export const prodStyle = () => {
    const registry = "gcr.io";
    const imageName = `${config.gcloud.projectId}/app-image`;
    return (
        <Style>
            {LocalDockerImage}
            {Adapt.rule<LocalDockerImageProps>(({ handle, options = {}, ...props }) => (
                <BuildKitImage
                    {...props}
                    options={{ ...options, buildKitHost: process.env.BUILDKIT_HOST }}
                    output={{
                        ...options,
                        imageName,
                        type: "registry",
                        registry,
                    }}
                />
            ))}
        </Style>
    );
};
