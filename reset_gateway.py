import serial
import time
import sys

port = "/dev/ttyUSB0"
baud = 115200

try:
    s = serial.Serial(port, baud)
    s.dtr = False
    s.rts = False
    time.sleep(0.1)
    s.dtr = True
    s.rts = True
    time.sleep(0.1)
    s.dtr = False
    s.rts = False
    s.close()
    print("Reset signal sent")
except Exception as e:
    print(f"Error: {e}")

