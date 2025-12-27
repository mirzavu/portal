#include <Arduino.h>

// PIN DEFINITIONS
#define SIM_RX 26 // ESP32 RX <- SIM TX
#define SIM_TX 25 // ESP32 TX -> SIM RX

// MOSFET POWER PINS
#define MOSFET_PIN_1 27 
#define MOSFET_PIN_2 14 

HardwareSerial simSerial(2);

void runGPRSTest() {
    Serial.println("\n\n--- STARTING GPRS INTERNET TEST ---");
    
    // 1. Check Signal
    Serial.println("[STEP 1] Checking Signal Quality (0-31)...");
    simSerial.println("AT+CSQ"); 
    delay(1000);
    
    // 2. Check Network Registration
    Serial.println("[STEP 2] Checking Network Registration...");
    simSerial.println("AT+CREG?"); 
    delay(1000);
    
    // 3. Check Attached State
    Serial.println("[STEP 3] Checking GPRS Attachment...");
    simSerial.println("AT+CGATT?"); 
    delay(1000);
    
    // 4. Configure GPRS
    Serial.println("[STEP 4] Configuring APN (Default: 'internet')...");
    simSerial.println("AT+SAPBR=3,1,\"Contype\",\"GPRS\"");
    delay(500);
    simSerial.println("AT+SAPBR=3,1,\"APN\",\"internet\""); // Replace if your carrier needs specific APN
    delay(500);
    
    // 5. Enable GPRS
    Serial.println("[STEP 5] Enabling GPRS Context (this takes time)...");
    simSerial.println("AT+SAPBR=1,1"); 
    delay(4000);
    
    // 6. Get IP
    Serial.println("[STEP 6] Requesting IP Address...");
    simSerial.println("AT+SAPBR=2,1"); 
    Serial.println("-------------------------------------------------");
    Serial.println("IF YOU SEE AN IP ADDRESS (e.g. 10.x.x.x), INTERNET IS WORKING!");
    Serial.println("-------------------------------------------------\n");
}

void setup() {
    Serial.begin(115200);
    
    // Initialize Power Pins
    pinMode(MOSFET_PIN_1, OUTPUT);
    pinMode(MOSFET_PIN_2, OUTPUT);
    digitalWrite(MOSFET_PIN_1, HIGH); // Turn ON
    digitalWrite(MOSFET_PIN_2, HIGH); // Turn ON

    // Initialize Module Serial
    simSerial.begin(9600, SERIAL_8N1, SIM_RX, SIM_TX);

    Serial.println("\n\n=== ESP32 GSM/GPRS TEST MODE ===");
    Serial.println("Powering Pins D27 and D14... ON");
    Serial.println("SIM Serial (26/25) ... Initialized");
    Serial.println("-------------------------------------");
    Serial.println("Instructions:");
    Serial.println("1. System will print message every 2s to show it's alive.");
    Serial.println("2. Type 'TEST_NET' to run the Internet/GPRS test sequence.");
    Serial.println("3. Type 'AT' to send manual commands.");
    Serial.println("-------------------------------------\n");
}

void loop() {
    static unsigned long lastCheck = 0;
    
    // Heartbeat every 2 seconds
    if (millis() - lastCheck > 2000) {
        lastCheck = millis();
        Serial.println("[TEST] Sending 'AT' to SIM800...");
        simSerial.println("AT");
    }

    // 1. Read from SIM and forward to PC
    if (simSerial.available()) {
         String line = simSerial.readStringUntil('\n');
         line.trim();
         if (line.length() > 0) {
             Serial.print("[SIM] ");
             Serial.println(line);
         }
    }

    // 2. User Commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        
        if (cmd == "TEST_NET") {
            runGPRSTest();
        } else if (cmd.length() > 0) {
            // Forward other commands to SIM directly
            Serial.print("Sending to SIM: ");
            Serial.println(cmd);
            simSerial.println(cmd);
        }
    }
}
