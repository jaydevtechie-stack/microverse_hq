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

# Each theme is a self-contained bundle (css/ + its own background image
# for Vienna/Uhuru — see branding/mv-1.0/design-system/themes/theme.config.json
# for the canonical filenames; COPY can't read that JSON, so they're
# repeated here literally — keep in sync if a theme's image is ever
# renamed). Default has no image of its own — it inherits tokens.css's
# copy above via CSS cascade, so there's nothing to COPY for it.
COPY branding/mv-1.0/design-system/themes/default/css/light.css src/assets/brand/design-system/themes/default/css/light.css
COPY branding/mv-1.0/design-system/themes/default/css/dark.css src/assets/brand/design-system/themes/default/css/dark.css
COPY branding/mv-1.0/design-system/themes/vienna/css/light.css src/assets/brand/design-system/themes/vienna/css/light.css
COPY branding/mv-1.0/design-system/themes/vienna/css/dark.css src/assets/brand/design-system/themes/vienna/css/dark.css
COPY branding/mv-1.0/design-system/themes/vienna/images/vienna-grossglockner-bg.jpg src/assets/brand/design-system/themes/vienna/images/vienna-grossglockner-bg.jpg
COPY branding/mv-1.0/design-system/themes/uhuru/css/light.css src/assets/brand/design-system/themes/uhuru/css/light.css
COPY branding/mv-1.0/design-system/themes/uhuru/css/dark.css src/assets/brand/design-system/themes/uhuru/css/dark.css
COPY branding/mv-1.0/design-system/themes/uhuru/images/uhuru-kilimanjaro-bg.jpg src/assets/brand/design-system/themes/uhuru/images/uhuru-kilimanjaro-bg.jpg

# Build-time args — must be declared here to be available during `npm run build`,
# since CRA bakes REACT_APP_* vars into the bundle at build time, not runtime
ARG REACT_APP_KEYCLOAK_URL
ARG REACT_APP_KEYCLOAK_REALM
ARG REACT_APP_KEYCLOAK_CLIENT_ID
ARG REACT_APP_BRAND_THEME
ENV REACT_APP_KEYCLOAK_URL=$REACT_APP_KEYCLOAK_URL \
    REACT_APP_KEYCLOAK_REALM=$REACT_APP_KEYCLOAK_REALM \
    REACT_APP_KEYCLOAK_CLIENT_ID=$REACT_APP_KEYCLOAK_CLIENT_ID \
    REACT_APP_BRAND_THEME=$REACT_APP_BRAND_THEME

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
