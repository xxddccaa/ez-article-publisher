FROM mcr.microsoft.com/playwright:v1.57.0-noble

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    PORT=3001 \
    AUTO_OPEN_BROWSER=true \
    BROWSER_STATE_DIR=/data/profile \
    SCREENSHOTS_DIR=/data/screenshots \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    http_proxy= \
    https_proxy= \
    HTTP_PROXY= \
    HTTPS_PROXY= \
    ALL_PROXY= \
    all_proxy= \
    NO_PROXY= \
    no_proxy=

WORKDIR /app

RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy NO_PROXY no_proxy && \
    apt-get update && apt-get install -y --no-install-recommends \
    fluxbox \
    novnc \
    procps \
    websockify \
    x11vnc \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy NO_PROXY no_proxy && \
    npm install

COPY . .

RUN npm --workspace=@ez-publisher/backend run build

EXPOSE 3001 6080

CMD ["bash", "docker/start.sh"]
