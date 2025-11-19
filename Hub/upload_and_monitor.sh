#!/bin/bash
# Script to upload code and capture serial output from the very beginning
# This kills any existing serial monitor, uploads, then immediately starts monitoring

PROJECT_DIR="/home/mirza/Documents/PlatformIO/Projects/Hub"
LOG_FILE="${1:-serial_output_$(date +%Y%m%d_%H%M%S).log}"

# Extract port from platformio.ini (prefer monitor_port, fallback to upload_port)
PORT=$(grep -E "^\s*(monitor_port|upload_port)\s*=" "$PROJECT_DIR/platformio.ini" | head -1 | sed -E 's/.*=\s*([^[:space:]]+).*/\1/' | tr -d ' ')
if [ -z "$PORT" ]; then
    echo "Error: Could not find monitor_port or upload_port in platformio.ini"
    exit 1
fi

# Extract baud rate from platformio.ini (default to 115200 if not found)
BAUD=$(grep -E "^\s*monitor_speed\s*=" "$PROJECT_DIR/platformio.ini" | head -1 | sed -E 's/.*=\s*([^[:space:]]+).*/\1/' | tr -d ' ')
BAUD=${BAUD:-115200}

cd "$PROJECT_DIR"

# Kill any existing picocom/screen processes using the port
echo "Stopping any existing serial monitors..."
pkill -f "picocom.*$PORT" 2>/dev/null
pkill -f "screen.*$PORT" 2>/dev/null
sleep 0.5

# Upload code
echo "Uploading code..."
pio run -t upload

if [ $? -eq 0 ]; then
    echo ""
    echo "Upload successful! Starting serial monitor immediately..."
    echo "Output will be saved to: $LOG_FILE"
    echo "Capturing serial output for 20 seconds..."
    echo ""
    
    # Use script to wrap picocom, forcing a TTY allocation
    # pipe tail -f /dev/null to keep picocom stdin open so it doesn't exit
    timeout 20 script -f -q -c "tail -f /dev/null | picocom -b $BAUD $PORT" "$LOG_FILE" || true
    
    echo ""
    echo "Capture complete. Log saved to: $LOG_FILE"
else
    echo "Upload failed. Not starting monitor."
    exit 1
fi

