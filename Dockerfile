FROM mcr.microsoft.com/playwright:v1.56.1-noble AS playwright

# Security Patch: Upgrade Node.js to >= 22.23.4 to resolve CVE-2026-111497 (Brotli RCE, CISA KEV)
USER root
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --only-upgrade nodejs && \
    node --version

WORKDIR /usr/src/app

FROM playwright AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM playwright
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

CMD ["node", "dist/main"]

