# node:16 can't run kafkajs's modern toolchain comfortably and is
# effectively EOL — bumped to match task-service's runtime (node:22-slim)
# rather than keep the two Kafka-consuming Node services on different
# major versions.
FROM node:22-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4001

CMD ["node", "index.js"]
