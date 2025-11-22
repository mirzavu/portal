#include <Arduino.h>
#include <TinyGPSPlus.h>

// ==========================================
//       USER CONFIGURATION
// ==========================================
const char* APN = "bsnlnet";                  // Back to official BSNL APN
const char* API_URL = "http://portal.demotesting.co.uk/api/bike-location";
const unsigned long UPLOAD_INTERVAL = 10000;  

// ==========================================
//       PIN DEFINITIONS
// ==========================================
#define MOSFET_GATE 27
#define GSM_RX_PIN 25       
#define GSM_TX_PIN 26       
#define GPS_RX_PIN 16       
#define GPS_TX_PIN 17       
#define BATTERY_PIN 35      

const float VOLTAGE_DIVIDER_RATIO = 4.3; 
const float ADC_REF_VOLTAGE = 3.3;
const int ADC_RESOLUTION = 4095;

HardwareSerial gsmSerial(1);
HardwareSerial gpsSerial(2);
TinyGPSPlus gps;

unsigned long lastUploadTime = 0;

// ==========================================
//       HELPER FUNCTIONS
// ==========================================

String sendAT(String cmd, unsigned long timeout, bool debug = false) {
    while(gsmSerial.available()) gsmSerial.read(); 
    gsmSerial.println(cmd);
    if(debug) { Serial.print("CMD: "); Serial.println(cmd); }
    
    String resp = "";
    unsigned long start = millis();
    while (millis() - start < timeout) {
        while (gsmSerial.available()) {
            char c = gsmSerial.read();
            resp += c;
        }
    }
    if(debug) { Serial.print("RESP: "); Serial.println(resp); }
    return resp;
}

// 1. Signal Strength Check
void checkSignal() {
    String resp = sendAT("AT+CSQ", 2000);
    if (resp.indexOf("+CSQ:") != -1) {
        Serial.print("[SIGNAL] "); Serial.println(resp.substring(resp.indexOf("+CSQ:")));
    }
}

// 2. Initialize GPRS (The "Nuclear" Version)
bool initGPRS() {
    Serial.println("[GPRS] ☢️ Performing NUCLEAR RESET (CIPSHUT)...");
    sendAT("AT+CIPSHUT", 2000); // Reset IP Stack
    delay(500);
    sendAT("AT+SAPBR=0,1", 2000); // Close Bearer
    delay(1000);

    Serial.println("[GPRS] Configuring...");
    sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000);
    sendAT("AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"", 1000);
    
    // Force Google DNS
    sendAT("AT+CDNSCFG=\"8.8.8.8\",\"8.8.4.4\"", 1000); 
    
    Serial.println("[GPRS] Opening bearer...");
    // Attempt connection (Timeout 10s)
    if(sendAT("AT+SAPBR=1,1", 10000).indexOf("OK") == -1) {
        Serial.println("[GPRS] ❌ Bearer Open Failed");
        return false;
    }
    
    // Verify IP
    String resp = sendAT("AT+SAPBR=2,1", 2000);
    if (resp.indexOf("\"0.0.0.0\"") == -1 && resp.indexOf("\"") != -1) {
        Serial.println("[GPRS] ✅ Connected! IP Obtained.");
        return true;
    }
    return false;
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
    Serial.println("\n=== UPLOAD START ===");
    
    checkSignal(); // Check signal before trying

    // Check if GPRS is alive, if not, nuke and reconnect
    if (sendAT("AT+SAPBR=2,1", 2000).indexOf("\"0.0.0.0\"") != -1) {
        if(!initGPRS()) return;
    }

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
    
    Serial.println("Payload: " + payload);

    // HTTP Session Setup
    sendAT("AT+HTTPTERM", 1000); delay(200);
    if (sendAT("AT+HTTPINIT", 2000).indexOf("OK") == -1) {
        Serial.println("HTTPINIT Failed - trying CIPSHUT recover");
        sendAT("AT+CIPSHUT", 1000);
        return;
    }
    
    sendAT("AT+HTTPPARA=\"CID\",1", 2000);
    sendAT("AT+HTTPPARA=\"URL\",\"" + String(API_URL) + "\"", 2000);
    sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 2000);
    
    // Send Data
    String cmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
    if (sendAT(cmd, 3000).indexOf("DOWNLOAD") != -1) {
        sendAT(payload, 3000);
        
        Serial.println("[UPLOAD] POSTing (Wait 20s)...");
        String resp = sendAT("AT+HTTPACTION=1", 20000, true); // 20s timeout
        
        if (resp.indexOf(",200") != -1 || resp.indexOf(",201") != -1) {
            Serial.println("✅ SUCCESS!");
            // Optional: Read response
            // Serial.println(sendAT("AT+HTTPREAD", 3000));
        } else {
             Serial.print("❌ FAIL. Code: ");
             // Extract Error Code
             int start = resp.indexOf(",");
             if(start != -1) {
                 int end = resp.indexOf(",", start+1);
                 if(end != -1) Serial.println(resp.substring(start+1, end));
                 else Serial.println("Unknown");
             }
        }
    }
    sendAT("AT+HTTPTERM", 2000);
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("=== GPS TRACKER FINAL (CIPSHUT) ===");

    pinMode(MOSFET_GATE, OUTPUT);
    digitalWrite(MOSFET_GATE, HIGH);
    delay(15000);

    gsmSerial.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    
    gpsSerial.println("$PMTK220,1000*1F"); 
    gpsSerial.println("$PMTK314,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0*28"); 
    
    // Wait for GSM
    int retry = 0;
    while (sendAT("AT", 1000).indexOf("OK") == -1) {
        Serial.println("Waiting for GSM...");
        retry++;
        if(retry > 5) break;
        delay(2000);
    }
    
    initGPRS();
}

void loop() {
    while (gpsSerial.available() > 0) gps.encode(gpsSerial.read());

    if (millis() - lastUploadTime > UPLOAD_INTERVAL) {
        lastUploadTime = millis();
        if (gps.location.isValid()) {
            Serial.print("GPS Lock: "); Serial.println(gps.satellites.value());
        } else {
            Serial.println("GPS Searching...");
        }
        uploadLocation();
    }
}