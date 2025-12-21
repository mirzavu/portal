#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// --- USER SETTINGS ---
const char* WIFI_SSID = "TheBoss";
const char* WIFI_PASSWORD = "12121234";

// Pushover Keys
const char* PUSHOVER_USER_KEY = "u9b5w63h547sn7nyd3139zupeguish";
const char* PUSHOVER_API_TOKEN = "aa2c5h1msgmuta92zgjbc6w6qfa5k3";

// Must match Sender Channel
#define WIFI_CHANNEL 6

// Must match Sender Struct exactly
struct __attribute__((packed)) DoorKnockMessage {
  uint8_t type;       // 1 = knock, 0 = heartbeat
  int random_id;
  float voltage;
};

// Human Presence Sensor Message
struct __attribute__((packed)) PresenceMessage {
  uint8_t device_type;  // 2 = human presence sensor
  float voltage;
  uint8_t presence;     // 1 = yes, 0 = no
  int16_t distance;     // Distance in cm, -1 if no presence
};

// --- GLOBALS ---
volatile bool newPacket = false;
volatile uint8_t packetType = 0; // 1 = door knock, 2 = presence
union {
  DoorKnockMessage doorKnock;
  PresenceMessage presence;
} pkt;
SemaphoreHandle_t pktMutex;

unsigned long lastLowBatteryAlert = 0;
unsigned long lastDailyBatteryReport = 0;
unsigned long lastPushNotification = 0; // Global cooldown tracker
int lastKnockID = 0;
unsigned long packetCounter = 0;

const unsigned long PUSH_COOLDOWN_MS = 5000; // 5 second cooldown between ANY push notifications

// --- FORWARD DECLARATIONS ---
void sendPushover(String msg, String title, int priority, String sound);
void sendDoorKnockAPI(String macAddress);
String urlEncode(String s);

// ESP-NOW Callback
void onRecv(const uint8_t *mac, const uint8_t *data, int len) {
  Serial.printf("RAW RX: len=%d, first byte=%d\n", len, len > 0 ? data[0] : -1);
  
  // Detect message type by length or first byte
  if (len == sizeof(DoorKnockMessage)) {
    if (xSemaphoreTake(pktMutex, 10 / portTICK_PERIOD_MS) == pdTRUE) {
      memcpy(&pkt.doorKnock, data, sizeof(DoorKnockMessage));
      packetType = 1; // Door knock message
      newPacket = true;
      xSemaphoreGive(pktMutex);
      Serial.println("✓ Door knock packet queued for processing");
    } else {
      Serial.println("⚠️  Mutex timeout - packet dropped!");
    }
  } else if (len == sizeof(PresenceMessage)) {
    if (xSemaphoreTake(pktMutex, 10 / portTICK_PERIOD_MS) == pdTRUE) {
      memcpy(&pkt.presence, data, sizeof(PresenceMessage));
      packetType = 2; // Presence message
      newPacket = true;
      xSemaphoreGive(pktMutex);
      Serial.println("✓ Presence packet queued for processing");
    } else {
      Serial.println("⚠️  Mutex timeout - packet dropped!");
    }
  } else {
    Serial.printf("⚠️  Invalid packet length: expected %d or %d, got %d\n", 
                  sizeof(DoorKnockMessage), sizeof(PresenceMessage), len);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=== GATEWAY STARTING ===");

  // Create mutex for thread safety
  pktMutex = xSemaphoreCreateMutex();

  // Step 1: Start WiFi in AP+STA mode to control channel
  WiFi.mode(WIFI_AP_STA);
  
  // Step 2: Create a soft AP on channel 6 (this locks the radio to channel 6)
  WiFi.softAP("ESP32_Gateway_Hidden", NULL, WIFI_CHANNEL, 1, 0); // hidden, no clients
  Serial.printf("SoftAP created on channel %d\n", WIFI_CHANNEL);

  // Step 3: Now connect to your WiFi router
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Current Channel: %d\n", WiFi.channel());
  } else {
    Serial.println("WiFi Connection FAILED");
  }

  // Step 4: Verify channel is correct
  uint8_t primaryChan;
  wifi_second_chan_t secondChan;
  esp_wifi_get_channel(&primaryChan, &secondChan);
  Serial.printf("Radio locked to channel: %d\n", primaryChan);

  // --- DELETED: Channel forcing block - Gateway must float to router's channel ---
  /* if (primaryChan != WIFI_CHANNEL) {
    Serial.println("WARNING: Channel mismatch! Forcing channel...");
    esp_wifi_set_channel(WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
    delay(100);
    esp_wifi_get_channel(&primaryChan, &secondChan);
    Serial.printf("After force - Channel: %d\n", primaryChan);
  } */

  // Step 5: Initialize ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Init Failed!");
    ESP.restart();
  }
  
  // Register receive callback
  esp_now_register_recv_cb(onRecv);
  
  // CRITICAL: Set ESP-NOW to long range mode for better reliability
  esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N);
  
  Serial.println("\n=== Gateway Ready & Listening on Channel 6 ===\n");
  Serial.printf("Listening for packets:\n");
  Serial.printf("  - Door Knock: %d bytes\n", sizeof(DoorKnockMessage));
  Serial.printf("  - Presence: %d bytes\n\n", sizeof(PresenceMessage));
}

