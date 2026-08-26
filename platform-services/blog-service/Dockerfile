FROM node:22-slim

# node:22-slim's own cached layers lag behind Debian's package repo -
# upgrading in-place at build time picks up whatever's actually current
# instead of waiting on the base image tag to be rebuilt.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

# Install, then drop the npm CLI itself - build-time tool only (this app
# starts via `node index.js` directly), and its own vendored copies of
# brace-expansion/ip-address/picomatch/sigstore/tar otherwise show up as
# unfixable-by-us CVEs in image scans despite this app's code never
# importing them. Upgrading npm only chases whichever version has the
# fewest residual bundled CVEs at any moment; deleting it reaches zero.
RUN npm install && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY . .

EXPOSE 4003

CMD ["node", "index.js"]
