# ----------------------
# Base image
# ----------------------
FROM python:3.14-slim

# python:3.14-slim's own cached layers lag behind Debian's package repo -
# upgrading in-place at build time picks up whatever's actually current
# instead of waiting on the base image tag to be rebuilt.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies, then drop pip itself - build-time tool only (this
# app starts via `uvicorn`'s own console-script entry point, not pip),
# and pip vendors its own copy of msgpack for internal use that
# otherwise shows up as an unfixable-by-us CVE in image scans despite
# this app's code never importing msgpack.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    rm -rf /usr/local/lib/python3.14/site-packages/pip* /usr/local/bin/pip /usr/local/bin/pip3

# Copy app code
COPY app/ ./app/

# Expose port for FastAPI
EXPOSE 8000

# Start server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
