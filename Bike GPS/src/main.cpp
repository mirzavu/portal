#include <Arduino.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ==========================================
//       USER CONFIGURATION
// ==========================================
const char* WIFI_SSID = "TheBoss";
const char* WIFI_PASSWORD = "12121234";
const char* API_URL = "http://portal.demotesting.co.uk/api/bike-location";
const char* DEBUG_API_URL = "http://portal.demotesting.co.uk/api/device-debug";
const unsigned long UPLOAD_INTERVAL = 10000;
const unsigned long SERIAL_LOG_UPLOAD_INTERVAL = 50000; // Upload serial logs every 50 seconds  

// ==========================================
//       PIN DEFINITIONS
// ==========================================
#define MOSFET_GATE 27
#define GPS_RX_PIN 16       
#define GPS_TX_PIN 17       
#define BATTERY_PIN 35      

const float VOLTAGE_DIVIDER_RATIO = 4.3; 
const float ADC_REF_VOLTAGE = 3.3;
const int ADC_RESOLUTION = 4095;

HardwareSerial gpsSerial(2);
TinyGPSPlus gps;

unsigned long lastUploadTime = 0;
unsigned long lastSerialLogUploadTime = 0;
unsigned long stepStart = 0; // Timer variable

// Serial output buffer
const size_t SERIAL_BUFFER_SIZE = 16384; // 16KB buffer
String serialBuffer = "";
bool serialBufferEnabled = false;

// ==========================================
//       HELPER FUNCTIONS
// ==========================================

// Serial logging functions that buffer output
void logPrint(String text) {
    Serial.print(text);
    if (serialBufferEnabled) {
        // Circular buffer: if too large, keep only the most recent data
        if (serialBuffer.length() + text.length() > SERIAL_BUFFER_SIZE) {
            // Remove oldest data to make room
            size_t removeSize = text.length() + 1000; // Remove a bit extra for safety
            if (removeSize > serialBuffer.length()) {
                serialBuffer = "";
            } else {
                serialBuffer = serialBuffer.substring(removeSize);
            }
        }
        serialBuffer += text;
    }
}

void logPrintln(String text = "") {
    logPrint(text + "\n");
}

void markStep() {
    stepStart = millis();
}

void logStep(String stepName) {
    unsigned long duration = millis() - stepStart;
    logPrint("[TIME] ");
    logPrint(stepName);
    logPrint(": ");
    logPrint(String(duration));
    logPrintln(" ms");
    stepStart = millis(); // Reset for next step
}

bool connectToWiFi() {
    markStep();
    logPrintln("[WiFi] Connecting to " + String(WIFI_SSID) + "...");
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        logPrint(".");
        attempts++;
    }
    logPrintln("");
    
    if (WiFi.status() == WL_CONNECTED) {
        logPrint("[WiFi] Connected! IP: ");
        logPrintln(WiFi.localIP().toString());
        logPrint("[WiFi] RSSI: ");
        logPrint(String(WiFi.RSSI()));
        logPrintln(" dBm");
        logStep("WiFi Connect");
        return true;
    } else {
        logPrintln("[WiFi] ❌ Connection failed!");
        logStep("WiFi Connect (FAILED)");
        return false;
    }
}

bool checkWiFi() {
    if (WiFi.status() != WL_CONNECTED) {
        logPrintln("[WiFi] Connection lost. Reconnecting...");
        return connectToWiFi();
    }
    return true;
}

unsigned long toUnixTime(TinyGPSDate &d, TinyGPSTime &t) {
    if (!d.isValid() || !t.isValid()) return 0;
    int y = d.year(); int m = d.month(); int day = d.day();
    int h = t.hour(); int min = t.minute(); int s = t.second();
    const int daysInMonth[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    long days = 0;
    for (int i = 1970; i < y; i++) {
        days += 365;
        if ((i % 4 == 0 && i % 100 != 0) || (i % 400 == 0)) days++;
    }
    for (int i = 1; i < m; i++) {
        days += daysInMonth[i-1];
        if (i == 2 && ((y % 4 == 0 && y % 100 != 0) || (y % 400 == 0))) days++;
    }
    days += day - 1;
    return ((days * 24L + h) * 60 + min) * 60 + s;
}

int getBatteryMV() {
    long sum = 0;
    for(int i = 0; i < 10; i++) {
        sum += analogRead(BATTERY_PIN);
        delay(2);
    }
    float avg = sum / 10.0;
    float voltage = (avg / ADC_RESOLUTION) * ADC_REF_VOLTAGE * VOLTAGE_DIVIDER_RATIO;
    return (int)(voltage * 1000);
}

void uploadLocation() {
    unsigned long cycleStart = millis();
    logPrintln("\n=== UPLOAD START ===");
    
    // Check WiFi connection
    markStep();
    if (!checkWiFi()) {
        logStep("WiFi Check (FAILED)");
        return;
    }
    logStep("WiFi Check (OK)");

    float lat = gps.location.lat();
    float lon = gps.location.lng();
    int sats = gps.satellites.value();
    int bat = getBatteryMV();
    unsigned long timestamp = toUnixTime(gps.date, gps.time);
    if (timestamp == 0) timestamp = 1700000000 + (millis()/1000);

    String payload = "{";
    payload += "\"latitude\":" + String(lat, 6) + ",";
    payload += "\"longitude\":" + String(lon, 6) + ",";
    payload += "\"satellites\":" + String(sats) + ",";
    payload += "\"battery_mv\":" + String(bat) + ",";
    payload += "\"timestamp\":" + String(timestamp);
    payload += "}";
    
    logPrintln("Payload: " + payload);

    // HTTP POST
    markStep();
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(payload);
    logStep("HTTP POST");
    
    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
            logPrintln("✅ SUCCESS! HTTP " + String(httpCode));
            String response = http.getString();
            if (response.length() > 0) {
                logPrintln("Response: " + response);
            }
        } else {
            logPrint("❌ FAIL. HTTP Code: ");
            logPrintln(String(httpCode));
            logPrintln("Response: " + http.getString());
        }
    } else {
        logPrint("❌ FAIL. Error: ");
        logPrintln(http.errorToString(httpCode));
    }
    
    http.end();
    
    logPrint("[TIMING] Total Cycle: ");
    logPrint(String((millis() - cycleStart) / 1000));
    logPrintln(" s");
}

