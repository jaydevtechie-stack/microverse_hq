FROM node:22-slim

# node:22-slim's own cached layers lag behind Debian's package repo -
# upgrading in-place at build time picks up whatever's actually current
# instead of waiting on the base image tag to be rebuilt.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

# The bundled npm CLI vendors its own copies of brace-expansion/
# ip-address/picomatch/sigstore/tar for its own internal use - Trivy
# flags CVEs in those even though this app's own code never imports
# them. Upgrading npm (tried first) only chases whichever version has
# the fewest residual bundled CVEs at any given moment, and still didn't
# reach zero. This app only ever runs `node index.js` - npm itself is
# a build-time tool, never invoked at runtime - so removing its files
# after install finishes drops the vendored CVEs from the image
# entirely instead of playing whack-a-mole with npm's own version churn.
RUN npm install && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY . .

EXPOSE 4002

CMD ["node", "index.js"]
