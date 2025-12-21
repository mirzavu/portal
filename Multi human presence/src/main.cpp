/*
 * HLK-LD2410C-P Battery Master (LED Feedback Edition)
 * Wiring: Matches your final Perfboard.
 */

#include <Arduino.h>
#include <HardwareSerial.h>
#include <driver/rtc_io.h>
#include "esp_adc_cal.h"
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
 
 // --- Pin Definitions ---
 #define PIN_RADAR_POWER  18    // MOSFET Switch
 #define PIN_RADAR_RX     16   // ESP32 RX <- Radar TX
 #define PIN_RADAR_TX     17   // ESP32 TX -> Radar RX
 #define PIN_RADAR_OUT    4    // Digital Presence Pin
 #define PIN_BATTERY      34   // Voltage Divider
 #define PIN_LED          2    // Onboard LED
 
 // --- Configuration ---
 #define SLEEP_SECONDS    15   // Sleep duration
 #define RADAR_BAUD       256000 
 #define WARMUP_MS        2000 // Increased to 2.0s for stability
 #define DIVIDER_RATIO    2.0  // 100k/100k
 #define ADC_CAL_FACTOR   1.000  // Calibration factor (adjusted: actual 1.760V / measured 1.952V)

 // --- ESP-NOW Settings ---
 uint8_t gatewayAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
 const uint8_t WIFI_CHANNEL = 6; // Locked to channel 6

 // Message struct for ESP-NOW transmission
 struct __attribute__((packed)) PresenceMessage {
   uint8_t device_type;  // 2 = human presence sensor
   float voltage;
   uint8_t presence;     // 1 = yes, 0 = no
   int16_t distance;     // Distance in cm, -1 if no presence
 };
 
 HardwareSerial RadarSerial(2);
 
// --- Global Variables for Data ---
bool presenceDetected = false;
int distance = 0;
uint8_t targetState = 0;  // 0x00=clear, 0x01=moving, 0x02=stationary, 0x03=both
esp_adc_cal_characteristics_t adc_chars;
 
 // --- Forward Declarations ---
 
 float readBattery();
 bool captureRadarData(unsigned long timeout);
 void sendToGateway(float voltage, bool presence, int distance);
 
 void setup() {
   // 1. Init System
   Serial.begin(115200);
   pinMode(PIN_LED, OUTPUT);
   
   // STATUS: LED ON (I am awake)
   digitalWrite(PIN_LED, HIGH); 
   Serial.println("\n--- Waking Up ---");
 
   // 2. Power Up Radar
   pinMode(PIN_RADAR_POWER, OUTPUT);
   digitalWrite(PIN_RADAR_POWER, HIGH); 
   
   // 3. Start Serial & Pins
   RadarSerial.begin(RADAR_BAUD, SERIAL_8N1, PIN_RADAR_RX, PIN_RADAR_TX);
   pinMode(PIN_RADAR_OUT, INPUT);
 
   // 4. Warm Up (Wait for Radar to boot)
   Serial.println("Radar ON. Warming up...");
   delay(WARMUP_MS); 
 
  // 5. Read Battery (Should act as "Load Test")
  adc1_config_width(ADC_WIDTH_BIT_12);
  adc1_config_channel_atten(ADC1_CHANNEL_6, ADC_ATTEN_DB_12); // GPIO34
  // Use 0 to let ESP32 use eFuse calibration value
  esp_adc_cal_value_t val_type = esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_12, ADC_WIDTH_BIT_12, 0, &adc_chars);
  if (val_type == ESP_ADC_CAL_VAL_EFUSE_VREF) {
    Serial.println("ADC: Using eFuse Vref");
  } else if (val_type == ESP_ADC_CAL_VAL_EFUSE_TP) {
    Serial.println("ADC: Using eFuse Two Point");
  } else {
    Serial.println("ADC: Using Default Vref");
  }
  float volts = readBattery();
   Serial.printf("Battery: %.2f V\n", volts);
 
   // 6. Capture Data (Using your Robust Parser)
   Serial.println("Listening for data...");
   
   // Try to read UART data for up to 4000ms
   bool validPacket = captureRadarData(4000);

   // 7. Report Presence Status
   Serial.println("========================================");
   Serial.println("PRESENCE DETECTION REPORT");
   Serial.println("========================================");
   
   bool finalPresence = false;

   if (validPacket) {
     Serial.println("Status: UART Data Received");
     Serial.printf("Presence: %s\n", presenceDetected ? "YES" : "NO");
     
     if (presenceDetected) {
       Serial.printf("Distance: %d cm\n", distance);
       
       // Show target type
       Serial.print("Target Type: ");
       if (targetState == 0x01) {
         Serial.println("Moving");
       } else if (targetState == 0x02) {
         Serial.println("Stationary");
       } else if (targetState == 0x03) {
         Serial.println("Moving + Stationary");
       } else {
         Serial.println("Unknown");
       }
       finalPresence = true;
     } else {
       Serial.println("Distance: N/A (Room Clear)");
     }
   } else {
     // Fallback if UART fails
     Serial.println("Status: UART Timeout - Using PIN 4 fallback");
     bool pinPresence = (digitalRead(PIN_RADAR_OUT) == HIGH);
     Serial.printf("Presence: %s\n", pinPresence ? "YES" : "NO");
     Serial.println("Distance: N/A (UART failed)");
     finalPresence = pinPresence;
   }
   
   Serial.println("========================================");

   // 8. Send data to Gateway via ESP-NOW
   int finalDistance = finalPresence ? distance : -1;
   sendToGateway(volts, finalPresence, finalDistance);

   // 9. VISUAL FEEDBACK (The "Blind Test")
   if (finalPresence) {
     // BLINK RAPIDLY if person detected
     for(int i=0; i<10; i++) {
       digitalWrite(PIN_LED, LOW);
       delay(100);
       digitalWrite(PIN_LED, HIGH);
       delay(100);
     }
   } else {
     // Turn off immediately if empty
     digitalWrite(PIN_LED, LOW); 
   }
 
   // 10. SHUTDOWN SEQUENCE
   Serial.println("Sleeping...");
   Serial.flush();
 
   // A. Cut Power
   digitalWrite(PIN_RADAR_POWER, LOW);
   gpio_hold_dis((gpio_num_t)PIN_RADAR_POWER);
 
   // B. Neutralize Data Pins (Fix 0.7V Leakage)
   RadarSerial.end();
   pinMode(PIN_RADAR_RX, OUTPUT);
   pinMode(PIN_RADAR_TX, OUTPUT);
   digitalWrite(PIN_RADAR_RX, LOW);
   digitalWrite(PIN_RADAR_TX, LOW);
 
   digitalWrite(PIN_LED, LOW); // Ensure LED is off
 
   // C. Deep Sleep
   esp_sleep_enable_timer_wakeup(SLEEP_SECONDS * 1000000ULL);
   esp_deep_sleep_start();
 }
 
 void loop() {
   // Deep sleep ignores loop
 }
 
