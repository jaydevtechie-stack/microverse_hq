# Step 1: Build Stage (Use official Node.js image to install dependencies and build)
FROM node:16 AS build

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json to install dependencies
COPY package.json package-lock.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application files to the container
COPY . .

# If you have a build step (e.g., TypeScript compilation or other processing)
# RUN npm run build (uncomment if applicable)

# Step 2: Production Stage (Use lighter image to run the service)
FROM node:16-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the node_modules from the build stage
COPY --from=build /app/node_modules /app/node_modules

# Copy the application files from the build stage
COPY --from=build /app /app

# Expose the port
EXPOSE 4001

CMD ["node", "index.js"]
