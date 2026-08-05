# Stage 1: Build the React app
FROM node:22-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json for dependencies installation
COPY package.json package-lock.json ./

# Reproducible install — fails if lockfile is out of sync, faster than npm install
RUN npm ci

# Copy the rest of the source code to the container
COPY . .

# Build-time args — must be declared here to be available during `npm run build`,
# since CRA bakes REACT_APP_* vars into the bundle at build time, not runtime
ARG REACT_APP_KEYCLOAK_URL
ARG REACT_APP_KEYCLOAK_REALM
ARG REACT_APP_KEYCLOAK_CLIENT_ID
ENV REACT_APP_KEYCLOAK_URL=$REACT_APP_KEYCLOAK_URL \
    REACT_APP_KEYCLOAK_REALM=$REACT_APP_KEYCLOAK_REALM \
    REACT_APP_KEYCLOAK_CLIENT_ID=$REACT_APP_KEYCLOAK_CLIENT_ID

# Build the React app for production
RUN npm run build

# Stage 2: Serve the app using Nginx
FROM nginx:alpine

# SPA fallback so client-side routes (e.g. /dashboard) survive a direct load/refresh
COPY nginx.conf /etc/nginx/conf.d/default.conf

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