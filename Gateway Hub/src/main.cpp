/* Gateway Hub - Full System v2.0 (Heartbeat + Battery Logic)
 * - Forces Channel 11
 * - Handles Knock vs Heartbeat
 * - Converts Voltage to %
 * - Sends Low Battery Alerts
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
  uint8_t type;     
  int random_id;
  float battery_v;
};

volatile bool newDoorKnockReceived = false;
volatile DoorKnockMessage doorKnockData;

unsigned long lastBatteryAlertMillis = 0;
int lastKnockID = 0;

void connectToWiFi();
void initESPNOW();
void onESPNOWDataRecv(const uint8_t *mac, const uint8_t *data, int len);
void sendPushover(String message, String title, int priority, String sound);
String urlEncode(String str);
int getBatteryPercentage(float voltage);

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n\n==== GATEWAY HUB v2.0 STARTING ====");

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
    newDoorKnockReceived = false;
    int pct = getBatteryPercentage(doorKnockData.battery_v);
    if (doorKnockData.type == 1) {
        // knock
        if (doorKnockData.random_id != lastKnockID) {
            lastKnockID = doorKnockData.random_id;
            sendPushover("Door knock detected", "Door Security", 0, "bike");
        }
        return;
    }
    if (doorKnockData.type == 0) {
        // heartbeat
        unsigned long now = millis();
        if (pct < 30) {
            if (now - lastBatteryAlertMillis >= 20000) {
                lastBatteryAlertMillis = now;
                String msg = "Battery low";
                sendPushover(msg, "Door Battery", 1, "classical");
            }
        }
        return;
    }
  }
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

int getBatteryPercentage(float voltage) {
  // Li-Ion Mapping (Approximate)
  // 4.2V = 100%, 3.0V = 0%
  if (voltage >= 4.20) return 100;
  if (voltage <= 3.00) return 0;
  
  // Linear interpolation
  int pct = (int)((voltage - 3.00) / (4.20 - 3.00) * 100.0);
  return pct;
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

void sendPushover(String message, String title, int priority, String sound) {
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
                      "&priority=" + String(priority) + 
                      "&sound=" + urlEncode(sound);

    int httpResponseCode = http.POST(postData);
    if (httpResponseCode == 200) {
      Serial.println("SUCCESS");
    } else {
      Serial.print("FAILED (Code: ");
      Serial.print(httpResponseCode);
      Serial.print(") Response: ");
      String response = http.getString();
      Serial.println(response);
    }
    http.end();
  } else {
    Serial.println("WiFi Disconnected.");
  }
}
