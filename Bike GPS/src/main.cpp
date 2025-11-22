#include <Arduino.h>
#include <TinyGPSPlus.h>

// ESP32 internal temperature sensor function declaration
extern "C" {
uint8_t temprature_sens_read();
}

// DEEP DIAGNOSTIC: Comprehensive GSM Module Analysis
// Goal: Capture EVERYTHING - signal, registration, SIM, operator, GPRS, power, networks
// This will "hold its neck" and show exactly what's happening

// Pin Definitions
#define MOSFET_GATE 27
#define GSM_RX_PIN 25       
#define GSM_TX_PIN 26       
#define BATTERY_PIN 35      // Voltage Divider Input (if available)
#define GPS_RX_PIN 16       // ESP32 RX <- GPS TX (if available)
#define GPS_TX_PIN 17       // ESP32 TX -> GPS RX (if available)

// Voltage Divider Configuration (if battery reading is available)
const float VOLTAGE_DIVIDER_RATIO = 4.3; 
const float ADC_REF_VOLTAGE = 3.3;
const int ADC_RESOLUTION = 4095;

HardwareSerial gsmSerial(1);
HardwareSerial gpsSerial(2);
TinyGPSPlus gps;

unsigned long bootTime = 0;
int lastCSQ = -1;
int lastCREG = -1;
String lastOperator = "";

String sendGSMCommand(String cmd, unsigned long timeout, bool echo = true) {
    if (echo) {
        Serial.print("[CMD] ");
        Serial.println(cmd);
    }
    gsmSerial.println(cmd);
    
    String response = "";
    unsigned long start = millis();
    
    while (millis() - start < timeout) {
        while (gsmSerial.available()) {
            char c = gsmSerial.read();
            response += c;
        }
        if (response.length() > 0) delay(10); 
    }
    
    if (echo && response.length() > 0) {
        Serial.print("[RESP] ");
        Serial.println(response);
    }
    return response;
}

void printTimestamp() {
    unsigned long elapsed = (millis() - bootTime) / 1000;
    Serial.print("[T+");
    Serial.print(elapsed);
    Serial.print("s] ");
}

int parseCSQ(String response) {
    int csqIndex = response.indexOf("+CSQ: ");
    if (csqIndex == -1) return -1;
    
    int commaIndex = response.indexOf(",", csqIndex);
    if (commaIndex == -1) return -1;
    
    String valStr = response.substring(csqIndex + 6, commaIndex);
    return valStr.toInt();
}

int parseCREG(String response) {
    // Look for +CREG: n,m where m is the status
    int cregIndex = response.indexOf("+CREG: ");
    if (cregIndex == -1) return -1;
    
    // Find the comma after the first number
    int commaIndex = response.indexOf(",", cregIndex);
    if (commaIndex == -1) return -1;
    
    // Get the status number (after comma)
    int endIndex = response.indexOf("\r", commaIndex);
    if (endIndex == -1) endIndex = response.indexOf("\n", commaIndex);
    if (endIndex == -1) endIndex = commaIndex + 3;
    
    String statusStr = response.substring(commaIndex + 1, endIndex);
    statusStr.trim();
    return statusStr.toInt();
}

String getCREGStatus(int status) {
    switch(status) {
        case 0: return "NOT REGISTERED";
        case 1: return "REGISTERED (HOME)";
        case 2: return "SEARCHING";
        case 3: return "DENIED";
        case 4: return "UNKNOWN";
        case 5: return "REGISTERED (ROAMING)";
        default: return "UNKNOWN(" + String(status) + ")";
    }
}

int rssiToDBm(int csq) {
    if (csq == 0) return -115;  // No signal
    if (csq == 1) return -111;
    if (csq >= 2 && csq <= 30) return -110 + (csq - 1) * 2;
    if (csq == 31) return -51;   // Full signal
    return -115;  // Invalid
}

