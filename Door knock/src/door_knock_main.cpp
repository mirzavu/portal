/*
  DOOR KNOCK SENSOR v3.1
  - Hardware: SW-420 on RST, MOSFET on D2 (GPIO 4), Divider on A0
*/

#include <ESP8266WiFi.h>
#include <espnow.h>

// Gateway MAC Address
uint8_t gatewayAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// CHANNEL MUST MATCH GATEWAY
const uint8_t CHANNEL = 11; 

const int BATTERY_MOSFET_PIN = 4; // D2

// Calibration (Adjust this based on Multimeter comparison)
const float VOLTAGE_MULTIPLIER = 2.0; 

struct __attribute__((packed)) FullMessage {
  int random_id;
  float battery_v;
};

void OnDataSent(uint8_t *mac_addr, uint8_t sendStatus) {}

void setup() {
  // 1. FIX RANDOMNESS (Critical for Reset-based devices)
  randomSeed(micros());

  // 2. INIT PINS
  pinMode(BATTERY_MOSFET_PIN, OUTPUT);
  digitalWrite(BATTERY_MOSFET_PIN, LOW);

  // 3. BATTERY MEASUREMENT (Do this BEFORE WiFi to get true voltage)
  digitalWrite(BATTERY_MOSFET_PIN, HIGH); // Turn Switch ON
  delay(10);                              // Wait for caps to charge
  int rawADC = analogRead(A0);            // Read
  digitalWrite(BATTERY_MOSFET_PIN, LOW);  // Turn Switch OFF

  float voltage = (rawADC / 1024.0) * 3.3 * VOLTAGE_MULTIPLIER;

  // 4. WIFI INIT
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  wifi_set_channel(CHANNEL); 

  if (esp_now_init() != 0) {
    ESP.deepSleep(0);
    return;
  }

  esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
  esp_now_register_send_cb(OnDataSent);
  esp_now_add_peer(gatewayAddress, ESP_NOW_ROLE_SLAVE, CHANNEL, NULL, 0);

  // 5. SEND BURST
  FullMessage msg;
  msg.random_id = random(10000, 99999);
  msg.battery_v = voltage;

  for (int i = 0; i < 5; i++) {
    esp_now_send(gatewayAddress, (uint8_t *) &msg, sizeof(msg));
    delay(20); 
  }

  // 6. SLEEP
  ESP.deepSleep(0); 
}

void loop() {
}