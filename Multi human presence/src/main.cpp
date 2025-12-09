#include <Arduino.h>

void setup() {

  Serial.begin(115200);

  delay(100);

  

  Serial.println("\n\n=== Deep Sleep Test ===");

  Serial.println("Going to sleep for 5 seconds...");

  Serial.println("Make sure D0 is connected to RST!");

  

  delay(1000);

  

  // Deep sleep for 5 seconds (5,000,000 microseconds)

  ESP.deepSleep(5000000);

}

void loop() {

  // Never reaches here after deep sleep

}

