FROM python:3.11-slim

WORKDIR /app

# Install system deps for Pillow (qrcode) and pandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Patch fit-tool field.py — it crashes on non-UTF8 bytes in FIT sport name fields.
# The fix: decode with errors='replace' instead of strict UTF-8.
RUN find /usr/local/lib -path "*/fit_tool/field.py" -exec \
    sed -i "s/bytes_buffer\.decode('utf-8')/bytes_buffer.decode('utf-8', errors='replace')/" {} \;

# Copy app
COPY . .

# Data and output dirs are mounted as volumes — create them so they exist
# even if the host hasn't mounted anything yet
RUN mkdir -p data output

EXPOSE 5000

ENV HOST=0.0.0.0
ENV PORT=5000

CMD ["python", "app.py"]