// Parse CBC (Battery/Voltage) response
void parseCBC(String response, int &voltage_mv, int &percent) {
    voltage_mv = -1;
    percent = -1;
    
    if (response.indexOf("+CBC:") != -1) {
        int start = response.indexOf("+CBC:") + 6;
        // Format: +CBC: <bcs>,<bcl>,<voltage>
        // bcs: battery charge status (0=not charging, 1=charging, 2=finished)
        // bcl: battery charge level (0-5)
        // voltage: battery voltage in mV
        
        // Find first comma
        int comma1 = response.indexOf(",", start);
        if (comma1 != -1) {
            int comma2 = response.indexOf(",", comma1 + 1);
            if (comma2 != -1) {
                // Get voltage (after second comma)
                int end = response.indexOf("\r", comma2);
                if (end == -1) end = response.indexOf("\n", comma2);
                if (end == -1) end = comma2 + 10;
                
                String voltStr = response.substring(comma2 + 1, end);
                voltStr.trim();
                voltage_mv = voltStr.toInt();
                
                // Get percent (between commas)
                String percentStr = response.substring(comma1 + 1, comma2);
                percentStr.trim();
                int bcl = percentStr.toInt();
                // Convert bcl (0-5) to percent (0-100)
                percent = (bcl * 20); // 0=0%, 1=20%, 2=40%, 3=60%, 4=80%, 5=100%
            }
        }
    }
}

// Read battery voltage from ADC (if available)
int readBatteryVoltage() {
    pinMode(BATTERY_PIN, INPUT);
    long sum = 0;
    for(int i = 0; i < 10; i++) {
        sum += analogRead(BATTERY_PIN);
        delay(10);
    }
    float averageRaw = sum / 10.0;
    float voltage = (averageRaw / ADC_RESOLUTION) * ADC_REF_VOLTAGE * VOLTAGE_DIVIDER_RATIO;
    return (int)(voltage * 1000); // Return in mV
}

// Get reset reason string
String getResetReason() {
    esp_reset_reason_t reason = esp_reset_reason();
    switch(reason) {
        case ESP_RST_UNKNOWN: return "UNKNOWN";
        case ESP_RST_POWERON: return "POWERON";
        case ESP_RST_EXT: return "EXT";
        case ESP_RST_SW: return "SW";
        case ESP_RST_PANIC: return "PANIC";
        case ESP_RST_INT_WDT: return "INT_WDT";
        case ESP_RST_TASK_WDT: return "TASK_WDT";
        case ESP_RST_WDT: return "WDT";
        case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
        case ESP_RST_BROWNOUT: return "BROWNOUT";
        case ESP_RST_SDIO: return "SDIO";
        default: return "UNKNOWN(" + String(reason) + ")";
    }
}


void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n\n");
    Serial.println("========================================");
    Serial.println("  GSM SERIAL COMMUNICATION TEST");
    Serial.println("========================================");
    Serial.println();
    
    bootTime = millis();
    printTimestamp();
    Serial.println("Initializing...");
    
    pinMode(MOSFET_GATE, OUTPUT);
    digitalWrite(MOSFET_GATE, HIGH); 
    
    printTimestamp();
    Serial.println("MOSFET ON - Powering GSM module");
    Serial.println("Waiting 20 seconds for full boot...");
    
    // Initialize GPS serial
    printTimestamp();
    Serial.println("Initializing GPS module...");
    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    delay(100);
    // Send configuration commands to GPS
    gpsSerial.println("$PMTK220,1000*1F");  // Set update rate to 1Hz
    delay(100);
    gpsSerial.println("$PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*28"); // Output RMC and GGA only
    delay(100);
    
    delay(20000);
    
    // Initialize GSM serial with default 2G baud rate (9600)
    Serial.println("\nInitializing GSM module at 9600 baud (default 2G)...");
    Serial.print("Pin config: TX=");
    Serial.print(GSM_TX_PIN);
    Serial.print(", RX=");
    Serial.println(GSM_RX_PIN);
    
    gsmSerial.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
    delay(500);
    
    // Clear any existing data
    while (gsmSerial.available()) {
        gsmSerial.read();
    }
    
    // Try to communicate with GSM module for 5 minutes
    bool foundBaud = false;
    unsigned long gsmStartTime = millis();
    const unsigned long GSM_TIMEOUT = 300000; // 5 minutes = 300000 ms
    
    Serial.println("Attempting to communicate with GSM module (will try for 5 minutes)...");
    
    while (millis() - gsmStartTime < GSM_TIMEOUT && !foundBaud) {
        // Clear buffer
        while (gsmSerial.available()) {
            gsmSerial.read();
        }
        
        // Send AT command
        gsmSerial.println("AT");
        delay(1000);
        
        // Check for response
        String response = "";
        unsigned long start = millis();
        while (millis() - start < 2000) {
            while (gsmSerial.available()) {
                char c = gsmSerial.read();
                response += c;
            }
            if (response.length() > 0) delay(10);
        }
        
        unsigned long elapsed = (millis() - gsmStartTime) / 1000;
        
        if (response.length() > 0) {
            Serial.print("[T+");
            Serial.print(elapsed);
            Serial.print("s] Response: '");
            Serial.print(response);
            Serial.println("'");
            
            if (response.indexOf("OK") != -1 || response.indexOf("RDY") != -1) {
                Serial.println("  *** SUCCESS: Module responding! ***");
                foundBaud = true;
                break;
            }
        } else {
            if (elapsed % 10 == 0) { // Print every 10 seconds
                Serial.print("[T+");
                Serial.print(elapsed);
                Serial.println("s] No response yet, continuing...");
            }
        }
        
        delay(1000);
    }
    
    if (!foundBaud) {
        unsigned long elapsed = (millis() - gsmStartTime) / 1000;
        Serial.print("\n*** WARNING: No response from module after ");
        Serial.print(elapsed);
        Serial.println(" seconds ***");
        Serial.println("Proceeding anyway...");
    }
    
    delay(2000);
}

