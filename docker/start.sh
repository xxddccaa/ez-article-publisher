#!/usr/bin/env bash
set -euo pipefail

unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy NO_PROXY no_proxy

mkdir -p /tmp/.X11-unix /data/profile /data/screenshots
rm -f /data/profile/SingletonLock /data/profile/SingletonSocket /data/profile/SingletonCookie /data/profile/.org.chromium.*

echo "[startup] starting Xvfb on ${DISPLAY}"
Xvfb "${DISPLAY}" -screen 0 1440x960x24 >/tmp/xvfb.log 2>&1 &

echo "[startup] starting fluxbox"
fluxbox >/tmp/fluxbox.log 2>&1 &

echo "[startup] starting x11vnc on :5900"
x11vnc -display "${DISPLAY}" -forever -shared -rfbport 5900 -nopw -xkb >/tmp/x11vnc.log 2>&1 &

echo "[startup] starting noVNC on :6080"
websockify --web=/usr/share/novnc/ 6080 localhost:5900 >/tmp/novnc.log 2>&1 &

for _ in $(seq 1 20); do
  if [ -S "/tmp/.X11-unix/X${DISPLAY#:}" ]; then
    break
  fi
  sleep 0.5
done

echo "[startup] starting Nest API on :${PORT}"
exec node apps/backend/dist/main.js
