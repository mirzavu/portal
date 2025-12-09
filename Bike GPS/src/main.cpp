#include <Arduino.h>
#include "esp_sleep.h"

#define uS_TO_S_FACTOR 1000000  // Conversion factor for micro seconds to seconds

#define TIME_TO_SLEEP  15        // Time ESP32 will go to sleep (in seconds)

void setup(){
  Serial.begin(115200);
  delay(1000); // Give time to open serial monitor
  
  Serial.println("\n=== ESP32 Deep Sleep Test ===");
  Serial.println("Going to sleep for " + String(TIME_TO_SLEEP) + " seconds");
  
  // Configure wake-up timer
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
  
  Serial.println("Entering deep sleep now...");
  Serial.flush(); // Wait for serial to finish
  
  // Enter deep sleep
  esp_deep_sleep_start();
}

void loop(){
  // Never reaches here after deep sleep
}
