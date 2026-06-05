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
      build-essential \
      ca-certificates \
      ffmpeg \
      python3 \
      python3-pip \
      python3-venv && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3
COPY --from=build /app/dist-web ./dist-web
COPY --from=build /app/src/main/python ./src/main/python

RUN python3 -m venv /app/src/main/python/venv && \
    /app/src/main/python/venv/bin/pip install --no-cache-dir audible==0.8.2 audible-cli==0.3.2 httpx==0.23.3

ENV NODE_ENV=production
ENV PORT=3000
ENV BOOKSYNC_APP_PATH=/app
ENV BOOKSYNC_DATA_DIR=/config
ENV BOOKSYNC_FFMPEG_PATH=/usr/bin/ffmpeg

VOLUME ["/config", "/downloads"]
EXPOSE 3000

CMD ["node", "dist-web/server/index.cjs"]
