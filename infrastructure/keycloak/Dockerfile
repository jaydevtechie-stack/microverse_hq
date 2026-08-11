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

# --chown so theme.properties and microverse.css (both edited by the sed
# step below) are writable by the uid-1000 user that step runs as.
COPY --chown=1000:0 infrastructure/keycloak/themes/microverse /opt/keycloak/themes/microverse

# Copy the whole design-system tree wholesale (all three themes) rather
# than a curated file list — mirrors mv-1.0's own layout under
# resources/branding/ so tokens.css's and every theme's relative ./logos,
# ./images references resolve unmodified, the same files a bind-mount
# used to provide, now baked in at build time instead. Copying all three
# is a handful of small CSS files plus two photos either way; simpler to
# keep in sync than naming each theme's files individually here.
# --chown matches the base image's runtime user (uid 1000, gid 0 — see
# `docker run ... id`) — without it these land root-owned and the sed
# step below (which runs as that same uid 1000) can't write to them.
COPY --chown=1000:0 branding/mv-1.0/design-system /opt/keycloak/themes/microverse/login/resources/branding/design-system

# Wires the build ARG above into the two static files that can't read an
# env var themselves (theme.properties has no variable syntax; CSS has
# no build step here the way CRA gives taskfusion process.env.*):
#
# 1. theme.properties' styles= line gets its __BRAND_THEME_CSS__
#    placeholder replaced with the selected theme's own css/light.css +
#    css/dark.css — see that file's comment for why this is what actually
#    makes Keycloak's login page pick up the theme's --mv-color-primary
#    etc.
# 2. Those two CSS files are normally scoped to
#    [data-brand-theme="<id>"], a React/JS-set attribute — meaningless on
#    Keycloak's login page, which has no JS runtime to set it. Rewriting
#    that selector to bare :root (in place) makes their rules apply
#    unconditionally instead of never matching anything.
# 3. microverse.css's __BRAND_BG_IMAGE_PATH__ placeholder gets replaced
#    with the selected theme's own background image path (Default has
#    none of its own — see theme.config.json — so it keeps pointing at
#    tokens.css's shared images/microverse-bg.jpg).
RUN set -eu; \
    LOGIN=/opt/keycloak/themes/microverse/login; \
    THEME_CSS_DIR="$LOGIN/resources/branding/design-system/themes/${KEYCLOAK_BRAND_THEME}/css"; \
    sed -i "s/\[data-brand-theme=\"${KEYCLOAK_BRAND_THEME}\"\]/:root/g" \
      "$THEME_CSS_DIR/light.css" "$THEME_CSS_DIR/dark.css"; \
    sed -i "s#__BRAND_THEME_CSS__#branding/design-system/themes/${KEYCLOAK_BRAND_THEME}/css/light.css branding/design-system/themes/${KEYCLOAK_BRAND_THEME}/css/dark.css#" \
      "$LOGIN/theme.properties"; \
    case "$KEYCLOAK_BRAND_THEME" in \
      vienna) BG_IMAGE="themes/vienna/images/vienna-grossglockner-bg.jpg" ;; \
      uhuru)  BG_IMAGE="themes/uhuru/images/uhuru-kilimanjaro-bg.jpg" ;; \
      *)      BG_IMAGE="images/microverse-bg.jpg" ;; \
    esac; \
    sed -i "s#__BRAND_BG_IMAGE_PATH__#${BG_IMAGE}#" \
      "$LOGIN/resources/css/microverse.css"
