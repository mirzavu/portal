/*
  DOOR KNOCK SENDER v4.1 (Final Production)
  - Hardware: 
    - SW-420 on RST (Knock Trigger)
    - D0 connected to RST (Timer Trigger)
    - MOSFET on D2 (Battery Switch)
    - Divider on A0
  - Logic: Distinguishes between "Knock" and "Heartbeat"
*/
#include <ESP8266WiFi.h>
#include <espnow.h>

// Gateway MAC Address
uint8_t gatewayAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
const uint8_t CHANNEL = 11;

const int BATTERY_MOSFET_PIN = 4; // D2
// Calibration: Adjust this to match your Multimeter!
const float VOLTAGE_MULTIPLIER = 2.0; 

struct __attribute__((packed)) FullMessage {
  uint8_t type;       // 0 = heartbeat, 1 = knock
  int random_id;      // used to detect duplicates
  float battery_v;
};

void OnDataSent(uint8_t *mac_addr, uint8_t sendStatus) {}

void setup() {
  // 1. FIX RANDOMNESS (Critical!)
  // If we don't do this, every 'Knock' might generate the same ID.
  randomSeed(micros());

  // 2. CHECK WAKE REASON
  bool isTimerWake = (ESP.getResetInfoPtr()->reason == REASON_DEEP_SLEEP_AWAKE);

  // 3. BATTERY MEASUREMENT (Do this FIRST for accuracy)
  pinMode(BATTERY_MOSFET_PIN, OUTPUT);
  digitalWrite(BATTERY_MOSFET_PIN, HIGH); // ON
  delay(10);                              
  int rawADC = analogRead(A0);
  digitalWrite(BATTERY_MOSFET_PIN, LOW);  // OFF
  
  float voltage = (rawADC / 1024.0) * 3.3 * VOLTAGE_MULTIPLIER;

  // 4. WIFI & ESP-NOW INIT
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  wifi_set_channel(CHANNEL); 

  if (esp_now_init() != 0) {
    // If WiFi fails, go back to sleep immediately
    ESP.deepSleep(3600e6); 
    return;
  }

  esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
  esp_now_register_send_cb(OnDataSent);
  esp_now_add_peer(gatewayAddress, ESP_NOW_ROLE_SLAVE, CHANNEL, NULL, 0);

  // 5. PREPARE MESSAGE
  FullMessage msg;
  msg.battery_v = voltage;
  if (isTimerWake) {
    msg.type = 0;          // heartbeat
    msg.random_id = 0;
  } else {
    msg.type = 1;          // knock
    msg.random_id = random(10000, 99999);
  }

  // 6. SEND BURST
  for (int i = 0; i < 5; i++) {
    esp_now_send(gatewayAddress, (uint8_t *) &msg, sizeof(msg));
    delay(20); 
  }

  // 7. DEEP SLEEP CONFIGURATION
  // 10e6   = 10 seconds (For Testing)
  // 3600e6 = 1 Hour (For Real Usage) - CHANGE THIS AFTER TESTING!
  ESP.deepSleep(10e6); 
}

void loop() {
}