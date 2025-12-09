#include <Arduino.h>
#include <time.h>
#include <TinyGPSPlus.h>     
#include "soc/soc.h"             
#include "soc/rtc_cntl_reg.h"    

// ==========================================
//       USER CONFIGURATION
// ==========================================
const char* APN = "giffgaff.com"; 
const char* LOCATION_API_URL = "http://portal.demotesting.co.uk/api/bike-location";
const char* DEBUG_API_URL = "http://portal.demotesting.co.uk/api/device-debug";

// ==========================================
//       PIN DEFINITIONS
// ==========================================
#define MOSFET_GATE 27
#define GSM_RX_PIN 25       
#define GSM_TX_PIN 26       
#define GPS_RX_PIN 16       
#define GPS_TX_PIN 17       
#define BATTERY_PIN 35      
#define LED_PIN 2           

const float VOLTAGE_DIVIDER_RATIO = 4.3; 
const float ADC_REF_VOLTAGE = 3.3;
const int ADC_RESOLUTION = 4095;

HardwareSerial gsmSerial(1);
HardwareSerial gpsSerial(2); 
TinyGPSPlus gps;             

// ==========================================
//       LOGGING SYSTEM
// ==========================================
// Reduced buffer size since we only upload on error/rarely
String logBuffer = "";
const int MAX_LOG_SIZE = 500; 

void log(String text) {
    Serial.println(text); 
    logBuffer += text + "\n";
    if (logBuffer.length() > MAX_LOG_SIZE) {
        logBuffer = logBuffer.substring(logBuffer.length() - MAX_LOG_SIZE);
    }
}

// ==========================================
//       LED STATUS HELPERS
// ==========================================
void blink(int times, int durationMs) {
    for(int i=0; i<times; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(durationMs);
        digitalWrite(LED_PIN, LOW);
        if (times > 1) delay(durationMs);
    }
}

void signalSOS() {
    for(int i=0; i<3; i++) { digitalWrite(LED_PIN, HIGH); delay(100); digitalWrite(LED_PIN, LOW); delay(100); }
    delay(300);
    for(int i=0; i<3; i++) { digitalWrite(LED_PIN, HIGH); delay(400); digitalWrite(LED_PIN, LOW); delay(200); }
    delay(300);
    for(int i=0; i<3; i++) { digitalWrite(LED_PIN, HIGH); delay(100); digitalWrite(LED_PIN, LOW); delay(100); }
    delay(1000);
}

// ==========================================
//       GSM FUNCTIONS
// ==========================================
String sendAT(String cmd, unsigned long timeout) {
    while(gsmSerial.available()) gsmSerial.read(); 
    gsmSerial.println(cmd);
    // log("CMD: " + cmd);  
    
    String resp = "";
    unsigned long start = millis();
    while (millis() - start < timeout) {
        while (gsmSerial.available()) {
            char c = gsmSerial.read();
            resp += c;
        }
    }
    // log("RESP: " + resp); 
    return resp;
}

bool initGPRS() {
    blink(1, 500);
    sendAT("AT+CIPSHUT", 2000); 
    sendAT("AT+SAPBR=0,1", 2000); 
    sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000);
    sendAT("AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"", 1000);
    sendAT("AT+CLTS=1", 1000); 
    
    String resp = sendAT("AT+SAPBR=1,1", 10000);
    if (sendAT("AT+SAPBR=2,1", 2000).indexOf("\"0.0.0.0\"") != -1) {
        return false;
    }
    
    sendAT("AT+CNTPCID=1", 1000);
    sendAT("AT+CNTP=\"pool.ntp.org\",0", 1000);
    sendAT("AT+CNTP", 5000); 
    
    return true;
}

unsigned long parseCCLKToUnix(String cclk) {
    int first = cclk.indexOf("\"");
    if (first == -1) return 1763810000; 
    
    String t = cclk.substring(first + 1); 
    if (t.length() < 17) return 1763810000;

    struct tm tm;
    tm.tm_year = t.substring(0, 2).toInt() + 100; 
    if (tm.tm_year < 120) tm.tm_year += 2000; 
    if (tm.tm_year < 124) return 1763810000; 

    tm.tm_mon = t.substring(3, 5).toInt() - 1;    
    tm.tm_mday = t.substring(6, 8).toInt();
    tm.tm_hour = t.substring(9, 11).toInt();
    tm.tm_min = t.substring(12, 14).toInt();
    tm.tm_sec = t.substring(15, 17).toInt();
    tm.tm_isdst = 0; 

    time_t time = mktime(&tm);
    if (time == -1) return 1763810000;
    return (unsigned long)time;
}

unsigned long getNetworkTime() {
    String resp = sendAT("AT+CCLK?", 2000);
    if (resp.indexOf("+CCLK:") != -1) {
        return parseCCLKToUnix(resp);
    }
    return 1763810000; 
}

int getBatteryMV() {
    long sum = 0;
    for(int i = 0; i < 10; i++) { sum += analogRead(BATTERY_PIN); delay(2); }
    float avg = sum / 10.0;
    return (int)((avg / ADC_RESOLUTION) * ADC_REF_VOLTAGE * VOLTAGE_DIVIDER_RATIO * 1000);
}

int getCSQ() {
    String resp = sendAT("AT+CSQ", 2000);
    int idx = resp.indexOf("+CSQ: ");
    if (idx != -1) {
        String val = resp.substring(idx + 6);
        int comma = val.indexOf(",");
        if (comma != -1) return val.substring(0, comma).toInt();
    }
    return 0;
}

