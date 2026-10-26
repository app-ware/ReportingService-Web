FROM mcr.microsoft.com/playwright:v1.56.1-noble AS playwright

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

