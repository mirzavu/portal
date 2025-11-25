/* Gateway Hub - Full System v1.4 (PROMISCUOUS DEBUG)
 * - Forces Channel 11
 * - Prints ALL ESP-NOW traffic regardless of MAC
 */

#include <Arduino.h>
#include <SPI.h>
#include <RF24.h>              
#include <WiFi.h>               
#include <HTTPClient.h>         
#include <WiFiClientSecure.h>   
#include <esp_now.h>            
#include <esp_wifi.h>           
#include <time.h>

const char* WIFI_SSID = "TheBoss";
const char* WIFI_PASSWORD = "12121234";
const char* PUSHOVER_USER_KEY = "u3y941692491128964968594379652";
const char* PUSHOVER_API_TOKEN = "a79626153172523165943874357349";

// Force Channel 11
#define WIFI_CHANNEL 11

struct __attribute__((packed)) DoorKnockMessage {
  int random_id;    
  float battery_v;  
};

volatile bool newDoorKnockReceived = false;
volatile DoorKnockMessage doorKnockData;

void connectToWiFi();
void initESPNOW();
void onESPNOWDataRecv(const uint8_t *mac, const uint8_t *data, int len);
void sendPushover(String message, String title);

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n\n==== GATEWAY HUB STARTING (FORCE CHAN 11) ====");

  // 1. Init WiFi in Station Mode
  WiFi.mode(WIFI_STA);
  
  // 2. Init ESP-NOW immediately
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Init Failed");
    ESP.restart();
  }
  esp_now_register_recv_cb(onESPNOWDataRecv);

  // 3. Connect to WiFi (Let it auto-negotiate, but check channel after)
  connectToWiFi();
  
  // 4. FORCE CHANNEL if it drifted
  if (WiFi.channel() != WIFI_CHANNEL) {
    Serial.print("Router is on Channel "); Serial.println(WiFi.channel());
    Serial.print("Forcing to Channel "); Serial.println(WIFI_CHANNEL);
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);
  }

  Serial.print("Final Operational Channel: ");
  Serial.println(WiFi.channel());
  
  Serial.println("\n✓ Gateway Hub Ready");
}

void loop() {
  if (newDoorKnockReceived) {
      Serial.println("--------------------------------");
      Serial.print("DOOR KNOCK RECEIVED! ID: ");
      Serial.println(doorKnockData.random_id);
      
      String msg = "Knock Detected! Bat: " + String(doorKnockData.battery_v, 2) + "V";
      sendPushover(msg, "Door Security");

      newDoorKnockReceived = false;
  }

  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 2000) {
      // Re-enforce channel periodically just in case
      if (WiFi.channel() != WIFI_CHANNEL) {
         Serial.print("Drifted to "); Serial.println(WiFi.channel());
         // esp_wifi_set_promiscuous(true);
         // esp_wifi_set_channel(WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
         // esp_wifi_set_promiscuous(false);
      }
      lastPrint = millis();
  }

  delay(10);
}

void connectToWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
  }
}

void onESPNOWDataRecv(const uint8_t *mac, const uint8_t *data, int len) {
  Serial.print("RX Packet from: ");
  for(int i=0; i<6; i++) { Serial.print(mac[i], HEX); if(i<5) Serial.print(":"); }
  Serial.print(" | Len: "); Serial.println(len);

  if (len == sizeof(DoorKnockMessage)) {
    memcpy((void*)&doorKnockData, data, sizeof(DoorKnockMessage));
    newDoorKnockReceived = true;
  }
}

void sendPushover(String message, String title) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure(); 

    String url = "https://api.pushover.net/1/messages.json";
    Serial.println("Sending Pushover...");
    
    http.begin(client, url);
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    
    String postData = "token=" + String(PUSHOVER_API_TOKEN) + 
                      "&user=" + String(PUSHOVER_USER_KEY) + 
                      "&message=" + message + 
                      "&title=" + title + 
                      "&priority=1" + 
                      "&sound=persistent";

    int httpResponseCode = http.POST(postData);
    Serial.print("HTTP Code: "); Serial.println(httpResponseCode);
    http.end();
  } else {
    Serial.println("WiFi Disconnected. Cannot send Pushover.");
  }
}
