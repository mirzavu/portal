#!/usr/bin/env python3
import serial, time, sys

PORT = "/dev/ttyUSB1"
BAUD = 115200

try:
    s = serial.Serial(PORT, BAUD)
    
    # Reset NodeMCU
    s.dtr = False
    s.rts = True
    time.sleep(0.1)
    s.rts = False
    time.sleep(0.1)
    
    time.sleep(1)
    s.reset_input_buffer()
    print("Monitoring...", file=sys.stderr)

    while True:
        line = s.readline()
        if line:
            print(line.decode(errors="replace"), end="")

except KeyboardInterrupt:
    print("\nMonitor stopped.", file=sys.stderr)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)




