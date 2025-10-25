# Use the official Node 22 image
FROM node:22 AS builder

WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .

# Install ALL dependencies (including dev) to run the build
# "npm ci" is the standard for CI/Docker builds
RUN npm ci

COPY . .

# Run the TypeScript build script
# (Assumes you have a "build" script in package.json, e.g., "build": "tsc")
RUN npm run build


# --- STAGE 2: Production Environment ---
FROM node:22

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy the package manifests
COPY package.json .
COPY package-lock.json .

# Install ONLY production dependencies
RUN npm ci --only=production

# Copy the compiled code from the 'builder' stage
# This assumes your "build" script outputs to a 'dist' folder
COPY --from=builder /usr/src/app/build ./build

# Set the port
ENV PORT=2567
EXPOSE 2567

# The command to run your server
# This assumes your package.json has a "start" script
# e.g., "start": "node dist/index.js"
CMD ["node", "build/index.js"]