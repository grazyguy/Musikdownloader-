FROM node:22-bookworm

WORKDIR /app

# Systemprogramme installieren
RUN apt-get update \
    && apt-get install -y ffmpeg python3 python3-pip curl \
    && rm -rf /var/lib/apt/lists/*

# Deno installieren
RUN curl -fsSL https://deno.land/install.sh | sh

ENV DENO_INSTALL=/root/.deno
ENV PATH="/root/.deno/bin:${PATH}"

# yt-dlp installieren
RUN pip3 install --break-system-packages --no-cache-dir -U yt-dlp

# Node-Abhängigkeiten
COPY package.json ./

RUN npm install --omit=dev

# Rest des Projekts
COPY . .

ENV PORT=10000

EXPOSE 10000

CMD ["node", "server.js"]