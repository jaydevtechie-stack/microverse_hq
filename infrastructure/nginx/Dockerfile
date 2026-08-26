FROM nginx:alpine

# nginx:alpine's own cached layers lag behind Alpine's package repo (same
# gap the earlier nginx:latest -> nginx:alpine switch fixed once, on a
# different CVE - upgrading in-place at build time decouples from
# waiting on the base image tag itself to be rebuilt).
RUN apk update && apk upgrade --no-cache

COPY conf.d/ /etc/nginx/conf.d/
COPY html/ /usr/share/nginx/html/