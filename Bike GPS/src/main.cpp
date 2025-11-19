/*
  TEST #3: Test #2 + Channel Forcing
  - Does forcing the channel cause the crash?
*/
#include <Arduino.h>

// --- We know these are safe ---
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h> // Needed for this test
// -----------------------------

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("==== ESP32 Test #3 (Channel Forcing) ====");

  // 1. This worked in Test #2
  Serial.println("Calling WiFi.mode(WIFI_STA)...");
  WiFi.mode(WIFI_STA);
  Serial.println("...WiFi.mode() finished.");

  // 2. --- ADDING THIS NEW BLOCK ---
  uint8_t channel = 1;
  Serial.print("Forcing radio to Channel: "); Serial.println(channel);
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(channel, WIFI_SECOND_CHAN_NONE); // This is the line from our minimal test
  esp_wifi_set_promiscuous(false);
  Serial.println("...Channel *should* be set.");
  // -------------------------------

  Serial.println("If you see this, the code did not crash yet.");
}

int count = 0;

void loop() {
  Serial.print(count);
  Serial.print("  ");
  Serial.print(millis());
  Serial.println("  Hello");
  count++;
  delay(2000);
}