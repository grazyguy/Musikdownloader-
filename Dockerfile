FROM node:22-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y ffmpeg python3 python3-pip curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deno.land/install.sh | sh

ENV DENO_INSTALL=/root/.deno
ENV PATH="/root/.deno/bin:${PATH}"

RUN pip3 install --break-system-packages --no-cache-dir -U yt-dlp

COPY backend/package.json ./

RUN npm install --omit=dev

COPY backend/ ./

ENV PORT=10000

EXPOSE 10000

CMD ["node", "server.js"]