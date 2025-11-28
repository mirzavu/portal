#!/usr/bin/env python3
"""Background serial monitor for Door Knock"""
import serial
import sys
from datetime import datetime

PORT = "/dev/ttyUSB0"
BAUD = 115200
LOG_FILE = f"serial_output_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

try:
    ser = serial.Serial(PORT, BAUD, timeout=1)
    print(f"Connected to {PORT} at {BAUD} baud", file=sys.stderr)
    print(f"Logging to: {LOG_FILE}", file=sys.stderr)
    
    with open(LOG_FILE, 'w') as log:
        while True:
            try:
                line = ser.readline()
                if line:
                    decoded = line.decode('utf-8', errors='replace').strip()
                    if decoded:
                        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        output = f"[{timestamp}] {decoded}\n"
                        print(output, end='', flush=True)
                        log.write(output)
                        log.flush()
            except Exception as e:
                print(f"Error reading: {e}", file=sys.stderr)
                break
except Exception as e:
    print(f"Failed to connect: {e}", file=sys.stderr)
    sys.exit(1)