void loop() {
  if (newPacket) {
    uint8_t currentPacketType;
    
    // Thread-safe copy
    if (xSemaphoreTake(pktMutex, portMAX_DELAY) == pdTRUE) {
      currentPacketType = packetType;
      newPacket = false;
      xSemaphoreGive(pktMutex);
    }

    packetCounter++;
    unsigned long now = millis();
    
    // Handle Door Knock Messages
    if (currentPacketType == 1) {
      DoorKnockMessage local;
      if (xSemaphoreTake(pktMutex, portMAX_DELAY) == pdTRUE) {
        local = pkt.doorKnock;
        xSemaphoreGive(pktMutex);
      }
      
      Serial.println("\n========================================");
      Serial.printf("DOOR KNOCK PACKET #%lu RECEIVED\n", packetCounter);
      Serial.printf("Type: %d | ID: %d | Voltage: %.2fV\n", 
                    local.type, local.random_id, local.voltage);
      Serial.println("========================================");

      // --- HANDLE KNOCK (Type 1) ---
      if (local.type == 1) {
          Serial.println("📢 KNOCK DETECTED");
        
        if (local.random_id != lastKnockID) {
          lastKnockID = local.random_id;
          
          // Check cooldown
          if (now - lastPushNotification >= PUSH_COOLDOWN_MS || lastPushNotification == 0) {
            Serial.println("✅ ACTION: Sending knock alert (NEW unique ID)");
            sendPushover("Door knock detected!", "Security Alert", 1, "bike");
            
            // Call door knock API
            String mac = WiFi.macAddress();
            sendDoorKnockAPI(mac);
            
            lastPushNotification = now; // Update cooldown timer
          } else {
            unsigned long cooldownLeft = (PUSH_COOLDOWN_MS - (now - lastPushNotification)) / 1000;
            Serial.printf("🔇 COOLDOWN: Knock alert blocked (%lu sec remaining)\n", cooldownLeft);
            Serial.println("   Reason: Global 5-second cooldown active");
          }
        } else {
          Serial.printf("⚠️  IGNORED: Duplicate knock (ID %d already processed)\n", local.random_id);
          Serial.println("   Reason: Same random_id - likely a retry/duplicate packet");
        }
      }

      // --- HANDLE HEARTBEAT (Type 0) ---
      else if (local.type == 0) {
        Serial.println("💓 HEARTBEAT RECEIVED");
        
        // Check if on USB power (< 2.5V means laptop/USB connected)
        if (local.voltage < 2.5) {
          Serial.printf("🔌 Device on USB/Laptop Power (%.2fV)\n", local.voltage);
          Serial.println("ℹ️  Battery monitoring disabled for USB power");
        } else {
          // Calculate battery percentage
          int pct = (local.voltage <= 3.0) ? 0 : 
                    (local.voltage >= 4.2) ? 100 : 
                    (int)((local.voltage - 3.0) / 1.2 * 100);
          
          Serial.printf("🔋 Battery Status: %d%% (%.2fV)\n", pct, local.voltage);

          // LOW BATTERY ALERT (< 30%) - Once per hour
          if (pct < 30) {
            if (lastLowBatteryAlert == 0 || (now - lastLowBatteryAlert > 3600000)) {
              
              // Check cooldown
              if (now - lastPushNotification >= PUSH_COOLDOWN_MS || lastPushNotification == 0) {
                lastLowBatteryAlert = now;
                String msg = "Low Battery Warning: " + String(pct) + "% (" + String(local.voltage, 2) + "V)";
                Serial.println("⚠️  ACTION: Sending LOW battery alert (< 30%)");
                sendPushover(msg, "Door Battery LOW", 0, "classical");
                lastPushNotification = now; // Update cooldown timer
              } else {
                unsigned long cooldownLeft = (PUSH_COOLDOWN_MS - (now - lastPushNotification)) / 1000;
                Serial.printf("🔇 COOLDOWN: Low battery alert blocked (%lu sec remaining)\n", cooldownLeft);
              }
              
            } else {
              unsigned long timeSince = (now - lastLowBatteryAlert) / 1000 / 60; // minutes
              Serial.printf("⏳ IGNORED: Low battery alert rate-limited (last sent %lu min ago)\n", timeSince);
            }
          } else {
            Serial.println("✅ Battery level OK (above 30%)");
          }

          // DAILY BATTERY REPORT - Once per 24 hours regardless of percentage
          if (lastDailyBatteryReport == 0 || (now - lastDailyBatteryReport > 86400000)) {
            
            // Check cooldown
            if (now - lastPushNotification >= PUSH_COOLDOWN_MS || lastPushNotification == 0) {
              lastDailyBatteryReport = now;
              String msg = "Daily Report: " + String(pct) + "% (" + String(local.voltage, 2) + "V)";
              Serial.println("📊 ACTION: Sending DAILY battery report (24hr check-in)");
              sendPushover(msg, "Door Battery Status", 0, "pushover");
              lastPushNotification = now; // Update cooldown timer
            } else {
              unsigned long cooldownLeft = (PUSH_COOLDOWN_MS - (now - lastPushNotification)) / 1000;
              Serial.printf("🔇 COOLDOWN: Daily report blocked (%lu sec remaining)\n", cooldownLeft);
            }
            
          } else {
            unsigned long hoursLeft = (86400000 - (now - lastDailyBatteryReport)) / 1000 / 60 / 60;
            Serial.printf("⏰ Next daily report in ~%lu hours\n", hoursLeft);
          }
        }
      }
      
      Serial.println("========================================\n");
    // Handle Presence Messages
    else if (currentPacketType == 2) {
      PresenceMessage local;
      if (xSemaphoreTake(pktMutex, portMAX_DELAY) == pdTRUE) {
        local = pkt.presence;
        xSemaphoreGive(pktMutex);
      }
      
      Serial.println("\n========================================");
      Serial.printf("PRESENCE PACKET #%lu RECEIVED\n", packetCounter);
      Serial.printf("Device Type: %d | Voltage: %.2fV | Presence: %s | Distance: %d cm\n",
                    local.device_type, local.voltage, 
                    local.presence ? "YES" : "NO", local.distance);
      Serial.println("========================================");
      
      // Process presence data (you can add push notifications or API calls here)
      if (local.presence) {
        Serial.printf("👤 PRESENCE DETECTED at %d cm\n", local.distance);
      } else {
        Serial.println("✅ NO PRESENCE (Room Clear)");
      }
      
      // Battery monitoring for presence sensor (similar to door knock)
      if (local.voltage >= 2.5) { // Only monitor if not on USB
        int pct = (local.voltage <= 3.0) ? 0 : 
                  (local.voltage >= 4.2) ? 100 : 
                  (int)((local.voltage - 3.0) / 1.2 * 100);
        Serial.printf("🔋 Battery Status: %d%% (%.2fV)\n", pct, local.voltage);
        
        // LOW BATTERY ALERT (< 30%) - Once per hour
        static unsigned long lastPresenceBatteryAlert = 0;
        if (pct < 30) {
          if (lastPresenceBatteryAlert == 0 || (now - lastPresenceBatteryAlert > 3600000)) {
            if (now - lastPushNotification >= PUSH_COOLDOWN_MS || lastPushNotification == 0) {
              lastPresenceBatteryAlert = now;
              String msg = "Presence Sensor Low Battery: " + String(pct) + "% (" + String(local.voltage, 2) + "V)";
              Serial.println("⚠️  ACTION: Sending LOW battery alert (< 30%)");
              sendPushover(msg, "Presence Sensor Battery LOW", 0, "classical");
              lastPushNotification = now;
            }
          }
        }
      }
      
      Serial.println("========================================\n");
    }
    // Unknown packet type
    else {
      Serial.printf("❓ UNKNOWN packet type: %d\n", currentPacketType);
      Serial.println("========================================\n");
    }
  }
  
  delay(10); // Small delay to prevent watchdog issues
}

// --- HELPER FUNCTIONS ---

void sendDoorKnockAPI(String macAddress) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Error: No WiFi connection, cannot send Door Knock API.");
    return;
  }

  // TESTING MODE: Use HTTP for local server
  // WiFiClientSecure client;
  // client.setInsecure();
  WiFiClient client; // Use regular WiFi client for HTTP
  HTTPClient http;

  Serial.print("Calling Door Knock API... ");
  
  // TESTING: Replace with your laptop's IP address
  if (!http.begin(client, "http://192.168.29.15:8080/api/door-knock")) { // Change IP to your laptop!
    Serial.println("FAILED to begin HTTP");
    return;
  }
  
  http.addHeader("Content-Type", "application/json");

  // Get current timestamp (seconds since boot + rough epoch)
  unsigned long timestamp = 1735123456 + (millis() / 1000); // Rough timestamp
  
  // Build JSON body
  String jsonBody = "{";
  jsonBody += "\"mac\":\"" + macAddress + "\",";
  jsonBody += "\"knock_count\":1,";
  jsonBody += "\"timestamp\":" + String(timestamp);
  jsonBody += "}";

  Serial.println();
  Serial.println("Request Body: " + jsonBody);

  int httpCode = http.POST(jsonBody);
  
  if (httpCode > 0) {
    Serial.printf("Door Knock API Response Code: %d\n", httpCode);
    String response = http.getString();
    Serial.println("Response: " + response);
  } else {
    Serial.printf("Door Knock API FAILED (Error: %d)\n", httpCode);
  }
  
  http.end();
}

