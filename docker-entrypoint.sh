#!/bin/bash

# Start Xvfb (Virtual Framebuffer)
Xvfb :99 -screen 0 1280x800x24 &

# Give Xvfb a moment to start
sleep 2

# Path to the python venv
export PATH="/app/src/main/python/venv/bin:$PATH"

# Run the app
# --no-sandbox is often required in Docker containers for Chrome/Electron
exec ./node_modules/.bin/electron ./out/main/index.js --no-sandbox
