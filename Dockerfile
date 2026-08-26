# ── Stage 1: Build React Frontend ──────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production FastAPI Backend ────────────────────────────────────
FROM python:3.10-slim

WORKDIR /app

# Ensure standard output and error streams are unbuffered (logs stream immediately to stdout)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Ensure scripts directory is available for CLI tools (e.g. resync_historical_contests.py)
RUN mkdir -p ./backend/scripts && touch ./backend/scripts/__init__.py


# Copy database and report directories (may be empty on first deploy — that's OK)
COPY data/ ./data/
COPY reports/ ./reports/

# Copy compiled React frontend from Stage 1
COPY --from=frontend-builder /frontend/dist ./frontend/dist/

# Copy Firebase service account key if present
COPY serviceAccountKey.json* ./

# Expose port (Cloud environment sets $PORT dynamically, defaults to 8000)
ENV PORT=8000
EXPOSE 8000
EXPOSE 10000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start server
CMD ["sh", "-c", "exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
