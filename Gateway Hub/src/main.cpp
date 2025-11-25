/* Gateway Hub - Full System v1.9 (CORRECT CREDENTIALS)
 * - Forces Channel 11
 * - Sends Pushover with VERIFIED credentials
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

// VERIFIED CREDENTIALS
const char* PUSHOVER_USER_KEY = "u9b5w63h547sn7nyd3139zupeguish"; 
const char* PUSHOVER_API_TOKEN = "aa2c5h1msgmuta92zgjbc6w6qfa5k3"; 

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
String urlEncode(String str);

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n\n==== GATEWAY HUB STARTING (FINAL) ====");

  WiFi.mode(WIFI_STA);
  if (esp_now_init() != ESP_OK) ESP.restart();
  esp_now_register_recv_cb(onESPNOWDataRecv);

  connectToWiFi();
  
  if (WiFi.channel() != WIFI_CHANNEL) {
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);
  }

  Serial.print("Channel: "); Serial.println(WiFi.channel());
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
  if (len == sizeof(DoorKnockMessage)) {
    memcpy((void*)&doorKnockData, data, sizeof(DoorKnockMessage));
    newDoorKnockReceived = true;
  }
}

String urlEncode(String str) {
    String encodedString = "";
    char c;
    char code0;
    char code1;
    for (int i = 0; i < str.length(); i++) {
        c = str.charAt(i);
        if (c == ' ') {
            encodedString += '+';
        } else if (isalnum(c)) {
            encodedString += c;
        } else {
            code1 = (c & 0xf) + '0';
            if ((c & 0xf) > 9) {
                code1 = (c & 0xf) - 10 + 'A';
            }
            c = (c >> 4) & 0xf;
            code0 = c + '0';
            if (c > 9) {
                code0 = c - 10 + 'A';
            }
            encodedString += '%';
            encodedString += code0;
            encodedString += code1;
        }
    }
    return encodedString;
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
                      "&message=" + urlEncode(message) + 
                      "&title=" + urlEncode(title) + 
                      "&priority=1" + 
                      "&sound=persistent";

    int httpResponseCode = http.POST(postData);
    Serial.print("HTTP Code: "); Serial.println(httpResponseCode);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println(response);
    }
    http.end();
  } else {
    Serial.println("WiFi Disconnected.");
  }
}
