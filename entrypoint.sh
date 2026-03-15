#!/bin/sh
# Fix ownership of the bind-mounted data volume so appuser can write to it.
# This handles the common case where the host directory is owned by root.
chown -R appuser:appuser /app/data
exec gosu appuser uvicorn app.main:app --host 0.0.0.0 --port 8080
