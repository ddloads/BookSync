FROM node:20-bookworm AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:web
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      python3 \
      python3-pip \
      python3-venv && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist-web ./dist-web
COPY --from=build /app/src/main/python ./src/main/python

RUN python3 -m venv /app/src/main/python/venv && \
    /app/src/main/python/venv/bin/pip install --no-cache-dir audible audible-cli httpx

ENV NODE_ENV=production
ENV PORT=3000
ENV BOOKSYNC_APP_PATH=/app
ENV BOOKSYNC_DATA_DIR=/config

VOLUME ["/config", "/downloads"]
EXPOSE 3000

CMD ["node", "dist-web/server/index.cjs"]
