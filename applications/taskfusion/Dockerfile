# Build context is the repo root (see docker-compose.yml) so this stage
# can reach branding/mv-1.0 directly — CRA compiles to a static bundle,
# so there's no runtime mount option here like Keycloak has; the build
# copies the canonical brand files in instead of relying on a
# hand-maintained vendored copy.

# Stage 1: Build the React app
FROM node:22-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json for dependencies installation
COPY applications/taskfusion/package.json applications/taskfusion/package-lock.json ./

# Reproducible install — fails if lockfile is out of sync, faster than npm install
RUN npm ci

# Copy the rest of the source code to the container
COPY applications/taskfusion/ .

# Overwrite whatever's in src/assets/brand/ (gitignored, may be stale or
# absent) with the real canonical files, mirroring mv-1.0's own layout so
# tokens.css's relative ./logos, ./images references still resolve —
# logos/ and images/ are siblings of tokens.css under design-system/, not
# one level up.
COPY branding/mv-1.0/design-system/tokens.css src/assets/brand/design-system/tokens.css
COPY branding/mv-1.0/design-system/logos/microverse-logo.png src/assets/brand/design-system/logos/microverse-logo.png
COPY branding/mv-1.0/design-system/images/microverse-bg.jpg src/assets/brand/design-system/images/microverse-bg.jpg

ARG REACT_APP_BRAND_THEME=default

# The app only ever sees ONE theme, at a fixed, theme-agnostic path — it
# has no idea Vienna or Uhuru exist. This stage-only copy of the full
# theme catalog (discarded when this build stage is; see the nginx stage
# below) lets the RUN step below pick just REACT_APP_BRAND_THEME's own
# dir out of it.
COPY branding/mv-1.0/design-system/themes /tmp/themes-catalog

# 1. Copy the selected theme's css/{light,dark}.css to a fixed
#    src/assets/brand/design-system/theme/ path, rewriting
#    [data-brand-theme="<id>"] to bare :root — that selector exists so
#    the *source* catalog can hold all three themes at once; a build
#    that only ever ships one theme doesn't need it, and stripping it
#    means the app never has to set data-brand-theme on anything.
# 2. If (and only if) that theme has its own images/ folder, overwrite
#    the canonical images/microverse-bg.jpg copied above with whatever
#    single file is in there — Default has no images/ folder, so it
#    silently keeps the canonical image, no special-casing needed.
RUN set -eu; \
    THEME_DIR="/tmp/themes-catalog/${REACT_APP_BRAND_THEME}"; \
    DEST=src/assets/brand/design-system/theme; \
    mkdir -p "$DEST"; \
    sed "s/\[data-brand-theme=\"${REACT_APP_BRAND_THEME}\"\]/:root/g" "$THEME_DIR/css/light.css" > "$DEST/light.css"; \
    sed "s/\[data-brand-theme=\"${REACT_APP_BRAND_THEME}\"\]/:root/g" "$THEME_DIR/css/dark.css" > "$DEST/dark.css"; \
    if [ -d "$THEME_DIR/images" ]; then \
      IMG=$(find "$THEME_DIR/images" -maxdepth 1 -type f ! -name '.*' | head -n1); \
      if [ -n "$IMG" ]; then cp "$IMG" src/assets/brand/design-system/images/microverse-bg.jpg; fi; \
    fi; \
    rm -rf /tmp/themes-catalog

# Build-time args — must be declared here to be available during `npm run build`,
# since CRA bakes REACT_APP_* vars into the bundle at build time, not runtime
ARG REACT_APP_KEYCLOAK_URL
ARG REACT_APP_KEYCLOAK_REALM
ARG REACT_APP_KEYCLOAK_CLIENT_ID
ENV REACT_APP_KEYCLOAK_URL=$REACT_APP_KEYCLOAK_URL \
    REACT_APP_KEYCLOAK_REALM=$REACT_APP_KEYCLOAK_REALM \
    REACT_APP_KEYCLOAK_CLIENT_ID=$REACT_APP_KEYCLOAK_CLIENT_ID

# react-scripts directly, not `npm run build` — the "build" script's
# "prebuild" hook (sync-brand-assets.js) assumes the local repo layout
# (branding/ as a sibling three levels up), which doesn't exist in this
# container; the COPY steps above already placed the real files
RUN npx react-scripts build

# Stage 2: Serve the app using Nginx
FROM nginx:alpine

# SPA fallback so client-side routes (e.g. /dashboard) survive a direct load/refresh
COPY applications/taskfusion/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React app from the first stage to Nginx's HTML directory
COPY --from=build /app/build /usr/share/nginx/html

# Run as non-root
RUN touch /run/nginx.pid && \
    chown -R nginx:nginx /run/nginx.pid && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx
USER nginx

EXPOSE 80

# "localhost" resolves to ::1 first here, but nginx only binds IPv4 (its
# ipv6-listen entrypoint script can't patch default.conf as the non-root
# nginx user) — target 127.0.0.1 explicitly
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
