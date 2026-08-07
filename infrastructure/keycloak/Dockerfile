# Build context is the repo root (see docker-compose.yml) so this can
# reach branding/mv-1.0 directly — same reasoning as
# applications/taskfusion/Dockerfile. Bakes the custom theme and brand
# assets into the image instead of relying on host bind-mounts, so a
# pushed image is self-contained regardless of where or how it's
# eventually deployed (a different repo layout, a different host —
# nothing at runtime needs to find branding/ on the filesystem).

FROM quay.io/keycloak/keycloak:latest

COPY infrastructure/keycloak/themes/microverse /opt/keycloak/themes/microverse

# Mirrors mv-1.0's own layout under resources/branding/ so
# microverse.css's tokens.css import, and tokens.css's own relative
# ../logos, ../images references, resolve unmodified — the same files
# the bind-mount used to provide, now baked in at build time instead.
COPY branding/mv-1.0/design-system/tokens.css /opt/keycloak/themes/microverse/login/resources/branding/design-system/tokens.css
COPY branding/mv-1.0/logos/microverse-logo.png /opt/keycloak/themes/microverse/login/resources/branding/logos/microverse-logo.png
COPY branding/mv-1.0/images/microverse-bg.jpg /opt/keycloak/themes/microverse/login/resources/branding/images/microverse-bg.jpg
