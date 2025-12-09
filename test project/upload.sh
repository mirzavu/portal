#!/bin/bash
# Upload script for Test Project ESP8266 device

PROJECT_DIR="/home/mirza/Documents/PlatformIO/Projects/test project"
PORT="/dev/ttyUSB1"

cd "$PROJECT_DIR"

echo "=========================================="
echo "Test Project Upload"
echo "=========================================="
echo ""

# Kill any existing serial monitors
pkill -f "picocom.*$PORT" 2>/dev/null
pkill -f "screen.*$PORT" 2>/dev/null
sleep 0.5

# Upload with extended timeout
echo "Uploading firmware..."
timeout 180 pio run -t upload

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Upload successful!"
else
    echo ""
    echo "✗ Upload failed."
    echo "Please check the connection and try again."
fi

