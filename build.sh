#!/bin/bash
set -e

echo "Installing root dependencies..."
npm install

echo "Installing and building api..."
cd api && npm install --production=false && cd ..

echo "Installing and building apps/api..."
cd apps/api && npm install --production=false && npm run build && cd ../..

echo "Installing and building server..."
cd server && npm install --production=false && npm run build && cd ..

echo "Installing and building web..."
cd web && npm install --production=false && npm run build && cd ..

echo "Build complete!"
