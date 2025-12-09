#include <ESP8266WiFi.h>
#include <espnow.h>
#include <user_interface.h>

extern "C" {
  #include "gpio.h"
}

uint8_t gatewayAddress[] = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};
const uint8_t CHANNEL = 11;

const int PIN_KNOCK = 14; // D5
const int PIN_MOSFET = 4; // D2

const float VREF = 3.3;
const float MULT = 2.0;

volatile bool knockFlag = false;
volatile uint8_t lastSendStatus = 255;

// ISR for knock detection
ICACHE_RAM_ATTR void knockISR() {
  knockFlag = true;
}

void onSent(uint8_t *mac, uint8_t status) {
  lastSendStatus = status;
}

struct __attribute__((packed)) FullMessage {
  uint8_t type; // 1 = knock, 0 = heartbeat
  int random_id;
  float voltage;
};

float readBattery() {
  digitalWrite(PIN_MOSFET, HIGH);
  delay(50); // Reduced delay to save power, but enough for mosfet

  long sum = 0;
  for (int i = 0; i < 8; i++) {
    sum += analogRead(A0);
    delay(2);
  }

  int raw = sum / 8;
  float v = (raw / 1024.0) * VREF * MULT;
  digitalWrite(PIN_MOSFET, LOW); // Turn off immediately
  return v;
}

// Smart delay that breaks on knock
void smartDelay(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {
    if (knockFlag) {
      // Interrupt detected, break sleep loop
      return; 
    }
    yield(); // Enter sleep here (if configured)
  }
}

void sendPacket(uint8_t type) {
  // Ensure we are awake and WiFi is ready
  wifi_fpm_do_wakeup();
  wifi_fpm_close();
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  
  // CRITICAL: Set channel BEFORE initializing ESP-NOW
  wifi_set_channel(CHANNEL);
  
  // POWER OPTIMIZATION: Reduce TX power if gateway is nearby (<20m)
  WiFi.setOutputPower(20); // Increased back to max for reliability
  
  delay(50); // Increased delay for radio stabilization

  if (esp_now_init() != 0) {
    Serial.println("ESP-NOW Init Failed");
    return;
  }

  esp_now_register_send_cb(onSent);
  esp_now_set_self_role(ESP_NOW_ROLE_CONTROLLER);
  esp_now_add_peer(gatewayAddress, ESP_NOW_ROLE_SLAVE, CHANNEL, NULL, 0);

  // Add small delay after peer registration
  delay(10);

  FullMessage m;
  m.type = type;
  m.random_id = random(10000, 99999);
  m.voltage = readBattery();

  Serial.print("Sending Packet Type: ");
  Serial.print(type);
  Serial.print(" (");
  Serial.print(type == 1 ? "KNOCK" : "HEARTBEAT");
  Serial.print(") | ID: ");
  Serial.print(m.random_id);
  Serial.print(" | Voltage: ");
  Serial.println(m.voltage);

  // CRITICAL FIX: Send multiple times with delays for reliability
  bool success = false;
  for (int i = 0; i < 3; i++) { // Back to 3 retries
    lastSendStatus = 255;
    esp_now_send(gatewayAddress, (uint8_t*)&m, sizeof(m));
    
    // Wait for callback with longer timeout
    unsigned long start = millis();
    while (millis() - start < 200 && lastSendStatus == 255) { // Increased to 200ms
      yield();
    }
    
    if (lastSendStatus == 0) {
      Serial.println("✓ Delivery Success");
      success = true;
      
      // CRITICAL: Add delay even on success to ensure packet is processed
      delay(50);
      break;
    } else {
      Serial.print("✗ Delivery Failed, Retry ");
      Serial.print(i + 1);
      Serial.println("/3");
      delay(50); // Increased retry delay
    }
  }
  
  if (!success) {
    Serial.println("⚠️  All retries failed!");
  }

  esp_now_deinit();
  WiFi.mode(WIFI_OFF); // Turn off radio
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n========================================");
  Serial.println("    DOOR KNOCK SENSOR STARTING");
  Serial.println("========================================");

  pinMode(PIN_MOSFET, OUTPUT);
  digitalWrite(PIN_MOSFET, LOW);

  pinMode(PIN_KNOCK, INPUT_PULLUP);

  // Attach Interrupt for Smart Delay Break
  attachInterrupt(digitalPinToInterrupt(PIN_KNOCK), knockISR, CHANGE);

  // Send initial boot packet
  Serial.println(">> Sending boot heartbeat...");
  sendPacket(0);
  Serial.println("========================================\n");
}

// CHANGED: 1 hour heartbeat interval (3,600,000 ms)
const unsigned long HEARTBEAT_INTERVAL_MS = 3600000; // 1 hour

void loop() {
  // Handle any pending knocks immediately
  if (knockFlag) {
      Serial.println("\n🚪 KNOCK DETECTED!");
      knockFlag = false;
      sendPacket(1);
      delay(200); // Debounce
  }

  static unsigned long lastHeartbeat = 0;
  
  // Initialize lastHeartbeat after first send if 0
  if (lastHeartbeat == 0) lastHeartbeat = millis();

  // Heartbeat Check
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      Serial.println("\n⏰ Heartbeat Timer Expired");
      sendPacket(0);
      lastHeartbeat = millis();
  }

  Serial.println("💤 Entering Light Sleep...");
  Serial.flush();
  
  int startPinState = digitalRead(PIN_KNOCK);

  // Calculate remaining time to next heartbeat
  unsigned long passed = millis() - lastHeartbeat;
  unsigned long sleepTimeMs = (passed < HEARTBEAT_INTERVAL_MS) ? (HEARTBEAT_INTERVAL_MS - passed) : 100;
  
  // Prepare for sleep
  wifi_station_disconnect();
  wifi_set_opmode(NULL_MODE);
  wifi_fpm_set_sleep_type(LIGHT_SLEEP_T);
  wifi_fpm_open();
  
  // Configure wakeup
  if (startPinState == LOW) {
     // Assume Quiet=LOW, Wake on HIGH
     gpio_pin_wakeup_enable(GPIO_ID_PIN(PIN_KNOCK), GPIO_PIN_INTR_HILEVEL);
  } else {
     // Assume Quiet=HIGH, Wake on LOW
     gpio_pin_wakeup_enable(GPIO_ID_PIN(PIN_KNOCK), GPIO_PIN_INTR_LOLEVEL);
  }
  
  // Sleep using FPM
  wifi_fpm_do_sleep(sleepTimeMs * 1000); 
  
  // Use Smart Delay to allow break-on-interrupt
  smartDelay(sleepTimeMs + 50);
  
  Serial.println("⏰ Woke Up!");
  
  // Determine cause
  if (knockFlag) {
      Serial.println("   Reason: Door knock interrupt");
      // Don't clear knockFlag here - let it be handled at start of next loop
  } else {
      Serial.println("   Reason: Heartbeat timer");
  }
}