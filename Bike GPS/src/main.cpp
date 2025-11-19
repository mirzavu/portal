#include <Arduino.h>
#include <TinyGPSPlus.h>

// ============================================
// CONFIGURATION
// ============================================

// Pin Definitions
#define MOSFET_GATE 27    // Controls power to GPS and GSM modules
// GPS uses Serial2: GPS_TX -> RX2(16), GPS_RX -> TX2(17)
// GSM uses Serial1: GSM_TX -> D26, GSM_RX -> D25

// Timing Configuration
const unsigned long UPDATE_INTERVAL = 600000;  // 10 minutes (600,000 ms)
const unsigned long GPS_TIMEOUT = 120000;      // 2 minutes to get GPS fix
const unsigned long GSM_TIMEOUT = 60000;       // 1 minute for GSM operations

// API Configuration
const char* API_URL = "portal.demotesting.co.uk";
const char* API_ENDPOINT = "/api/bike-location";
const int API_PORT = 443;  // HTTPS

// APN Configuration (adjust for your SIM card)
const char* APN = "internet";  // Common APN, change if needed

// ============================================
// GLOBAL OBJECTS
// ============================================

TinyGPSPlus gps;
HardwareSerial gpsSerial(2);    // GPS on Serial2 (RX2=16, TX2=17)
HardwareSerial gsmSerial(1);    // GSM on Serial1 (RX=26, TX=25)

// ============================================
// FUNCTION DECLARATIONS
// ============================================

void powerOn();
void powerOff();
bool getGPSFix();
bool initGSM();
bool postLocationToAPI(double lat, double lon, double spd, int sats, int battery);
String sendGSMCommand(String cmd, unsigned long timeout = 1000);
int getBatteryVoltage();

// ============================================
// SETUP
// ============================================

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n\n╔════════════════════════════════════════╗");
    Serial.println("║   Bike GPS Tracker - v1.0             ║");
    Serial.println("╚════════════════════════════════════════╝\n");
    
    // Setup MOSFET pin
    pinMode(MOSFET_GATE, OUTPUT);
    digitalWrite(MOSFET_GATE, LOW);  // Start with modules off
    
    Serial.println("✓ System initialized");
    Serial.printf("  Update Interval: %lu seconds\n", UPDATE_INTERVAL / 1000);
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
    Serial.println("\n═══════════════════════════════════════");
    Serial.println("  Starting Location Update Cycle");
    Serial.println("═══════════════════════════════════════\n");
    
    // 1. Power on modules
    powerOn();
    
    // 2. Get GPS fix
    Serial.println("[1/4] Getting GPS fix...");
    bool gpsSuccess = getGPSFix();
    
    if (!gpsSuccess) {
        Serial.println("✗ Failed to get GPS fix");
        powerOff();
        delay(60000);  // Wait 1 minute before retry
        return;
    }
    
    double latitude = gps.location.lat();
    double longitude = gps.location.lng();
    double speed = gps.speed.kmph();
    int satellites = gps.satellites.value();
    int battery = getBatteryVoltage();
    
    Serial.println("✓ GPS fix acquired");
    Serial.printf("  Location: %.6f, %.6f\n", latitude, longitude);
    Serial.printf("  Speed: %.2f km/h\n", speed);
    Serial.printf("  Satellites: %d\n", satellites);
    Serial.printf("  Battery: %d mV\n", battery);
    
    // 3. Initialize GSM
    Serial.println("\n[2/4] Initializing GSM...");
    bool gsmSuccess = initGSM();
    
    if (!gsmSuccess) {
        Serial.println("✗ Failed to initialize GSM");
        powerOff();
        delay(60000);
        return;
    }
    
    Serial.println("✓ GSM initialized");
    
    // 4. Post to API
    Serial.println("\n[3/4] Posting location to API...");
    bool apiSuccess = postLocationToAPI(latitude, longitude, speed, satellites, battery);
    
    if (apiSuccess) {
        Serial.println("✓ Location posted successfully!");
    } else {
        Serial.println("✗ Failed to post location");
    }
    
    // 5. Power off and wait
    Serial.println("\n[4/4] Powering down...");
    powerOff();
    
    Serial.printf("\n⏱ Waiting %lu seconds until next update...\n", UPDATE_INTERVAL / 1000);
    delay(UPDATE_INTERVAL);
}

// ============================================
// POWER MANAGEMENT
// ============================================

void powerOn() {
    Serial.println("⚡ Powering on GPS and GSM modules...");
    digitalWrite(MOSFET_GATE, HIGH);
    delay(3000);  // Wait for modules to boot
    
    // Initialize GPS Serial
    gpsSerial.begin(9600, SERIAL_8N1, 16, 17);  // RX=16, TX=17
    
    // Initialize GSM Serial
    gsmSerial.begin(115200, SERIAL_8N1, 26, 25);  // RX=26, TX=25
    delay(2000);
    
    Serial.println("✓ Modules powered on");
}

void powerOff() {
    Serial.println("⚡ Powering off GPS and GSM modules...");
    gsmSerial.end();
    gpsSerial.end();
    digitalWrite(MOSFET_GATE, LOW);
    Serial.println("✓ Modules powered off");
}

// ============================================
// GPS FUNCTIONS
// ============================================

