#include <Arduino.h>
#include "soc/soc.h"             // Required for brownout fix
#include "soc/rtc_cntl_reg.h"    // Required for brownout fix

// ==========================================
//       USER CONFIGURATION
// ==========================================
const char* APN = "giffgaff.com"; // Changing to giffgaff to test specific APN
const char* LOCATION_API_URL = "http://portal.demotesting.co.uk/api/bike-location";
const char* DEBUG_API_URL = "http://portal.demotesting.co.uk/api/device-debug";

// ==========================================
//       PIN DEFINITIONS
// ==========================================
#define MOSFET_GATE 27
#define GSM_RX_PIN 25       
#define GSM_TX_PIN 26       
#define BATTERY_PIN 35
#define LED_PIN 2           // Onboard LED for status

const float VOLTAGE_DIVIDER_RATIO = 4.3; 
const float ADC_REF_VOLTAGE = 3.3;
const int ADC_RESOLUTION = 4095;

HardwareSerial gsmSerial(1);

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
    // S O S pattern
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
    while(gsmSerial.available()) gsmSerial.read(); // Clear buffer
    gsmSerial.println(cmd);
    
    // Echo to USB Serial for debugging if connected, but rely on LED mainly
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
    // Blink slow while initializing
    blink(1, 500);
    
    sendAT("AT+CIPSHUT", 2000); 
    sendAT("AT+SAPBR=0,1", 2000); 
    sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000);
    sendAT("AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"", 1000);
    
    // Try to open bearer
    String resp = sendAT("AT+SAPBR=1,1", 10000);
    if(resp.indexOf("OK") == -1 && resp.indexOf("ERROR") == -1) {
        // Sometimes it times out but works, check status
    }
    
    // Verify IP
    if (sendAT("AT+SAPBR=2,1", 2000).indexOf("\"0.0.0.0\"") != -1) {
        return false;
    }
    return true;
}

int getBatteryMV() {
    long sum = 0;
    for(int i = 0; i < 10; i++) { sum += analogRead(BATTERY_PIN); delay(2); }
    float avg = sum / 10.0;
    return (int)((avg / ADC_RESOLUTION) * ADC_REF_VOLTAGE * VOLTAGE_DIVIDER_RATIO * 1000);
}

int getCSQ() {
    String resp = sendAT("AT+CSQ", 2000);
    // Parse +CSQ: 20,0
    int idx = resp.indexOf("+CSQ: ");
    if (idx != -1) {
        String val = resp.substring(idx + 6);
        int comma = val.indexOf(",");
        if (comma != -1) {
            return val.substring(0, comma).toInt();
        }
    }
    return 0;
}

void postData(String url, String payload) {
    // Fast blink indicating transmission start
    blink(5, 50);
    
    // Ensure clean state
    sendAT("AT+HTTPTERM", 500); delay(100);
    
    sendAT("AT+HTTPINIT", 2000);
    sendAT("AT+HTTPPARA=\"CID\",1", 2000);
    sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", 2000);
    sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 2000);
    
    // Prepare for data
    String cmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
    
    // Send command and wait specifically for DOWNLOAD
    while(gsmSerial.available()) gsmSerial.read(); // Clear buffer
    gsmSerial.println(cmd);
    Serial.println("CMD: " + cmd);
    
    bool readyToUpload = false;
    unsigned long start = millis();
    String accumulatedResponse = "";
    while(millis() - start < 10000) { // Increased to 10s wait for DOWNLOAD
        if(gsmSerial.available()) {
            char c = gsmSerial.read();
            accumulatedResponse += c;
            if(accumulatedResponse.indexOf("DOWNLOAD") != -1) {
                readyToUpload = true;
                break;
            }
        }
    }
    Serial.println("RESP: " + accumulatedResponse); // See what it actually said

    if (readyToUpload) {
        // Send the actual JSON payload
        gsmSerial.print(payload);
        Serial.println("\n[PAYLOAD SENT]");
        
        // Wait for OK after payload
        delay(500); 
        
        // Action 1 = POST
        String resp = sendAT("AT+HTTPACTION=1", 30000); // Increase timeout for GPRS
        
        // Check for 200 or 201 status code
        if (resp.indexOf(",200") != -1 || resp.indexOf(",201") != -1) {
            // SUCCESS: Solid ON for 10 seconds
            digitalWrite(LED_PIN, HIGH);
            delay(10000); 
            digitalWrite(LED_PIN, LOW);
            Serial.println("UPLOAD SUCCESS");
        } else {
            // FAIL: Long blink
            digitalWrite(LED_PIN, HIGH); delay(2000); digitalWrite(LED_PIN, LOW);
            Serial.println("UPLOAD FAILED: " + resp);
        }
    } else {
        Serial.println("HTTPDATA ERROR: No DOWNLOAD prompt");
        // Force terminate to reset state
        sendAT("AT+HTTPTERM", 2000);
    }
}

// ==========================================
//       MAIN SETUP
// ==========================================
void setup() {
    // 1. DISABLE BROWNOUT
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 
    
    // 2. INIT LED
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, HIGH); // SOLID ON during power up
    
    Serial.begin(115200);
    delay(1000);
    Serial.println("=== GSM ISOLATION TEST ===");

    // 3. POWER UP GSM
    pinMode(MOSFET_GATE, OUTPUT);
    digitalWrite(MOSFET_GATE, HIGH);
    
    // Wait 20 seconds for SIM800L to stabilize and find network
    Serial.println("Waiting 20s for GSM init...");
    delay(20000); // Wait 20s with LED SOLID ON
    digitalWrite(LED_PIN, LOW);

    // 4. GSM SERIAL
    gsmSerial.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
    
    // 5. CONNECT GPRS
    Serial.println("Connecting GPRS...");
    int retry = 0;
    while(!initGPRS()) {
        retry++;
        Serial.println("GPRS Retry " + String(retry));
        signalSOS(); // Blink SOS if GPRS fails
        delay(5000);
        if(retry > 5) ESP.restart();
    }
    
    // Connected!
    blink(5, 100); // 5 fast blinks = Connected
}

// ==========================================
//       MAIN LOOP
// ==========================================
void loop() {
    // Collect Data
    int bat_mv = getBatteryMV();
    int csq = getCSQ();
    
    // 1. Send Device Debug Info
    String debugPayload = "{";
    debugPayload += "\"gsm\":{\"csq\":" + String(csq) + "},";
    debugPayload += "\"battery\":{\"voltage_mv\":" + String(bat_mv) + "}";
    debugPayload += "}";
    
    Serial.println("Sending Debug: " + debugPayload);
    postData(DEBUG_API_URL, debugPayload);
    delay(2000);
    
    // 2. Send Dummy Bike Location
    // Hardcoded dummy location (London) and dummy timestamp (Nov 22 2025)
    String locPayload = "{";
    locPayload += "\"latitude\":51.5074,";
    locPayload += "\"longitude\":-0.1278,";
    locPayload += "\"timestamp\":1763810000,"; 
    locPayload += "\"battery_mv\":" + String(bat_mv);
    locPayload += "}";
    
    Serial.println("Sending Loc: " + locPayload);
    postData(LOCATION_API_URL, locPayload);
    
    // Wait 30 seconds before next loop
    Serial.println("Sleeping...");
    delay(30000);
}
