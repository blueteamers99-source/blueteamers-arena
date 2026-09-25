FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/staticfiles /app/mediafiles

EXPOSE 8000

# ASGI server (not WSGI): gunicorn with UvicornWorker serves BOTH the HTTP
# API and Django Channels WebSockets (ws/leaderboard/..., ws/arena/...) from
# one process. The previous WSGI CMD silently dropped all WebSocket traffic.
CMD ["gunicorn", "config.asgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--threads", "2", "-k", "uvicorn.workers.UvicornWorker", "--log-level", "warning", "--access-logfile", "-", "--error-logfile", "-"]
