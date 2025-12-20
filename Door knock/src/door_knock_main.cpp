#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

// ================= WIRING CONFIG =================
const gpio_num_t PIN_KNOCK_WAKE = GPIO_NUM_4;
const int PIN_MOSFET = 25;
const int PIN_BAT_ADC = 34;

// ================= SETTINGS =================
uint8_t gatewayAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// ROUTER HOPPING FIX: We will send on BOTH channels
const uint8_t channelList[] = {6, 11}; 

#define uS_TO_S_FACTOR 1000000ULL
#define TIME_TO_SLEEP  3600

RTC_DATA_ATTR int bootCount = 0;

struct __attribute__((packed)) FullMessage {
  uint8_t type;
  int random_id;
  float voltage;
};

// ================= HELPERS =================

float readBattery() {
  pinMode(PIN_MOSFET, OUTPUT);
  digitalWrite(PIN_MOSFET, HIGH);
  delay(10); 
  long sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(PIN_BAT_ADC);
    delay(2);
  }
  digitalWrite(PIN_MOSFET, LOW);
  return (sum / 16.0 / 4095.0) * 3.3 * 2.0;
}

void onSent(const uint8_t *mac_addr, esp_now_send_status_t status) {}

// ================= SETUP =================

void setup() {
  Serial.begin(115200);
  bootCount++;

  // 1. Determine Wakeup Reason
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  uint8_t msgType = (wakeup_reason == ESP_SLEEP_WAKEUP_EXT0) ? 1 : 0;

  // 2. Init WiFi (Station Mode)
  WiFi.mode(WIFI_STA);
  esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N | WIFI_PROTOCOL_LR);

  // 3. Init ESP-NOW
  if (esp_now_init() != ESP_OK) return;
  esp_now_register_send_cb(onSent);

  // 4. Register Peer (IMPORTANT: Set channel to 0 so we can switch dynamicallly)
  esp_now_peer_info_t peerInfo;
  memset(&peerInfo, 0, sizeof(peerInfo));
  memcpy(peerInfo.peer_addr, gatewayAddress, 6);
  peerInfo.channel = 0; // 0 = "Use current radio channel"
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  // 5. Prepare Message
  FullMessage m;
  m.type = msgType;
  m.random_id = random(10000, 99999);
  m.voltage = readBattery();

  // 6. CHANNEL HOPPING SEND LOOP
  // Send on Channel 6, then switch and send on Channel 11
  for (int i = 0; i < 2; i++) {
    int currentCh = channelList[i];
    
    // Force Radio to new channel
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(currentCh, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);
    
    Serial.printf(">> Sending on CH %d... ", currentCh);
    
    // Send twice per channel for reliability
    esp_now_send(gatewayAddress, (uint8_t *)&m, sizeof(m));
    delay(10);
    esp_now_send(gatewayAddress, (uint8_t *)&m, sizeof(m));
    delay(10);
    
    Serial.println("Done.");
  }

  // 7. SLEEP
  pinMode(PIN_KNOCK_WAKE, INPUT_PULLUP);
  esp_sleep_enable_ext0_wakeup(PIN_KNOCK_WAKE, 0);
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void loop() {}
