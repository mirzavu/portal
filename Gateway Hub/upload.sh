#!/bin/bash
# Upload script for Gateway Hub device

PROJECT_DIR="/home/mirza/Documents/PlatformIO/Projects/Gateway Hub"

cd "$PROJECT_DIR"

echo "=========================================="
echo "Gateway Hub Upload"
echo "=========================================="
echo ""

# Kill any existing serial monitors
PORT=$(grep -E "^upload_port\s*=" platformio.ini | sed 's/.*=\s*//' | tr -d ' ')
if [ -n "$PORT" ]; then
    pkill -f "picocom.*$PORT" 2>/dev/null
    pkill -f "screen.*$PORT" 2>/dev/null
    sleep 0.5
fi

# Upload with 3 minute timeout
echo "Uploading firmware..."
timeout 180 pio run -t upload

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Upload successful!"
else
    echo ""
    echo "✗ Upload failed."
    echo "If you see serial errors, retry the upload immediately."
fi

