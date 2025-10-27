# --- STAGE 1: Build Environment ---
FROM node:22 AS builder
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
RUN npm ci

COPY . .
# Ensure the correct config file is copied
COPY ecosystem.config.cjs .
RUN npm run build


# --- STAGE 2: Production Environment ---
FROM node:22
ENV NODE_ENV=production

# ---- Make sure this line is here and correct ----
RUN npm install -g pm2
# ----

WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
RUN npm ci --production

COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/ecosystem.config.cjs .

ENV PORT=2567
EXPOSE 2567

CMD ["npx", "pm2-runtime", "start", "ecosystem.config.cjs"]