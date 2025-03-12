# Use an official Node.js runtime as the base image
FROM node:16-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code into the container
COPY . .

# Set a default port (can be overridden by Docker Compose)
ENV PORT=3000
ENV SERVER_INDEX=1

# Expose the port
EXPOSE ${PORT}

# Start the server (adjust the filename if needed)
CMD ["node", "server.js"]
