/*
  DOOR KNOCK SENSOR - TEST MODE (FAST PULSE) v3.2
  - Sends knocks EVERY 3 SECONDS
  - PURPOSE: Rapid fire to ensure Gateway catches one during short monitor windows
*/

#include <ESP8266WiFi.h>
#include <espnow.h>

// Gateway MAC Address (Broadcast)
uint8_t gatewayAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
const uint8_t CHANNEL = 11; 
const int BATTERY_MOSFET_PIN = 4; // D2
const float VOLTAGE_MULTIPLIER = 2.0; 

struct __attribute__((packed)) FullMessage {
  int random_id;
  float battery_v;
};

void OnDataSent(uint8_t *mac_addr, uint8_t sendStatus) {}

void setup() {
  Serial.begin(115200);
  pinMode(BATTERY_MOSFET_PIN, OUTPUT);
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  wifi_set_channel(CHANNEL); 
  
  if (esp_now_init() != 0) return;

  esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
  esp_now_register_send_cb(OnDataSent);
  esp_now_add_peer(gatewayAddress, ESP_NOW_ROLE_SLAVE, CHANNEL, NULL, 0);
}

void loop() {
  // 1. BATTERY
  digitalWrite(BATTERY_MOSFET_PIN, HIGH); delay(5);
  int rawADC = analogRead(A0);
  digitalWrite(BATTERY_MOSFET_PIN, LOW);
  float voltage = (rawADC / 1024.0) * 3.3 * VOLTAGE_MULTIPLIER;

  // 2. SEND MESSAGE
  FullMessage msg;
  msg.random_id = random(10000, 99999);
  msg.battery_v = voltage;
  
  // Burst
  for (int i = 0; i < 5; i++) {
    esp_now_send(gatewayAddress, (uint8_t *) &msg, sizeof(msg));
    delay(20); 
  }

  delay(3000); // Wait 3 seconds
}
