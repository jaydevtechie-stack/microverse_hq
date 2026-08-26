FROM node:22-alpine

# node:22-alpine's own cached layers lag behind Alpine's package repo -
# upgrading in-place at build time picks up whatever's actually current
# instead of waiting on the base image tag to be rebuilt.
RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package.json package-lock.json* ./

# Install, then drop the npm CLI itself - build-time tool only (this app
# starts via `node src/server.js` directly), and its own vendored copies
# of brace-expansion/ip-address/picomatch/sigstore/tar otherwise show up
# as unfixable-by-us CVEs in image scans despite this app's code never
# importing them. Upgrading npm only chases whichever version has the
# fewest residual bundled CVEs at any moment; deleting it reaches zero.
RUN npm install --omit=dev && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY src ./src

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
