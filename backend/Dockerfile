FROM node:22-bookworm

WORKDIR /app

# System aktualisieren
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# FFmpeg prüfen
RUN which ffmpeg && ffmpeg -version

# Deno installieren
RUN curl -fsSL https://deno.land/install.sh | sh

ENV DENO_INSTALL=/root/.deno
ENV PATH="/root/.deno/bin:${PATH}"

# yt-dlp installieren
RUN pip3 install --break-system-packages --no-cache-dir -U yt-dlp

# Backend installieren
COPY backend/package.json ./

RUN npm install --omit=dev

# Backend kopieren
COPY backend/ ./

ENV PORT=10000

EXPOSE 10000

CMD ["node", "server.js"]