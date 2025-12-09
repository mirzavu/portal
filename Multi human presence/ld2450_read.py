import serial
import math

port = "/dev/ttyUSB0"
baud = 256000

ser = serial.Serial(port, baud, timeout=0.1)

HEADER = [0xAA, 0xFF, 0x03, 0x00]
FOOTER = [0x55, 0xCC]
FRAME_SIZE = 30

buf = bytearray()

def find_header(data):
    for i in range(len(data) - 3):
        if list(data[i:i+4]) == HEADER:
            return i
    return -1

def parse_target(block):
    x_raw = block[0] | (block[1] << 8)
    y_raw = block[2] | (block[3] << 8)
    
    if block[1] & 0x80:
        x = x_raw - 32768
    else:
        x = -x_raw
    
    y = y_raw - 32768
    dist = math.sqrt(x*x + y*y) / 1000.0
    
    return (x, y, dist)

print("Reading LD2450")

while True:
    data = ser.read(200)
    if not data:
        continue
    
    buf.extend(data)
    
    while True:
        pos = find_header(buf)
        if pos < 0:
            break
        
        if len(buf) < pos + FRAME_SIZE:
            break
        
        frame = buf[pos:pos+FRAME_SIZE]
        
        if frame[-2] != FOOTER[0] or frame[-1] != FOOTER[1]:
            buf = buf[pos+1:]
            continue
        
        targets = []
        for i in range(3):
            block = frame[4 + i*8 : 4 + (i+1)*8]
            if any(block):
                targets.append(parse_target(block))
        
        print("Count:", len(targets))
        for i, t in enumerate(targets):
            print("Target", i + 1, "dist m:", round(t[2], 2))
        print()
        
        buf = buf[pos + FRAME_SIZE:]