String urlEncode(String s) {
  String encoded = "";
  char c;
  for (unsigned int i = 0; i < s.length(); i++) {
    c = s.charAt(i);
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || 
        (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~') {
      encoded += c;
    } else if (c == ' ') {
      encoded += '+';
    } else {
      encoded += '%';
      encoded += "0123456789ABCDEF"[(c >> 4) & 0xF];
      encoded += "0123456789ABCDEF"[c & 0xF];
    }
  }
  return encoded;
}

void sendPushover(String message, String title, int priority, String sound) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Error: No WiFi connection, cannot send Pushover.");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); 
  HTTPClient http;

  Serial.print("Sending Pushover notification... ");
  
  if (!http.begin(client, "https://api.pushover.net/1/messages.json")) {
    Serial.println("FAILED to begin HTTP");
    return;
  }
  
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String body = "token=" + String(PUSHOVER_API_TOKEN) +
                "&user=" + String(PUSHOVER_USER_KEY) +
                "&message=" + urlEncode(message) +
                "&title=" + urlEncode(title) +
                "&priority=" + String(priority) +
                "&sound=" + urlEncode(sound);

  int httpCode = http.POST(body);
  
  if (httpCode == 200) {
    Serial.println("SUCCESS!");
  } else {
    Serial.printf("FAILED (HTTP Code: %d)\n", httpCode);
    if (httpCode > 0) {
      String response = http.getString();
      Serial.println("Response: " + response);
    }
  }
  http.end();
}