void loop() {
    // GPS Serial Data Check - Monitor raw GPS output
    static unsigned long lastGpsCheck = 0;
    if (millis() - lastGpsCheck > 1000) { // Check every second
        bool gpsDataFound = false;
        String gpsRaw = "";
        while (gpsSerial.available() > 0) {
            char c = gpsSerial.read();
            gpsRaw += c;
            gpsDataFound = true;
        }
        if (gpsDataFound) {
            Serial.print("[GPS RAW] ");
            Serial.print(gpsRaw);
        }
        lastGpsCheck = millis();
    }
    
    Serial.println();
    Serial.println("========================================");
    printTimestamp();
    Serial.println("DIAGNOSTIC CYCLE START");
    Serial.println("========================================");
    
    // 1. SIGNAL QUALITY (CSQ)
    printTimestamp();
    Serial.println("--- [1] SIGNAL QUALITY (AT+CSQ) ---");
    String csqResp = sendGSMCommand("AT+CSQ", 2000);
    int csq = parseCSQ(csqResp);
    if (csq != -1) {
        int rssi = rssiToDBm(csq);
        Serial.print("  CSQ Value: ");
        Serial.print(csq);
        Serial.print("/31");
        if (csq == 0) Serial.print(" (NO SIGNAL)");
        else if (csq == 31) Serial.print(" (EXCELLENT)");
        else if (csq >= 20) Serial.print(" (GOOD)");
        else if (csq >= 10) Serial.print(" (FAIR)");
        else Serial.print(" (POOR)");
        Serial.print(" | RSSI: ");
        Serial.print(rssi);
        Serial.println(" dBm");
        
        if (csq != lastCSQ) {
            Serial.print("  *** SIGNAL CHANGED: ");
            Serial.print(lastCSQ);
            Serial.print(" -> ");
            Serial.println(csq);
            lastCSQ = csq;
        }
    } else {
        Serial.println("  ERROR: Could not parse CSQ response");
        Serial.print("  Raw: ");
        Serial.println(csqResp);
    }
    
    delay(500);
    
    // 2. NETWORK REGISTRATION (CREG)
    printTimestamp();
    Serial.println("--- [2] NETWORK REGISTRATION (AT+CREG?) ---");
    String cregResp = sendGSMCommand("AT+CREG?", 2000);
    int cregStatus = parseCREG(cregResp);
    if (cregStatus != -1) {
        Serial.print("  Status: ");
        Serial.print(cregStatus);
        Serial.print(" - ");
        Serial.println(getCREGStatus(cregStatus));
        
        if (cregStatus != lastCREG) {
            Serial.print("  *** REGISTRATION CHANGED: ");
            Serial.print(lastCREG);
            Serial.print(" -> ");
            Serial.println(cregStatus);
            lastCREG = cregStatus;
        }
    } else {
        Serial.println("  ERROR: Could not parse CREG response");
        Serial.print("  Raw: ");
        Serial.println(cregResp);
    }
    
    delay(500);
    
    // 3. SIM CARD STATUS
    printTimestamp();
    Serial.println("--- [3] SIM CARD STATUS (AT+CPIN?) ---");
    String cpinResp = sendGSMCommand("AT+CPIN?", 2000);
    if (cpinResp.indexOf("READY") != -1) {
        Serial.println("  SIM Status: READY");
    } else if (cpinResp.indexOf("SIM PIN") != -1) {
        Serial.println("  SIM Status: PIN REQUIRED");
    } else if (cpinResp.indexOf("SIM PUK") != -1) {
        Serial.println("  SIM Status: PUK REQUIRED");
    } else {
        Serial.print("  SIM Status: ");
        Serial.println(cpinResp);
    }
    
    delay(500);
    
    // 3a. SIM CARD ICCID (Serial Number)
    printTimestamp();
    Serial.println("--- [3a] SIM CARD ICCID (AT+CCID) ---");
    String ccidResp = sendGSMCommand("AT+CCID", 2000);
    if (ccidResp.indexOf("+CCID:") != -1) {
        int ccidStart = ccidResp.indexOf("+CCID:") + 7;
        int ccidEnd = ccidResp.indexOf("\r", ccidStart);
        if (ccidEnd == -1) ccidEnd = ccidResp.indexOf("\n", ccidStart);
        if (ccidEnd == -1) ccidEnd = ccidStart + 25;
        String iccid = ccidResp.substring(ccidStart, ccidEnd);
        iccid.trim();
        Serial.print("  ICCID: ");
        Serial.println(iccid);
        Serial.println("  (Use this to identify SIM card with carrier)");
    } else {
        Serial.println("  ICCID: Not available");
    }
    
    delay(500);
    
    // 3b. SIM CARD IMSI (Subscriber Identity)
    printTimestamp();
    Serial.println("--- [3b] SIM CARD IMSI (AT+CIMI) ---");
    String cimiResp = sendGSMCommand("AT+CIMI", 2000);
    if (cimiResp.indexOf("OK") != -1) {
        // IMSI is usually 15 digits, extract it
        String imsi = "";
        for (int i = 0; i < cimiResp.length(); i++) {
            char c = cimiResp.charAt(i);
            if (c >= '0' && c <= '9') {
                imsi += c;
            }
        }
        if (imsi.length() >= 10) {
            Serial.print("  IMSI: ");
            Serial.println(imsi);
            // First 3 digits are MCC (Mobile Country Code)
            // Next 2-3 digits are MNC (Mobile Network Code)
            if (imsi.length() >= 5) {
                String mcc = imsi.substring(0, 3);
                Serial.print("  MCC (Country): ");
                Serial.println(mcc);
            }
            if (imsi.length() >= 6) {
                String mnc = imsi.substring(3, 5);
                Serial.print("  MNC (Network): ");
                Serial.println(mnc);
            }
        } else {
            Serial.println("  IMSI: Not available or invalid");
        }
    } else {
        Serial.println("  IMSI: Not available");
    }
    
    delay(500);
    
    // 3c. NETWORK BAND INFORMATION
    printTimestamp();
    Serial.println("--- [3c] NETWORK BAND (AT+CBAND?) ---");
    String cbandResp = sendGSMCommand("AT+CBAND?", 2000);
    if (cbandResp.indexOf("+CBAND:") != -1) {
        Serial.print("  Band Info: ");
        Serial.println(cbandResp);
        Serial.println("  NOTE: SIM800L supports GSM 900/1800 MHz (2G only)");
    } else {
        Serial.println("  Band Info: Not available");
    }
    
    delay(500);
    
    // 4. NETWORK OPERATOR
    printTimestamp();
    Serial.println("--- [4] NETWORK OPERATOR (AT+COPS?) ---");
    String copsResp = sendGSMCommand("AT+COPS?", 3000);
    if (copsResp.indexOf("+COPS:") != -1) {
        int nameStart = copsResp.indexOf("\"");
        int nameEnd = copsResp.indexOf("\"", nameStart + 1);
        if (nameStart != -1 && nameEnd != -1) {
            String operatorName = copsResp.substring(nameStart + 1, nameEnd);
            Serial.print("  Operator: ");
            Serial.println(operatorName);
            if (operatorName != lastOperator) {
                Serial.print("  *** OPERATOR CHANGED: ");
                Serial.print(lastOperator);
                Serial.print(" -> ");
                Serial.println(operatorName);
                lastOperator = operatorName;
            }
        } else {
            Serial.println("  Operator: Not registered (no operator name)");
        }
    } else {
        Serial.println("  Operator: Unknown (parsing failed)");
    }
    
    delay(500);
    
    // 5. GPRS REGISTRATION
    printTimestamp();
    Serial.println("--- [5] GPRS REGISTRATION (AT+CGREG?) ---");
    String cgregResp = sendGSMCommand("AT+CGREG?", 2000);
    int cgregStatus = parseCREG(cgregResp);  // Same format as CREG
    if (cgregStatus != -1) {
        Serial.print("  GPRS Status: ");
        Serial.print(cgregStatus);
        Serial.print(" - ");
        Serial.println(getCREGStatus(cgregStatus));
    }
    
    delay(500);
    
    // 6. MODULE VOLTAGE/POWER
    printTimestamp();
    Serial.println("--- [6] MODULE POWER (AT+CBC) ---");
    String cbcResp = sendGSMCommand("AT+CBC", 2000);
    if (cbcResp.indexOf("+CBC:") != -1) {
        // Parse battery/voltage info
        Serial.print("  Power Info: ");
        Serial.println(cbcResp);
    }
    
    delay(500);
    
    // 7. AVAILABLE NETWORKS (SCAN) - Only if not registered
    if (cregStatus != 1 && cregStatus != 5) {
        printTimestamp();
        Serial.println("--- [7] NETWORK SCAN (AT+COPS=?) ---");
        Serial.println("  Scanning for available networks (this may take 30s)...");
        String scanResp = sendGSMCommand("AT+COPS=?", 35000);
        if (scanResp.indexOf("+COPS:") != -1) {
            Serial.println("  Available Networks Found:");
            // Extract network list
            int listStart = scanResp.indexOf("(");
            int listEnd = scanResp.lastIndexOf(")");
            if (listStart != -1 && listEnd != -1) {
                String networks = scanResp.substring(listStart, listEnd + 1);
                Serial.println(networks);
            }
        } else {
            Serial.println("  No networks found or scan timeout");
        }
    } else {
        printTimestamp();
        Serial.println("--- [7] NETWORK SCAN ---");
        Serial.println("  Skipped (already registered)");
    }
    
    delay(500);
    
    // 8. MODULE INFORMATION
    printTimestamp();
    Serial.println("--- [8] MODULE INFO (ATI) ---");
    String atiResp = sendGSMCommand("ATI", 2000);
    // ATI returns module info
    
    delay(500);
    
    // 9. SUMMARY
    Serial.println();
    printTimestamp();
    Serial.println("========================================");
    Serial.println("  SUMMARY:");
    Serial.print("    Signal: ");
    Serial.print(csq);
    Serial.print("/31 (");
    Serial.print(rssiToDBm(csq));
    Serial.println(" dBm)");
    Serial.print("    Registration: ");
    Serial.println(getCREGStatus(cregStatus));
    Serial.print("    Operator: ");
    Serial.println(lastOperator.length() > 0 ? lastOperator : "None");
    Serial.println();
    Serial.println("  CRITICAL CHECKS:");
    if (csq == 0) {
        Serial.println("    ⚠️  NO SIGNAL - Check antenna connection!");
    }
    if (cregStatus == 2) {
        Serial.println("    ⚠️  SEARCHING - Module is trying but can't register");
        Serial.println("       Possible causes:");
        Serial.println("       1. No signal (antenna issue)");
        Serial.println("       2. SIM card not 2G compatible (SIM800L is 2G only!)");
        Serial.println("       3. Carrier doesn't support 2G in this area");
    }
    Serial.println("    ℹ️  SIM800L ONLY supports 2G (GSM/GPRS)");
    Serial.println("       Does NOT support 3G or 4G networks");
    Serial.println("========================================");
    
    // Wait before next cycle
    Serial.println();
    Serial.println("Waiting 5 seconds before next cycle...");
    delay(5000);
}