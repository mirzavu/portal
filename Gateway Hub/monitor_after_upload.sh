#!/bin/bash
# Script to upload code and immediately start serial monitoring
# Usage: ./monitor_after_upload.sh [logfile]

PROJECT_DIR="/home/mirza/Documents/PlatformIO/Projects/Gateway Hub"
LOG_FILE="${1:-serial_output_$(date +%Y%m%d_%H%M%S).log}"
PORT="/dev/ttyUSB0"
BAUD=115200

cd "$PROJECT_DIR"

echo "Uploading code..."
pio run -t upload

if [ $? -eq 0 ]; then
    echo ""
    echo "Upload successful! Starting serial monitor..."
    echo "Output will be saved to: $LOG_FILE"
    echo "Press Ctrl+A then Ctrl+X to exit picocom"
    echo ""
    
    # Small delay to let the device reset
    sleep 1
    
    # Start picocom and capture output
    picocom -b $BAUD $PORT | tee "$LOG_FILE"
else
    echo "Upload failed. Not starting monitor."
    exit 1
fi