// --- Battery Reader ---
float readBattery() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += adc1_get_raw(ADC1_CHANNEL_6);
    delay(2);
  }
  uint32_t avg = sum / 16;

  uint32_t mv = esp_adc_cal_raw_to_voltage(avg, &adc_chars);
  float pinVoltage = (mv / 1000.0) ; // Apply calibration factor
  
  Serial.printf("ADC Raw: %lu, Pin Voltage: %.3f V, ", avg, pinVoltage);
  
  return pinVoltage * 2.0; // divider
}
 
 // --- Robust Radar Parser (From your working code) ---
 bool captureRadarData(unsigned long timeout) {
   unsigned long start = millis();
   static uint8_t buffer[64];
   static int bufIdx = 0;
   
   // Clear old buffer
   while(RadarSerial.available()) RadarSerial.read();
 
   while (millis() - start < timeout) {
     while (RadarSerial.available()) {
       uint8_t b = RadarSerial.read();
 
       // Look for Header F4 F3 F2 F1
       if (bufIdx == 0 && b != 0xF4) continue;
       if (bufIdx == 1 && b != 0xF3) { bufIdx = 0; continue; }
       if (bufIdx == 2 && b != 0xF2) { bufIdx = 0; continue; }
       if (bufIdx == 3 && b != 0xF1) { bufIdx = 0; continue; }
 
       buffer[bufIdx++] = b;
 
       if (bufIdx >= 60) bufIdx = 0; // Overflow protection
 
       // Check for Tail F8 F7 F6 F5
       if (bufIdx >= 23) {
          if (buffer[bufIdx-4] == 0xF8 && buffer[bufIdx-3] == 0xF7 &&
              buffer[bufIdx-2] == 0xF6 && buffer[bufIdx-1] == 0xF5) {
              
              // Valid Frame Found! Parse it.
              uint8_t type = buffer[6];
              if (type == 0x02 || type == 0x01) { // Basic Data
                  uint8_t state = buffer[8];
                  uint16_t dist = buffer[9] | (buffer[10] << 8);
                  
                  targetState = state;
                  presenceDetected = (state != 0x00);
                  distance = dist;
                  return true; // Success
              }
              // If not Type 0x02, reset and keep looking
              bufIdx = 0;
          }
       }
     }
     delay(10); // Small yield
   }
   return false; // Timeout
 }

 // --- ESP-NOW Transmission Function ---
 void sendToGateway(float voltage, bool presence, int distance) {
   Serial.println("\n--- Sending to Gateway via ESP-NOW ---");
   
   // 1. Init WiFi (Station Mode)
   WiFi.mode(WIFI_STA);
   esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N | WIFI_PROTOCOL_LR);

   // 2. Init ESP-NOW
   if (esp_now_init() != ESP_OK) {
     Serial.println("ESP-NOW Init Failed!");
     return;
   }

   // 3. Register Peer
   esp_now_peer_info_t peerInfo;
   memset(&peerInfo, 0, sizeof(peerInfo));
   memcpy(peerInfo.peer_addr, gatewayAddress, 6);
   peerInfo.channel = 0; // Use current radio channel
   peerInfo.encrypt = false;
   esp_now_add_peer(&peerInfo);

   // 4. Prepare Message
   PresenceMessage msg;
   msg.device_type = 2; // Human presence sensor
   msg.voltage = voltage;
   msg.presence = presence ? 1 : 0;
   msg.distance = presence ? distance : -1;

   Serial.printf("Message: Type=%d, Voltage=%.2fV, Presence=%s, Distance=%d cm\n",
                 msg.device_type, msg.voltage, presence ? "YES" : "NO", msg.distance);

   // 5. Set Radio to Channel 6 and Send
   esp_wifi_set_promiscuous(true);
   esp_wifi_set_channel(WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
   esp_wifi_set_promiscuous(false);
   
   Serial.printf(">> Sending on CH %d... ", WIFI_CHANNEL);
   
   // Send twice for reliability
   esp_now_send(gatewayAddress, (uint8_t *)&msg, sizeof(msg));
   delay(10);
   esp_now_send(gatewayAddress, (uint8_t *)&msg, sizeof(msg));
   
   Serial.println("Done.");
   
   // Clean up ESP-NOW
   esp_now_deinit();
   WiFi.mode(WIFI_OFF);
 }