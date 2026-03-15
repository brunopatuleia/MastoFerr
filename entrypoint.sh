#!/bin/sh
echo "[entrypoint] data dir before:"
ls -la /app/data/ 2>&1 || echo "[entrypoint] data dir not accessible"

# Try chown first; if it fails (e.g. unprivileged LXC), fall back to world-writable
if chown -R appuser:appuser /app/data 2>/dev/null; then
    echo "[entrypoint] chown succeeded"
else
    echo "[entrypoint] chown failed, falling back to chmod a+rw"
    chmod -R a+rw /app/data 2>/dev/null || echo "[entrypoint] chmod also failed — data volume may be read-only"
fi

echo "[entrypoint] data dir after:"
ls -la /app/data/ 2>&1

echo "[entrypoint] starting app as appuser"
exec gosu appuser uvicorn app.main:app --host 0.0.0.0 --port 8080
