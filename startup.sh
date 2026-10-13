#!/bin/sh
# Restart contract: bring the preview back on 0.0.0.0:8080 if it is down.
if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi
cd /workspace
npm run dev > /tmp/vkole-dev.log 2>&1 &
exit 0
