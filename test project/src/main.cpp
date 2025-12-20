#include <Arduino.h>
#include <WiFi.h>

// ESP32 Diagnostic Test Program
// This will test various components of the ESP32 to check if it's working properly

void setup() {
    Serial.begin(115200);
    delay(2000); // Wait for serial monitor to connect
    
    Serial.println("\n\n");
    Serial.println("========================================");
    Serial.println("ESP32 DIAGNOSTIC TEST");
    Serial.println("========================================");
    Serial.println();
    
    // Test 1: Chip Information
    Serial.println("--- CHIP INFORMATION ---");
    Serial.printf("Chip Model: %s\n", ESP.getChipModel());
    Serial.printf("Chip Revision: %d\n", ESP.getChipRevision());
    Serial.printf("Chip Cores: %d\n", ESP.getChipCores());
    Serial.printf("CPU Frequency: %d MHz\n", ESP.getCpuFreqMHz());
    Serial.printf("Flash Size: %d bytes (%.2f MB)\n", ESP.getFlashChipSize(), ESP.getFlashChipSize() / 1024.0 / 1024.0);
    Serial.printf("Free Heap: %d bytes (%.2f KB)\n", ESP.getFreeHeap(), ESP.getFreeHeap() / 1024.0);
    Serial.printf("Free PSRAM: %d bytes\n", ESP.getPsramSize());
    Serial.println();
    
    // Test 2: MAC Address
    Serial.println("--- NETWORK INFORMATION ---");
    Serial.printf("MAC Address: %s\n", WiFi.macAddress().c_str());
    Serial.println();
    
    // Test 3: Built-in LED (GPIO 2 on most ESP32 boards)
    Serial.println("--- LED TEST ---");
    pinMode(LED_BUILTIN, OUTPUT);
    Serial.println("Blinking LED 5 times...");
    for(int i = 0; i < 5; i++) {
        digitalWrite(LED_BUILTIN, HIGH);
        delay(200);
        digitalWrite(LED_BUILTIN, LOW);
        delay(200);
    }
    Serial.println("LED test complete!");
    Serial.println();
    
    // Test 4: GPIO Pin Test (test a few common pins)
    Serial.println("--- GPIO PIN TEST ---");
    int testPins[] = {2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33};
    int numPins = sizeof(testPins) / sizeof(testPins[0]);
    
    Serial.println("Testing GPIO pins (reading initial state)...");
    for(int i = 0; i < numPins; i++) {
        pinMode(testPins[i], INPUT_PULLUP);
        int state = digitalRead(testPins[i]);
        Serial.printf("GPIO %2d: %s\n", testPins[i], state == HIGH ? "HIGH" : "LOW");
    }
    Serial.println();
    
    // Test 5: Analog Read Test
    Serial.println("--- ANALOG READ TEST ---");
    Serial.println("Reading analog pins (may show noise if floating)...");
    for(int i = 0; i < 8; i++) {
        int adcPin = 32 + i; // GPIO 32-39 are ADC pins
        if(adcPin <= 39) {
            int value = analogRead(adcPin);
            float voltage = (value / 4095.0) * 3.3;
            Serial.printf("ADC%d (GPIO %d): %d (%.2fV)\n", i, adcPin, value, voltage);
        }
    }
    Serial.println();
    
    // Test 6: Timing Test
    Serial.println("--- TIMING TEST ---");
    unsigned long start = micros();
    delay(100);
    unsigned long elapsed = micros() - start;
    Serial.printf("100ms delay measured: %lu microseconds (should be ~100000)\n", elapsed);
    Serial.println();
    
    // Test 7: Memory Test
    Serial.println("--- MEMORY TEST ---");
    size_t freeBefore = ESP.getFreeHeap();
    Serial.printf("Free heap before allocation: %d bytes\n", freeBefore);
    
    // Allocate some memory
    void* testPtr = malloc(1024);
    if(testPtr) {
        size_t freeAfter = ESP.getFreeHeap();
        Serial.printf("Free heap after 1KB allocation: %d bytes\n", freeAfter);
        Serial.printf("Memory allocated successfully: %d bytes\n", freeBefore - freeAfter);
        free(testPtr);
        size_t freeAfterFree = ESP.getFreeHeap();
        Serial.printf("Free heap after free: %d bytes\n", freeAfterFree);
        Serial.println("Memory test: PASSED");
    } else {
        Serial.println("Memory test: FAILED (could not allocate)");
    }
    Serial.println();
    
    // Test 8: WiFi Test (basic initialization)
    Serial.println("--- WIFI INITIALIZATION TEST ---");
    WiFi.mode(WIFI_STA);
    Serial.println("WiFi initialized in STA mode");
    Serial.printf("WiFi Status: %d\n", WiFi.status());
    Serial.println();
    
    // Test 9: Reset Reason
    Serial.println("--- RESET INFORMATION ---");
    Serial.printf("Reset Reason: %s\n", ESP.getResetReason().c_str());
    Serial.printf("Reset Info: %s\n", ESP.getResetInfo().c_str());
    Serial.println();
    
    Serial.println("========================================");
    Serial.println("DIAGNOSTIC TEST COMPLETE");
    Serial.println("========================================");
    Serial.println();
    Serial.println("If all tests passed, your ESP32 appears to be working correctly!");
    Serial.println("If you see errors or unexpected values, the ESP32 may be faulty.");
    Serial.println();
    Serial.println("Starting continuous loop (blinking LED every 2 seconds)...");
    Serial.println();
}

void loop() {
    // Blink LED every 2 seconds to show it's alive
    static unsigned long lastBlink = 0;
    unsigned long now = millis();
    
    if(now - lastBlink >= 2000) {
        digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
        lastBlink = now;
        
        // Print status every 10 seconds
        static int counter = 0;
        counter++;
        if(counter >= 5) {
            counter = 0;
            Serial.printf("[%lu ms] ESP32 running - Free Heap: %d bytes\n", 
                         now, ESP.getFreeHeap());
        }
    }
    
    delay(10);
}
