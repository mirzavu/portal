/*
  REAL DOOR KNOCK SENDER (ESP8266) - PRODUCTION v1.0
  - Logic: Hardware Reset -> Send Broadcast Burst (Channel 11) -> Deep Sleep
  - Robustness: Broadcast ensures reception even if Gateway MAC slightly changes (as long as on Channel 11)
  - Burst: Sends 10 packets to ensure delivery
*/
#include <ESP8266WiFi.h>
#include <espnow.h>

// Gateway MAC Address (Broadcast)
uint8_t gatewayAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
const uint8_t CHANNEL = 11;

// Message Structure (Matches Gateway)
struct __attribute__((packed)) MinimalMessage {
  int random_id;
};

// Callback - Not strictly needed for Broadcast but good for debug
void OnDataSent(uint8_t *mac_addr, uint8_t sendStatus) {
  // Serial.print(F("Send Status: "));
  // if (sendStatus == 0) Serial.println(F("Success"));
  // else Serial.println(F("Fail"));
}

void setup() {
  // Optional: Brief Serial for debug, but keep it short to save power/time
  Serial.begin(115200);
  // Serial.println(F("\nKnock Detected! Waking up..."));

  // 1. Init WiFi in Station Mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  
  // 2. Set Channel (CRITICAL)
  wifi_set_channel(CHANNEL); 

  // 3. Init ESP-NOW
  if (esp_now_init() != 0) {
    // Serial.println(F("ESP-NOW Init Failed"));
    ESP.deepSleep(0);
    return;
  }

  // 4. Set Role & Register Callback
  esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
  esp_now_register_send_cb(OnDataSent);

  // 5. Add Peer (Broadcast)
  esp_now_add_peer(gatewayAddress, ESP_NOW_ROLE_SLAVE, CHANNEL, NULL, 0);

  // 6. Prepare Message
  MinimalMessage msg;
  msg.random_id = random(1000, 9999); // Random ID to identify unique knocks

  // 7. Send Burst (Broadcast is unreliable, so we send multiple times)
  // Serial.println(F("Sending Burst..."));
  for (int i = 0; i < 5; i++) {
    esp_now_send(gatewayAddress, (uint8_t *) &msg, sizeof(msg));
    delay(20); // Small delay between packets
  }
  // Serial.println(F("Burst Sent. Sleeping..."));

  // 8. Deep Sleep (Indefinite, until next Reset/Knock)
  ESP.deepSleep(0); 
}

void loop() {
  // Should never reach here
}
