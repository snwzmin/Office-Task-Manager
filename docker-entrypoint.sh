#!/bin/bash

echo "[entrypoint] Starting Office Task Management..."

echo "[entrypoint] Running database migration..."
node /app/migrate.mjs
if [ $? -ne 0 ]; then
  echo "[entrypoint] WARNING: Migration step reported an error, continuing..."
fi

echo "[entrypoint] Running user seed..."
node /app/seed.mjs
if [ $? -ne 0 ]; then
  echo "[entrypoint] WARNING: Seed step reported an error, continuing..."
fi

echo "[entrypoint] Starting server on port ${PORT:-8080}..."
exec node /app/dist/index.mjs
