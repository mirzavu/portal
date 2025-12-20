/*
 * HLK-LD2410C-P Human Presence Detection
 * Using UART data (more reliable than OUT pin)
 */

 #include <HardwareSerial.h>

 #define RADAR_RX_PIN 16
 #define RADAR_TX_PIN 17
 #define RADAR_OUT_PIN 4
 #define RADAR_BAUD 256000
 
 HardwareSerial RadarSerial(2);
 
 // Detection state
 bool presenceDetected = false;
 uint16_t movingDistance = 0;
 uint16_t stationaryDistance = 0;
 uint8_t movingEnergy = 0;
 uint8_t stationaryEnergy = 0;
 uint8_t targetState = 0;
 
 void setup() {
   Serial.begin(115200);
   delay(1000);
   
   Serial.println("\n=== HLK-LD2410C Presence Sensor ===");
   
   pinMode(RADAR_OUT_PIN, INPUT);
   RadarSerial.begin(RADAR_BAUD, SERIAL_8N1, RADAR_RX_PIN, RADAR_TX_PIN);
   
   Serial.println("Sensor ready!\n");
 }
 
 void loop() {
   static unsigned long lastPrintTime = 0;
   unsigned long currentTime = millis();
   
   // Parse UART data
   static uint8_t buffer[64];
   static int bufferIndex = 0;
   
   while (RadarSerial.available()) {
     uint8_t b = RadarSerial.read();
     
     // Look for frame header F4 F3 F2 F1
     if (bufferIndex == 0 && b != 0xF4) continue;
     if (bufferIndex == 1 && b != 0xF3) { bufferIndex = 0; continue; }
     if (bufferIndex == 2 && b != 0xF2) { bufferIndex = 0; continue; }
     if (bufferIndex == 3 && b != 0xF1) { bufferIndex = 0; continue; }
     
     buffer[bufferIndex++] = b;
     
     if (bufferIndex >= 64) {
       bufferIndex = 0;
       continue;
     }
     
     // Look for frame tail F8 F7 F6 F5
     if (bufferIndex >= 23) { // Minimum frame size
       for (int i = 4; i < bufferIndex - 3; i++) {
         if (buffer[i] == 0xF8 && buffer[i+1] == 0xF7 && 
             buffer[i+2] == 0xF6 && buffer[i+3] == 0xF5) {
           
           // Valid frame found - parse it
           if (i >= 17) {
             uint8_t dataType = buffer[6];
             uint8_t head = buffer[7];
             
             if (dataType == 0x02 && head == 0xAA) {
               // Basic mode data
               targetState = buffer[8];
               movingDistance = buffer[9] | (buffer[10] << 8);
               movingEnergy = buffer[11];
               stationaryDistance = buffer[12] | (buffer[13] << 8);
               stationaryEnergy = buffer[14];
               
               // Update presence status
               presenceDetected = (targetState != 0x00);
             }
           }
           
           bufferIndex = 0;
           break;
         }
       }
       
       if (bufferIndex >= 60) {
         bufferIndex = 0;
       }
     }
   }
   
   // Print status once per second
   if (currentTime - lastPrintTime >= 1000) {
     Serial.println("========================================");
     
     if (presenceDetected) {
       Serial.println("🟢 PRESENCE DETECTED");
       Serial.println();
       
       // Show target type
       Serial.print("Target Type: ");
       switch(targetState) {
         case 0x01: Serial.println("Moving only"); break;
         case 0x02: Serial.println("Stationary only"); break;
         case 0x03: Serial.println("Moving + Stationary"); break;
         default: Serial.println("Unknown"); break;
       }
       
       // Show details
       if (targetState & 0x01) { // Has moving target
         Serial.printf("  Moving Target: %d cm (Energy: %d)\n", movingDistance, movingEnergy);
       }
       if (targetState & 0x02) { // Has stationary target
         Serial.printf("  Stationary Target: %d cm (Energy: %d)\n", stationaryDistance, stationaryEnergy);
       }
       
       // Show closest distance
       uint16_t closestDist = 9999;
       if ((targetState & 0x01) && movingDistance > 0) {
         closestDist = movingDistance;
       }
       if ((targetState & 0x02) && stationaryDistance > 0 && stationaryDistance < closestDist) {
         closestDist = stationaryDistance;
       }
       if (closestDist < 9999) {
         Serial.printf("\n  📍 Closest: %.1f meters\n", closestDist / 100.0);
       }
       
     } else {
       Serial.println("⚫ No presence detected");
     }
     
     // Also show OUT pin status (for reference)
     bool outPin = digitalRead(RADAR_OUT_PIN);
     Serial.printf("\nOUT Pin: %s (not used - UART is better)\n", outPin ? "HIGH" : "LOW");
     
     Serial.println("========================================\n");
     
     lastPrintTime = currentTime;
   }
 }