# node:16's ICU build can't handle node-cron's Intl.DateTimeFormat usage
# (RangeError: shortOffset out of range) — needs a current Node runtime
FROM node:22-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json for better cache layer handling
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
