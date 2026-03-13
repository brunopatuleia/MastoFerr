FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# Create a non-root user and hand over ownership of the app directory.
# The /app/data volume will be created on the host by Docker; the host
# directory must be writable by UID 1000 (or set via PUID/PGID).
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

# Lightweight health check — polls the stats API which requires no auth.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/stats')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
