#include <Arduino.h>

void setup() {
    // Initialize LED
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW); // Turn LED on
    
    Serial.begin(115200);
    delay(100);
    
    Serial.println();
    Serial.println("=================================");
    Serial.println("ESP8266 Deep Sleep Test");
    Serial.println("Waking up...");
    
    // Print wake reason
    Serial.print("Reset reason: ");
    Serial.println(ESP.getResetReason());
    
    // Check if D0 is connected to RST
    Serial.println("Testing D0 pin...");
    pinMode(D0, OUTPUT);
    digitalWrite(D0, HIGH);
    delay(100);
    Serial.println("If board resets now, D0-RST connection works!");
    digitalWrite(D0, LOW);
    delay(500);
    
    // Stay awake for 3 seconds to see the message
    Serial.println("Staying awake for 3 seconds...");
    for(int i = 3; i > 0; i--) {
      Serial.println(i);
      digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); // Blink LED
      delay(1000);
    }
    
    // Go to deep sleep for 10 seconds
    Serial.println("Going to deep sleep for 10 seconds NOW...");
    Serial.println("=================================");
    Serial.flush(); // Wait for serial to finish
    
    digitalWrite(LED_BUILTIN, HIGH); // Turn LED off before sleep
    
    // Deep sleep for 10 seconds (10,000,000 microseconds)
    ESP.deepSleep(10e6); // 10 seconds = 10 * 10^6 microseconds
  }
  
  void loop() {
    // This will never be reached because ESP resets after deep sleep
  }