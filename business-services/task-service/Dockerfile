# node:16's ICU build can't handle node-cron's Intl.DateTimeFormat usage
# (RangeError: shortOffset out of range) — needs a current Node runtime
FROM node:22-slim

# node:22-slim's own cached layers lag behind Debian's package repo -
# upgrading in-place at build time picks up whatever's actually current
# instead of waiting on the base image tag to be rebuilt.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json for better cache layer handling
COPY package*.json ./

# Install the dependencies, then drop the npm CLI itself - it's a
# build-time tool only (the app starts via `node server.js` directly,
# below), and its own vendored copies of brace-expansion/ip-address/
# picomatch/sigstore/tar otherwise show up as unfixable-by-us CVEs in
# image scans despite this app's code never importing them. Verified:
# upgrading npm only chases whichever version has the fewest residual
# bundled CVEs at any moment (didn't reach zero); deleting it outright
# does.
RUN npm install && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy the rest of the application files
COPY . .

# Expose the port the app will run on
EXPOSE 3000

# Start the application directly - not `npm start`, npm no longer exists
# in this image (see above)
CMD ["node", "server.js"]
