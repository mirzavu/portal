/*
  DOOR KNOCK SENSOR - AUTOMATED TEST MODE v3.1 (DEBUG)
  - Hardware: SW-420 on RST, MOSFET on D2, Divider on A0
  - Behavior: Wakes, measures, sends, waits 5s, repeats.
  - PURPOSE: To verify Gateway reception without physical knocking.
*/

#include <ESP8266WiFi.h>
#include <espnow.h>

// Gateway MAC Address (Broadcast)
uint8_t gatewayAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// CHANNEL MUST MATCH GATEWAY
const uint8_t CHANNEL = 11; 

const int BATTERY_MOSFET_PIN = 4; // D2

// Calibration
const float VOLTAGE_MULTIPLIER = 2.0; 

struct __attribute__((packed)) FullMessage {
  int random_id;
  float battery_v;
};

void OnDataSent(uint8_t *mac_addr, uint8_t sendStatus) {
  Serial.print("Packet Status: ");
  Serial.println(sendStatus == 0 ? "DELIVERED" : "FAILED");
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== DOOR KNOCK TEST MODE STARTING ===");
  
  randomSeed(micros());

  // 1. INIT PINS
  pinMode(BATTERY_MOSFET_PIN, OUTPUT);
  digitalWrite(BATTERY_MOSFET_PIN, LOW);

  // 2. WIFI INIT
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  wifi_set_channel(CHANNEL); 

  if (esp_now_init() != 0) {
    Serial.println("ESP-NOW Init Failed");
    return;
  }

  esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
  esp_now_register_send_cb(OnDataSent);
  esp_now_add_peer(gatewayAddress, ESP_NOW_ROLE_SLAVE, CHANNEL, NULL, 0);
  
  Serial.println("Setup Complete. Starting Loop...");
}

void loop() {
  Serial.println("\n--- [SIMULATING KNOCK] ---");

  // 1. BATTERY MEASUREMENT
  digitalWrite(BATTERY_MOSFET_PIN, HIGH); // Turn Switch ON
  delay(10);                              // Wait for caps to charge
  int rawADC = analogRead(A0);            // Read
  digitalWrite(BATTERY_MOSFET_PIN, LOW);  // Turn Switch OFF

  float voltage = (rawADC / 1024.0) * 3.3 * VOLTAGE_MULTIPLIER;
  Serial.print("Battery V: "); Serial.println(voltage);

  // 2. SEND MESSAGE
  FullMessage msg;
  msg.random_id = random(10000, 99999);
  msg.battery_v = voltage;
  
  Serial.print("Sending ID: "); Serial.println(msg.random_id);

  // Burst send to ensure delivery
  for (int i = 0; i < 5; i++) {
    esp_now_send(gatewayAddress, (uint8_t *) &msg, sizeof(msg));
    delay(20); 
  }

  Serial.println("Waiting 5 seconds...");
  delay(5000);
}
