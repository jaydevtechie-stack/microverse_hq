# node:16 can't run kafkajs's modern toolchain comfortably and is
# effectively EOL — bumped to match task-service's runtime (node:22-slim)
# rather than keep the two Kafka-consuming Node services on different
# major versions.
FROM node:22-slim

# node:22-slim's own cached layers lag behind Debian's package repo -
# upgrading in-place at build time picks up whatever's actually current
# instead of waiting on the base image tag to be rebuilt.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4001

CMD ["node", "index.js"]
