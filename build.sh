#!/bin/bash
set -e

echo "Installing root dependencies..."
npm install

echo "Installing api function dependencies..."
cd api && npm install --production=false && cd ..

echo "Installing and building server (coach backend -> server/dist)..."
cd server && npm install --production=false && npm run build && cd ..

echo "Installing and building web..."
cd web && npm install --production=false && npm run build && cd ..

echo "Build complete!"
