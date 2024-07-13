function makeConfig(staticConfig) {
    let spaRedirect = "";
    const root = (staticConfig.root || "").trim();

    if (staticConfig.singlePageApp) {
        // if path doesn't exist, redirect it to 'index.html' for client side routing
        spaRedirect = "try_files {path} /index.html";
    }

    return `
{
    admin off
    persist_config off
    auto_https off
    servers {
        trusted_proxies static private_ranges
    }
    log {
        format filter {
            wrap json {
                message_key message
                level_key severity
                time_key timestampSeconds
            }
        }
    }
}

:80 {
    root * /app/${root}

    encode gzip

    file_server

    ${spaRedirect}

    @nocache {
        path / /index.html
    }

    @cache {
        file
        path *.ico *.css *.js *.gif *.webp *.avif *.jpg *.jpeg *.png *.svg *.woff *.woff2
    }

    header @nocache cache-control "no-cache, no-store"

    header @cache cache-control "public, max-age=3600"
}
`;
}

module.exports = makeConfig;
