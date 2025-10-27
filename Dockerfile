# Use the official Node 22 image
FROM node:22 AS builder

WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .

# Install ALL dependencies (including dev) to run the build
# "npm ci" is the standard for CI/Docker builds
RUN npm ci

COPY . .

COPY ecosystem.config.cjs .
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
COPY --from=builder /usr/src/app/ecosystem.config.cjs .

# Set the port
ENV PORT=2567
EXPOSE 2567

# Use the .cjs file in the CMD
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]