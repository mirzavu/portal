import serial
import threading
import time
import sys

# Configuration
PORTS = [
    {"name": "GATEWAY (USB0)", "port": "/dev/ttyUSB0", "baud": 115200},
    {"name": "DOOR_KNOCK (USB1)", "port": "/dev/ttyUSB1", "baud": 115200}
]

def read_from_port(config):
    name = config["name"]
    port = config["port"]
    baud = config["baud"]
    
    try:
        ser = serial.Serial(port, baud, timeout=1)
        print(f"[{name}] Connected")
        while True:
            try:
                line = ser.readline()
                if line:
                    try:
                        decoded = line.decode('utf-8', errors='replace').strip()
                        if decoded:
                            timestamp = time.strftime("%H:%M:%S")
                            print(f"[{timestamp}] [{name}] {decoded}")
                    except Exception:
                        pass
            except Exception as e:
                print(f"[{name}] Read Error: {e}")
                break
    except Exception as e:
        print(f"[{name}] Connection Failed: {e}")

threads = []
print("Starting Dual Monitor...")
for config in PORTS:
    t = threading.Thread(target=read_from_port, args=(config,))
    t.daemon = True
    t.start()
    threads.append(t)

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stopping...")

