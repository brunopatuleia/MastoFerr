FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    gosu \
    tini \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY entrypoint.sh /entrypoint.sh

# Create a non-root user. The entrypoint will fix data volume ownership at
# runtime before dropping from root to appuser via gosu.
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app && \
    chmod +x /entrypoint.sh

EXPOSE 8080

# Lightweight health check — /health requires no auth and always returns 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=5).getcode() == 200 else 1)"

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