bool getGPSFix() {
    unsigned long startTime = millis();
    bool fixAcquired = false;
    
    Serial.println("  Waiting for GPS fix...");
    
    while (millis() - startTime < GPS_TIMEOUT) {
        while (gpsSerial.available() > 0) {
            char c = gpsSerial.read();
            gps.encode(c);
            
            if (gps.location.isUpdated() && gps.location.isValid()) {
                fixAcquired = true;
                break;
            }
        }
        
        if (fixAcquired) break;
        
        // Print progress every 10 seconds
        if ((millis() - startTime) % 10000 < 100) {
            Serial.printf("  Searching... (%lu/%lu seconds)\n", 
                         (millis() - startTime) / 1000, GPS_TIMEOUT / 1000);
        }
        
        delay(100);
    }
    
    return fixAcquired;
}

// ============================================
// GSM FUNCTIONS
// ============================================

bool initGSM() {
    // Test AT command
    Serial.println("  Testing GSM module...");
    String response = sendGSMCommand("AT", 1000);
    if (response.indexOf("OK") == -1) {
        Serial.println("  ✗ GSM module not responding");
        return false;
    }
    Serial.println("  ✓ GSM module responding");
    
    // Check SIM card
    Serial.println("  Checking SIM card...");
    response = sendGSMCommand("AT+CPIN?", 5000);
    if (response.indexOf("READY") == -1) {
        Serial.println("  ✗ SIM card not ready");
        return false;
    }
    Serial.println("  ✓ SIM card ready");
    
    // Check network registration
    Serial.println("  Checking network registration...");
    for (int i = 0; i < 20; i++) {
        response = sendGSMCommand("AT+CREG?", 1000);
        if (response.indexOf(",1") != -1 || response.indexOf(",5") != -1) {
            Serial.println("  ✓ Registered on network");
            return true;
        }
        Serial.printf("  Waiting for network... (%d/20)\n", i + 1);
        delay(2000);
    }
    
    Serial.println("  ✗ Failed to register on network");
    return false;
}

bool postLocationToAPI(double lat, double lon, double spd, int sats, int battery) {
    // Configure bearer profile
    sendGSMCommand("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 2000);
    sendGSMCommand("AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"", 2000);
    
    // Open bearer
    Serial.println("  Opening GPRS connection...");
    String response = sendGSMCommand("AT+SAPBR=1,1", 10000);
    if (response.indexOf("OK") == -1 && response.indexOf("ALREADY") == -1) {
        Serial.println("  ✗ Failed to open GPRS");
        return false;
    }
    Serial.println("  ✓ GPRS connected");
    
    // Initialize HTTP
    sendGSMCommand("AT+HTTPINIT", 2000);
    sendGSMCommand("AT+HTTPPARA=\"CID\",1", 2000);
    
    // Set URL
    String url = "https://" + String(API_URL) + String(API_ENDPOINT);
    sendGSMCommand("AT+HTTPPARA=\"URL\",\"" + url + "\"", 2000);
    
    // Prepare JSON payload
    unsigned long timestamp = millis() / 1000;  // Note: This is uptime, not Unix time
    // You may want to sync time via GSM: AT+CCLK?
    
    String jsonPayload = "{";
    jsonPayload += "\"latitude\":" + String(lat, 6) + ",";
    jsonPayload += "\"longitude\":" + String(lon, 6) + ",";
    jsonPayload += "\"speed\":" + String(spd, 2) + ",";
    jsonPayload += "\"satellites\":" + String(sats) + ",";
    jsonPayload += "\"battery_mv\":" + String(battery) + ",";
    jsonPayload += "\"timestamp\":" + String(timestamp);
    jsonPayload += "}";
    
    Serial.println("  JSON: " + jsonPayload);
    
    // Set content type
    sendGSMCommand("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 2000);
    
    // Set HTTP data
    gsmSerial.println("AT+HTTPDATA=" + String(jsonPayload.length()) + ",10000");
    delay(1000);
    gsmSerial.println(jsonPayload);
    delay(2000);
    
    // Send POST request
    Serial.println("  Sending POST request...");
    response = sendGSMCommand("AT+HTTPACTION=1", 15000);  // 1 = POST
    delay(5000);  // Wait for response
    
    // Read response
    response = sendGSMCommand("AT+HTTPREAD", 5000);
    Serial.println("  API Response: " + response);
    
    // Terminate HTTP
    sendGSMCommand("AT+HTTPTERM", 2000);
    
    // Close bearer
    sendGSMCommand("AT+SAPBR=0,1", 5000);
    
    // Check if successful (look for 200 or 201)
    bool success = (response.indexOf("200") != -1 || response.indexOf("201") != -1);
    return success;
}

String sendGSMCommand(String cmd, unsigned long timeout) {
    gsmSerial.println(cmd);
    
    unsigned long startTime = millis();
    String response = "";
    
    while (millis() - startTime < timeout) {
        while (gsmSerial.available()) {
            char c = gsmSerial.read();
            response += c;
        }
        
        if (response.indexOf("OK") != -1 || response.indexOf("ERROR") != -1) {
            break;
        }
        
        delay(10);
    }
    
    return response;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

int getBatteryVoltage() {
    // Read battery voltage from ADC (adjust pin and calculation for your setup)
    // For now, return a dummy value
    // TODO: Implement actual battery voltage reading
    return 3700;  // Dummy value in mV
}