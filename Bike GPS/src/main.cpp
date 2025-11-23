#include <Arduino.h>
#include <time.h>
#include "soc/soc.h"             // Required for brownout fix
#include "soc/rtc_cntl_reg.h"    // Required for brownout fix

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
// #define GPS_RX_PIN 16       // DISABLED FOR ISOLATION TEST
// #define GPS_TX_PIN 17       // DISABLED FOR ISOLATION TEST
#define BATTERY_PIN 35      
#define LED_PIN 2           

const float VOLTAGE_DIVIDER_RATIO = 4.3; 
const float ADC_REF_VOLTAGE = 3.3;
const int ADC_RESOLUTION = 4095;

HardwareSerial gsmSerial(1);
// HardwareSerial gpsSerial(2); // DISABLED FOR ISOLATION TEST

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
    Serial.println("CMD: " + cmd);
    
    String resp = "";
    unsigned long start = millis();
    while (millis() - start < timeout) {
        while (gsmSerial.available()) {
            char c = gsmSerial.read();
            resp += c;
        }
    }
    Serial.println("RESP: " + resp);
    return resp;
}

bool initGPRS() {
    blink(1, 500);
    sendAT("AT+CIPSHUT", 2000); 
    sendAT("AT+SAPBR=0,1", 2000); 
    sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000);
    sendAT("AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"", 1000);
    sendAT("AT+CLTS=1", 1000); // Enable Network Time
    
    String resp = sendAT("AT+SAPBR=1,1", 10000);
    if (sendAT("AT+SAPBR=2,1", 2000).indexOf("\"0.0.0.0\"") != -1) {
        return false;
    }
    
    // Attempt to sync time manually if auto-sync failed
    sendAT("AT+CNTPCID=1", 1000);
    sendAT("AT+CNTP=\"pool.ntp.org\",0", 1000);
    sendAT("AT+CNTP", 5000); // Start Sync
    
    return true;
}

// Helper to parse +CCLK: "25/11/23,15:30:00+00" into Unix Timestamp
unsigned long parseCCLKToUnix(String cclk) {
    int first = cclk.indexOf("\"");
    if (first == -1) return 1763810000; // Fallback
    
    String t = cclk.substring(first + 1); // 25/11/23,15:30:00+04"
    if (t.length() < 17) return 1763810000;

    struct tm tm;
    tm.tm_year = t.substring(0, 2).toInt() + 100; // Years since 1900. 25 -> 125 (2025)
    if (tm.tm_year < 120) tm.tm_year += 2000; // Handle 2-digit year if needed, though +100 is usually correct for struct tm
    
    // If year looks like 104 (2004), it means the modem has not synced NTP yet.
    // Force it to at least 2025 if it looks invalid
    if (tm.tm_year < 124) { // Less than 2024
         return 1763810000; // Return fallback 2025 timestamp
    }

    tm.tm_mon = t.substring(3, 5).toInt() - 1;    // 0-11
    tm.tm_mday = t.substring(6, 8).toInt();
    tm.tm_hour = t.substring(9, 11).toInt();
    tm.tm_min = t.substring(12, 14).toInt();
    tm.tm_sec = t.substring(15, 17).toInt();
    tm.tm_isdst = 0; // Assume UTC/Standard

    time_t time = mktime(&tm);
    if (time == -1) return 1763810000;
    return (unsigned long)time;
}

unsigned long getNetworkTime() {
    String resp = sendAT("AT+CCLK?", 2000);
    if (resp.indexOf("+CCLK:") != -1) {
        return parseCCLKToUnix(resp);
    }
    return 1763810000; // Fallback to Nov 2025 default if fail
}

String getRawNetworkTime() {
    String resp = sendAT("AT+CCLK?", 2000);
    int idx = resp.indexOf("\"");
    if (idx != -1) {
        return resp.substring(idx + 1, resp.lastIndexOf("\""));
    }
    return "UNKNOWN";
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

void postData(String url, String payload) {
    blink(5, 50);
    
    for(int attempt=0; attempt<2; attempt++) { // RETRY LOOP
        sendAT("AT+HTTPTERM", 500); delay(100);
    sendAT("AT+HTTPINIT", 2000);
    sendAT("AT+HTTPPARA=\"CID\",1", 2000);
        sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", 2000);
    sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 2000);
    
    String cmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
        
        // Clear buffer VERY aggressively
        while(gsmSerial.available()) gsmSerial.read(); 
        delay(100); // Settle line
        
        gsmSerial.println(cmd);
        Serial.println("CMD: " + cmd);
        
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
        Serial.println("RESP: " + accumulatedResponse);

        if (readyToUpload) {
            gsmSerial.print(payload);
            Serial.println("\n[PAYLOAD SENT]");
            delay(500); 
            String resp = sendAT("AT+HTTPACTION=1", 30000); 
        if (resp.indexOf(",200") != -1 || resp.indexOf(",201") != -1) {
                digitalWrite(LED_PIN, HIGH); delay(10000); digitalWrite(LED_PIN, LOW);
                Serial.println("UPLOAD SUCCESS");
                return; // Success! Exit function
            } else {
                Serial.println("UPLOAD FAILED: " + resp);
            }
        } else {
            Serial.println("HTTPDATA ERROR: No DOWNLOAD prompt");
        }
        
        // If we are here, it failed. Wait before retry.
        Serial.println("Retry attempt " + String(attempt+1));
    sendAT("AT+HTTPTERM", 2000);
        delay(2000);
}

    // If loop finishes, we failed twice.
    digitalWrite(LED_PIN, HIGH); delay(2000); digitalWrite(LED_PIN, LOW);
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
    Serial.println("=== BIKE GPS: GSM TEST (NO GPS) ===");

    pinMode(MOSFET_GATE, OUTPUT);
    digitalWrite(MOSFET_GATE, HIGH);
    
    Serial.println("Waiting 20s for GSM init...");
    delay(20000); 
    digitalWrite(LED_PIN, LOW);

    gsmSerial.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
    // gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN); // DISABLED
    
    Serial.println("Connecting GPRS...");
    int retry = 0;
    while(!initGPRS()) {
        retry++;
        Serial.println("GPRS Retry " + String(retry));
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
    // 1. Collect System Data
    int bat_mv = getBatteryMV();
    int csq = getCSQ();
    unsigned long unixTime = getNetworkTime(); // Get real unix timestamp
    String netTimeStr = getRawNetworkTime();   // For debug

    // 2. Send DEVICE DEBUG Dump
    String debugPayload = "{";
    debugPayload += "\"gsm\":{\"csq\":" + String(csq) + ",\"net_time\":\"" + netTimeStr + "\"},";
    debugPayload += "\"battery\":{\"voltage_mv\":" + String(bat_mv) + "}";
    debugPayload += "}";
    
    Serial.println("Sending Debug: " + debugPayload);
    postData(DEBUG_API_URL, debugPayload);
    delay(2000);
    
    // 3. Send Location (Dummy with REAL timestamp)
    String locPayload = "{";
    locPayload += "\"latitude\":51.5074,";
    locPayload += "\"longitude\":-0.1278,";
    locPayload += "\"timestamp\":" + String(unixTime) + ","; 
    locPayload += "\"battery_mv\":" + String(bat_mv);
    locPayload += "}";
    
    Serial.println("Sending Loc: " + locPayload);
    postData(LOCATION_API_URL, locPayload);
    
    Serial.println("Sleeping...");
    delay(30000);
}