void uploadSerialLog() {
    if (serialBuffer.length() == 0) {
        return; // Nothing to upload
    }
    
    unsigned long cycleStart = millis();
    logPrintln("\n=== SERIAL LOG UPLOAD START ===");
    
    // Check WiFi connection
    markStep();
    if (!checkWiFi()) {
        logStep("WiFi Check (FAILED)");
        return;
    }
    logStep("WiFi Check (OK)");

    // Create payload with serial log
    unsigned long timestamp = toUnixTime(gps.date, gps.time);
    if (timestamp == 0) timestamp = 1700000000 + (millis()/1000);
    
    // Escape JSON string (replace " with \", \ with \\, newlines with \n)
    String escapedLog = serialBuffer;
    escapedLog.replace("\\", "\\\\");
    escapedLog.replace("\"", "\\\"");
    escapedLog.replace("\n", "\\n");
    escapedLog.replace("\r", "\\r");
    
    String payload = "{";
    payload += "\"serial_log\":\"" + escapedLog + "\",";
    payload += "\"timestamp\":" + String(timestamp);
    payload += "}";
    
    logPrint("Serial log size: "); logPrint(String(serialBuffer.length())); logPrintln(" bytes");

    // HTTP POST
    markStep();
    HTTPClient http;
    http.begin(DEBUG_API_URL);
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(payload);
    logStep("HTTP POST");
    
    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
            logPrintln("✅ SERIAL LOG UPLOAD SUCCESS! HTTP " + String(httpCode));
            // Clear buffer after successful upload (keep last 1KB for continuity)
            if (serialBuffer.length() > 1024) {
                serialBuffer = serialBuffer.substring(serialBuffer.length() - 1024);
            } else {
                serialBuffer = "";
            }
        } else {
            logPrint("❌ SERIAL LOG UPLOAD FAIL. HTTP Code: ");
            logPrintln(String(httpCode));
            logPrintln("Response: " + http.getString());
        }
    } else {
        logPrint("❌ SERIAL LOG UPLOAD FAIL. Error: ");
        logPrintln(http.errorToString(httpCode));
    }
    
    http.end();
    
    logPrint("[TIMING] Serial Log Upload Cycle: ");
    logPrint(String((millis() - cycleStart) / 1000));
    logPrintln(" s");
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    // Enable serial buffer after Serial.begin
    serialBufferEnabled = true;
    serialBuffer = "";
    logPrintln("=== GPS TRACKER (WiFi) ===");

    pinMode(MOSFET_GATE, OUTPUT);
    digitalWrite(MOSFET_GATE, HIGH);
    delay(15000);

    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    
    gpsSerial.println("$PMTK220,1000*1F"); 
    gpsSerial.println("$PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*28"); 
    
    // Connect to WiFi
    connectToWiFi();
}

void loop() {
    while (gpsSerial.available() > 0) gps.encode(gpsSerial.read());

    if (millis() - lastUploadTime > UPLOAD_INTERVAL) {
        lastUploadTime = millis();
        if (gps.location.isValid()) {
            logPrint("GPS Lock: "); logPrintln(String(gps.satellites.value()));
        } else {
            logPrintln("GPS Searching...");
        }
        uploadLocation();
    }
    
    // Upload serial logs periodically
    if (millis() - lastSerialLogUploadTime > SERIAL_LOG_UPLOAD_INTERVAL) {
        lastSerialLogUploadTime = millis();
        if (serialBuffer.length() > 0) {
            uploadSerialLog();
        }
    }
}
