FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Bothost mounts the Git checkout over /app when the container starts.
# Keep the built Python application outside that mount to avoid import failures.
WORKDIR /usr/src/elite-russia
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY main.py ./main.py

# /app/data persists across deploys on Bothost. Preserve the old relative
# DATABASE_PATH=data/gifts.db by linking data/ to the persistent directory.
RUN mkdir -p /app/data \
    && ln -s /app/data /usr/src/elite-russia/data \
    && useradd --create-home scope \
    && chown -R scope:scope /usr/src/elite-russia /app/data

# Fail the build with a full traceback if an import or dependency is broken.
RUN python -c "from app.main import app; print('ASGI import OK:', app.title)"

USER scope

# PORT is supplied by Bothost and must match the reverse-proxy target.
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/api/health',timeout=4)"

CMD ["python", "/usr/src/elite-russia/main.py"]
