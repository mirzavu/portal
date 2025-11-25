/*
  REAL DOOR KNOCK SENDER (ESP8266) - PRODUCTION v3.2 (With Battery Monitor)
  - Hardware: SW-420 on RST, MOSFET on D2 (GPIO 4), Voltage Divider on A0
  - Logic: 
    1. Hardware Reset wakes chip
    2. Turn ON MOSFETs (D2)
    3. Read Battery (A0)
    4. Turn OFF MOSFETs (Save Power)
    5. Broadcast Data (Knock ID + Battery Voltage)
    6. Deep Sleep
*/
#include <ESP8266WiFi.h>
#include <espnow.h>

// Gateway MAC Address (Broadcast)
uint8_t gatewayAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
const uint8_t CHANNEL = 11;

// --- PIN DEFINITIONS ---
const int BATTERY_MOSFET_PIN = 4; // D2 on NodeMCU is GPIO 4
const float VOLTAGE_MULTIPLIER = 2.0; 

struct __attribute__((packed)) FullMessage {
  int random_id;    // Unique knock ID
  float battery_v;  // Battery Voltage
};

void OnDataSent(uint8_t *mac_addr, uint8_t sendStatus) {}

void setup() {
  // 1. FIX RANDOMNESS
  randomSeed(micros());

  // 2. BATTERY MEASUREMENT
  pinMode(BATTERY_MOSFET_PIN, OUTPUT);
  digitalWrite(BATTERY_MOSFET_PIN, HIGH); // Turn Switch ON
  delay(10);                              // Wait for caps to charge
  int rawADC = analogRead(A0);
  digitalWrite(BATTERY_MOSFET_PIN, LOW);  // Turn Switch OFF
  
  float voltage = (rawADC / 1024.0) * 3.3 * VOLTAGE_MULTIPLIER;

  // 3. WIFI & ESP-NOW INIT
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

  // 4. SEND MESSAGE
  FullMessage msg;
  msg.random_id = random(10000, 99999);
  msg.battery_v = voltage;

  // Send Burst (5 times to ensure delivery)
  for (int i = 0; i < 5; i++) {
    esp_now_send(gatewayAddress, (uint8_t *) &msg, sizeof(msg));
    delay(20); 
  }

  // 5. Deep Sleep (Device turns off until next knock)
  ESP.deepSleep(0); 
}

void loop() {
  // Never reached
}
