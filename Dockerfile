# Build Stage
FROM node:20-bookworm AS build-stage

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Runtime Stage
FROM ghcr.io/linuxserver/webtop:ubuntu-mate

# Install system dependencies
# We only need Python and FFmpeg. Electron is bundled in node_modules.
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set up Python virtual environment
RUN python3 -m venv /app/src/main/python/venv
RUN /app/src/main/python/venv/bin/pip install audible audible-cli httpx

# Copy built files from build stage
COPY --from=build-stage /app/out ./out
COPY --from=build-stage /app/node_modules ./node_modules
COPY --from=build-stage /app/package.json ./package.json
COPY --from=build-stage /app/src/main/python/audible_wrapper.py ./src/main/python/audible_wrapper.py

# Create data and downloads directories
RUN mkdir -p /config/booksync /downloads

# Set environment variables for BookSync
ENV BOOKSYNC_DATA_DIR=/config/booksync
ENV NODE_ENV=production

# Webtop uses /config for persistence. 
# We'll add a startup script to the desktop to launch BookSync.
RUN mkdir -p /etc/services.d/booksync
RUN echo "#!/usr/bin/with-contenv bash\n\
exec s6-setuidgid abc /app/node_modules/.bin/electron /app/out/main/index.js --no-sandbox" > /etc/services.d/booksync/run
RUN chmod +x /etc/services.d/booksync/run

# Expose Webtop ports (3000 for HTTP, 3001 for HTTPS)
# and BookSync Companion API port (default 3000, we should probably change it to avoid conflict)
EXPOSE 3000 3001 3005
