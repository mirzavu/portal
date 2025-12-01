#!/bin/bash
# Upload script for Door Knock device using BOOT button method
# This avoids needing to disconnect D0-RST wire

PROJECT_DIR="/home/mirza/Documents/PlatformIO/Projects/Door knock"
PORT="/dev/ttyUSB0"

cd "$PROJECT_DIR"

echo "=========================================="
echo "Door Knock Upload (BOOT Button Method)"
echo "=========================================="
echo ""
echo "INSTRUCTIONS:"
echo "1. Keep D0-RST wire CONNECTED"
echo "2. Hold the BOOT button on your NodeMCU"
echo "3. Press ENTER when ready to upload"
echo ""
read -p "Press ENTER when BOOT button is held..."

# Kill any existing serial monitors
pkill -f "picocom.*$PORT" 2>/dev/null
pkill -f "screen.*$PORT" 2>/dev/null
sleep 0.5

# Reset device to enter bootloader mode
echo "Resetting device..."
python3 -c "import serial, time; s=serial.Serial('$PORT', 115200, timeout=1); s.dtr=False; s.rts=True; time.sleep(0.1); s.dtr=True; s.rts=False; time.sleep(0.1); s.close()"
sleep 1

# Upload with extended timeout
echo "Uploading firmware..."
echo "(Keep holding BOOT button until upload starts)"
timeout 180 pio run -t upload

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Upload successful!"
    echo "You can release the BOOT button now."
else
    echo ""
    echo "✗ Upload failed."
    echo "Try again: Hold BOOT button and press ENTER when ready."
fi




