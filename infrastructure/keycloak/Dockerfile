# Build context is the repo root (see docker-compose.yml) so this can
# reach branding/mv-1.0 directly — same reasoning as
# applications/taskfusion/Dockerfile. Bakes the custom theme and brand
# assets into the image instead of relying on host bind-mounts, so a
# pushed image is self-contained regardless of where or how it's
# eventually deployed (a different repo layout, a different host —
# nothing at runtime needs to find branding/ on the filesystem).

FROM quay.io/keycloak/keycloak:latest

# Which Microverse brand theme this image renders — one of: default,
# vienna, uhuru (see branding/mv-1.0/design-system/themes/theme.config.json).
# Wired from MICROVERSE_BRAND_THEME in the root .env via docker-compose.yml
# (the same value taskfusion's REACT_APP_BRAND_THEME uses, so both images
# built from one docker compose build stay in sync).
ARG KEYCLOAK_BRAND_THEME=default

# --chown so the RUN step below (which writes into resources/branding/,
# as the base image's uid-1000 runtime user) can create files there —
# without it, COPY's default root ownership blocks that.
COPY --chown=1000:0 infrastructure/keycloak/themes/microverse /opt/keycloak/themes/microverse

COPY --chown=1000:0 branding/mv-1.0/design-system/tokens.css /opt/keycloak/themes/microverse/login/resources/branding/design-system/tokens.css
COPY --chown=1000:0 branding/mv-1.0/design-system/logos/microverse-logo.png /opt/keycloak/themes/microverse/login/resources/branding/design-system/logos/microverse-logo.png
COPY --chown=1000:0 branding/mv-1.0/design-system/images/microverse-bg.jpg /opt/keycloak/themes/microverse/login/resources/branding/design-system/images/microverse-bg.jpg

# Keycloak's login page only ever sees ONE theme, at a fixed,
# theme-agnostic path — theme.properties and microverse.css both
# reference branding/design-system/theme/{light,dark}.css and
# images/microverse-bg.jpg unconditionally, with no idea Vienna or Uhuru
# exist. This copy of the full theme catalog is scratch space for the
# RUN step below to pick KEYCLOAK_BRAND_THEME's own dir out of — removed
# again at the end so the shipped image doesn't carry the other two
# themes' source files. --chown (uid 1000, matching the RUN step's user)
# so that final `rm -rf` can actually delete it — /tmp's sticky bit
# blocks a non-owner from removing a root-owned dir even with write
# access to /tmp itself.
COPY --chown=1000:0 branding/mv-1.0/design-system/themes /tmp/themes-catalog

# 1. Copy the selected theme's css/{light,dark}.css to the fixed
#    resources/branding/design-system/theme/ path, rewriting
#    [data-brand-theme="<id>"] to bare :root — that selector exists so
#    the *source* catalog can hold all three themes at once; Keycloak
#    has no JS runtime to set that attribute, so a build that only ever
#    ships one theme needs the rule to apply unconditionally instead.
# 2. If (and only if) that theme has its own images/ folder, overwrite
#    the canonical images/microverse-bg.jpg copied above with whatever
#    single file is in there — Default has no images/ folder, so it
#    silently keeps the canonical image, no special-casing needed.
RUN set -eu; \
    BRANDING=/opt/keycloak/themes/microverse/login/resources/branding/design-system; \
    THEME_DIR="/tmp/themes-catalog/${KEYCLOAK_BRAND_THEME}"; \
    mkdir -p "$BRANDING/theme"; \
    sed "s/\[data-brand-theme=\"${KEYCLOAK_BRAND_THEME}\"\]/:root/g" "$THEME_DIR/css/light.css" > "$BRANDING/theme/light.css"; \
    sed "s/\[data-brand-theme=\"${KEYCLOAK_BRAND_THEME}\"\]/:root/g" "$THEME_DIR/css/dark.css" > "$BRANDING/theme/dark.css"; \
    if [ -d "$THEME_DIR/images" ]; then \
      IMG=$(find "$THEME_DIR/images" -maxdepth 1 -type f ! -name '.*' | head -n1); \
      if [ -n "$IMG" ]; then cp "$IMG" "$BRANDING/images/microverse-bg.jpg"; fi; \
    fi; \
    rm -rf /tmp/themes-catalog
