/*
 * HLK-LD2450 Fixed Test Code
 * Hardware: ESP32 + HLK-LD2450
 * Wiring:
 * - LD2450 TX -> ESP32 GPIO 16 (RX2)
 * - LD2450 RX -> ESP32 GPIO 17 (TX2)
 * - LD2450 VCC -> 5V
 * - LD2450 GND -> GND
 */

#include <HardwareSerial.h>

// --- Configuration ---
#define RADAR_RX_PIN 16
#define RADAR_TX_PIN 17
#define RADAR_BAUD 256000

HardwareSerial RadarSerial(2); // Use UART2

// Protocol Constants
const uint8_t HEADER[4] = {0xAA, 0xFF, 0x03, 0x00};
const uint8_t FOOTER[2] = {0x55, 0xCC};

// Forward declaration
void parseFrame(uint8_t* frame);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== HLK-LD2450 Test Started ===");
  Serial.println("Initializing radar serial...");
  
  RadarSerial.begin(RADAR_BAUD, SERIAL_8N1, RADAR_RX_PIN, RADAR_TX_PIN);
  
  Serial.println("Ready! Waiting for data...\n");
}

void loop() {
  static uint8_t buffer[50];
  static int bufferIndex = 0;
  static unsigned long lastPrintTime = 0;
  const unsigned long PRINT_INTERVAL = 500; // Print every 500ms (2 times per second)
  
  // Read available bytes into buffer
  while (RadarSerial.available()) {
    uint8_t b = RadarSerial.read();
    
    // Look for header start
    if (bufferIndex == 0 && b != 0xAA) continue;
    
    buffer[bufferIndex++] = b;
    
    // If we have enough bytes for a full frame (30 bytes)
    if (bufferIndex >= 30) {
      // Verify header
      if (buffer[0] == 0xAA && buffer[1] == 0xFF && 
          buffer[2] == 0x03 && buffer[3] == 0x00 &&
          buffer[28] == 0x55 && buffer[29] == 0xCC) {
        
        // Valid frame! Check if enough time has passed before printing
        unsigned long currentTime = millis();
        if (currentTime - lastPrintTime >= PRINT_INTERVAL) {
          parseFrame(buffer);
          lastPrintTime = currentTime;
        }
        
        // Reset buffer
        bufferIndex = 0;
      } else {
        // Invalid frame, shift buffer by 1 and try again
        for (int i = 0; i < 29; i++) {
          buffer[i] = buffer[i + 1];
        }
        bufferIndex = 29;
      }
    }
  }
}

void parseFrame(uint8_t* frame) {
  Serial.println("========== FRAME RECEIVED ==========");
  
  int validTargets = 0;
  
  // Parse 3 targets (each is 8 bytes, starting at offset 4)
  for (int i = 0; i < 3; i++) {
    int offset = 4 + (i * 8);
    
    // Extract raw bytes
    uint8_t x_low = frame[offset + 0];
    uint8_t x_high = frame[offset + 1];
    uint8_t y_low = frame[offset + 2];
    uint8_t y_high = frame[offset + 3];
    uint8_t speed_low = frame[offset + 4];
    uint8_t speed_high = frame[offset + 5];
    uint8_t res_low = frame[offset + 6];
    uint8_t res_high = frame[offset + 7];
    
    // Combine into 16-bit values
    uint16_t x_raw = (x_high << 8) | x_low;
    uint16_t y_raw = (y_high << 8) | y_low;
    int16_t speed = (speed_high << 8) | speed_low;
    uint16_t resolution = (res_high << 8) | res_low;
    
    // Check if target slot has any data (all zeros = empty)
    bool hasData = (x_raw != 0 || y_raw != 0 || resolution != 0);
    
    if (hasData) {
      // Decode X coordinate (matching Python logic)
      int16_t x;
      if (x_high & 0x80) {
        // Sign bit set
        x = x_raw - 32768;
      } else {
        // Sign bit not set
        x = -x_raw;
      }
      
      // Decode Y coordinate (matching Python logic)
      int16_t y = y_raw - 32768;
      
      // Calculate distance
      float dist_mm = sqrt(x * x + y * y);
      float dist_m = dist_mm / 1000.0;
      
      validTargets++;
      
      Serial.printf("Target %d:\n", i + 1);
      Serial.printf("  Raw: X=0x%04X Y=0x%04X\n", x_raw, y_raw);
      Serial.printf("  Decoded: X=%d mm, Y=%d mm\n", x, y);
      Serial.printf("  Speed=%d, Resolution=%d\n", speed, resolution);
      Serial.printf("  Distance: %.2f m\n", dist_m);
      Serial.println();
    }
  }
  
  if (validTargets == 0) {
    Serial.println("No targets detected.");
  } else {
    Serial.printf("TOTAL TARGETS: %d\n", validTargets);
  }
  Serial.println("====================================\n");
}