void postData(String url, String payload, bool isDebugLog = false) {
    blink(5, 50);
    
    for(int attempt=0; attempt<2; attempt++) { 
        sendAT("AT+HTTPTERM", 500); delay(100);
        sendAT("AT+HTTPINIT", 2000);
        sendAT("AT+HTTPPARA=\"CID\",1", 2000);
        sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", 2000);
        
        if (isDebugLog) {
            sendAT("AT+HTTPPARA=\"CONTENT\",\"text/plain\"", 2000);
        } else {
            sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 2000);
        }
        
        String cmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
        
        while(gsmSerial.available()) gsmSerial.read(); 
        delay(100); 
        
        gsmSerial.println(cmd);
        
        bool readyToUpload = false;
        unsigned long start = millis();
        String accumulatedResponse = "";
        while(millis() - start < 10000) { 
            if(gsmSerial.available()) {
                char c = gsmSerial.read();
                accumulatedResponse += c;
                if(accumulatedResponse.indexOf("DOWNLOAD") != -1) {
                    readyToUpload = true;
                    break;
                }
            }
        }

        if (readyToUpload) {
            gsmSerial.print(payload);
            delay(500); 
            
            String resp = sendAT("AT+HTTPACTION=1", 30000); 
            
            if (resp.indexOf(",200") != -1 || resp.indexOf(",201") != -1) {
                digitalWrite(LED_PIN, HIGH); delay(3000); digitalWrite(LED_PIN, LOW);
                log("UPLOAD SUCCESS");
                if(isDebugLog) logBuffer = "";
                return; 
            } else {
                log("UPLOAD FAILED: " + resp);
            }
        } else {
            log("HTTPDATA ERROR: No DOWNLOAD prompt");
        }
        
        log("Retry attempt " + String(attempt+1));
        sendAT("AT+HTTPTERM", 2000);
        delay(2000);
    }
    
    digitalWrite(LED_PIN, HIGH); delay(2000); digitalWrite(LED_PIN, LOW);
}

// ==========================================
//       SMART LOGIC HELPERS
// ==========================================
float lastLat = 0.0;
float lastLon = 0.0;
unsigned long lastUploadTime = 0;

// Haversine distance in meters
float calculateDistance(float lat1, float lon1, float lat2, float lon2) {
    float R = 6371000; // Earth radius in meters
    float dLat = radians(lat2 - lat1);
    float dLon = radians(lon2 - lon1);
    float a = sin(dLat/2) * sin(dLat/2) +
              cos(radians(lat1)) * cos(radians(lat2)) *
              sin(dLon/2) * sin(dLon/2);
    float c = 2 * atan2(sqrt(a), sqrt(1-a));
    return R * c;
}

// ==========================================
//       MAIN SETUP
// ==========================================
void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, HIGH); 
    
    Serial.begin(115200);
    delay(1000);
    log("=== BIKE GPS: SMART TRACKING MODE ===");

    pinMode(MOSFET_GATE, OUTPUT);
    digitalWrite(MOSFET_GATE, HIGH);
    
    log("Waiting 20s for GSM/GPS init...");
    delay(20000); 
    digitalWrite(LED_PIN, LOW);

    gsmSerial.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN); 
    
    log("Connecting GPRS...");
    int retry = 0;
    while(!initGPRS()) {
        retry++;
        log("GPRS Retry " + String(retry));
        signalSOS(); 
        delay(5000);
        if(retry > 5) ESP.restart();
    }
    blink(5, 100); 
}

// ==========================================
//       MAIN LOOP
// ==========================================
void loop() {
    // 1. Read GPS for 2 seconds
    unsigned long gpsStart = millis();
    int sats = 0;
    float lat = 0.0;
    float lon = 0.0;
    bool gpsValid = false;

    while (millis() - gpsStart < 2000) {
        while (gpsSerial.available() > 0) {
            if (gps.encode(gpsSerial.read())) {
                if (gps.location.isValid()) {
                    lat = gps.location.lat();
                    lon = gps.location.lng();
                    sats = gps.satellites.value();
                    gpsValid = true;
                }
            }
        }
    }

    // 2. Smart Decision Logic
    bool shouldUpload = false;
    
    if (gpsValid) {
        float dist = calculateDistance(lat, lon, lastLat, lastLon);
        
        // If moved > 20m OR last upload > 5 minutes ago
        if (dist > 20.0 || (millis() - lastUploadTime > 300000)) {
            shouldUpload = true;
            log("Motion: " + String(dist, 1) + "m");
        } else {
            log("Stationary (Dist: " + String(dist, 1) + "m)");
        }
    } else {
        // If no GPS but 5 mins passed, send heartbeat (with dummy loc or 0,0)
        if (millis() - lastUploadTime > 300000) {
            shouldUpload = true;
            log("Heartbeat (No GPS)");
        }
    }

    // 3. Upload if needed
    if (shouldUpload) {
        int bat_mv = getBatteryMV();
        unsigned long unixTime = getNetworkTime();
        
        String locPayload = "{";
        if (gpsValid) {
            locPayload += "\"latitude\":" + String(lat, 6) + ",";
            locPayload += "\"longitude\":" + String(lon, 6) + ",";
            locPayload += "\"satellites\":" + String(sats) + ",";
            
            // Update history
            lastLat = lat;
            lastLon = lon;
        } else {
            // Fallback / Heartbeat
            locPayload += "\"latitude\":51.5074,";
            locPayload += "\"longitude\":-0.1278,";
            locPayload += "\"satellites\":0,";
        }
        
        locPayload += "\"timestamp\":" + String(unixTime) + ","; 
        locPayload += "\"battery_mv\":" + String(bat_mv);
        locPayload += "}";
        
        postData(LOCATION_API_URL, locPayload, false);
        lastUploadTime = millis();
        
    } else {
        // Optional: Light Sleep here to save power?
        // For now just wait
    }
    
    log("Sleeping 30s...");
    delay(30000);
}
