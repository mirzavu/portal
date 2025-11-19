/* Gateway Hub - Full System v1.0
 * Restored for testing
 */

#include <Arduino.h>
#include <SPI.h>
#include <RF24.h>              // For NRF24L01
#include <WiFi.h>               // ESP32 WiFi
#include <HTTPClient.h>         // ESP32 HTTP
#include <WiFiClientSecure.h>   // ESP32 HTTPS
#include <esp_now.h>            // ESP32 ESP-NOW
#include <esp_wifi.h>           // Needed for channel forcing
#include <time.h>

// ============================================
// CONFIGURATION
// ============================================

const char* WIFI_SSID = "TheBoss";
const char* WIFI_PASSWORD = "12121234";

// NRF24L01 Configuration
#define CE_PIN 4
#define CSN_PIN 5
const byte NRF_ADDRESS[6] = "DEVIC";

// ============================================
// GLOBAL OBJECTS
// ============================================

RF24 radio(CE_PIN, CSN_PIN);

// ============================================
// DATA STRUCTURES
// ============================================

// struct DoorKnockMessage {
//   int random_id; // Match the struct sent by Door Knock (was knock_count)
// };

// Match exactly the Door Knock struct (must be same size and padding)
struct __attribute__((packed)) DoorKnockMessage {
  int random_id;
};

volatile bool newDoorKnockReceived = false;
volatile DoorKnockMessage doorKnockData;
volatile uint8_t doorKnockSenderMAC[6];

// ============================================
// FUNCTION DECLARATIONS
// ============================================

void connectToWiFi();
void initESPNOW();
void initNRF24();
void onESPNOWDataRecv(const uint8_t *mac, const uint8_t *data, int len);
String macToString(const uint8_t* mac);

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n\n==== GATEWAY HUB STARTING ====");

  // 1. WiFi Mode
  WiFi.mode(WIFI_STA);

  // 2. Initialize ESP-NOW
  initESPNOW();

  // 3. Connect to WiFi
  connectToWiFi();
  
  Serial.print("Gateway Channel: ");
  Serial.println(WiFi.channel());

  // 4. NTP
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  // 5. NRF24
  // initNRF24(); // Keep commented for now

  Serial.println("\n✓ Gateway Hub Ready (Loop starting...)");
}

void loop() {
  // Serial.println("Loop running..."); // Uncomment if needed, but keep it quiet for now
  
  if (WiFi.status() != WL_CONNECTED) {
    // Serial.println("⚠ WiFi disconnected. Reconnecting...");
    // connectToWiFi(); 
    // initESPNOW(); 
  }

  if (newDoorKnockReceived) {
    static unsigned long lastKnockTime = 0;
    unsigned long now = millis();
    
    // DEBUG: Print why we are here
    // Serial.print("DEBUG CHECK: Now="); Serial.print(now); 
    // Serial.print(" Last="); Serial.print(lastKnockTime);
    // Serial.print(" Diff="); Serial.println(now - lastKnockTime);

    // Global Debounce: Ignore ALL knocks for 5 seconds after a valid one
    if (now - lastKnockTime > 5000) {
        Serial.print("DOOR KNOCK RECEIVED! ID: ");
        Serial.print(doorKnockData.random_id);
        Serial.print(" (Time: ");
        Serial.print(now);
        Serial.println(")");
        
        lastKnockTime = now;
    } else {
       // Serial.println("Duplicate ignored.");
    }
    newDoorKnockReceived = false;
  }

  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 5000) {
      Serial.print("Gateway Alive. Channel: ");
      Serial.println(WiFi.channel());
      lastPrint = millis();
  }

  delay(100);
}

// ============================================
// FUNCTIONS
// ============================================

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
  } else {
    Serial.println("Failed to connect.");
  }
}

void initESPNOW() {
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Init Failed");
    return;
  }
  esp_now_register_recv_cb(onESPNOWDataRecv);
}

void onESPNOWDataRecv(const uint8_t *mac, const uint8_t *data, int len) {
  if (len == sizeof(DoorKnockMessage)) {
    memcpy((void*)&doorKnockData, data, sizeof(DoorKnockMessage));
    memcpy((void*)doorKnockSenderMAC, mac, 6);
    newDoorKnockReceived = true;
  }
}

String macToString(const uint8_t* mac) {
  char macStr[18];
  snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(macStr);
}
