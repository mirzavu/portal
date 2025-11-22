#include <Arduino.h>
#include <TinyGPSPlus.h>

// ==========================================
//       USER CONFIGURATION
// ==========================================
const char* APN = "internet";                  
const char* API_URL = "http://portal.demotesting.co.uk/api/bike-location";
const char* DEBUG_API_URL = "http://portal.demotesting.co.uk/api/device-debug";
const unsigned long UPLOAD_INTERVAL = 10000;
const unsigned long SERIAL_LOG_UPLOAD_INTERVAL = 50000; // Upload serial logs every 50 seconds  

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

String sendAT(String cmd, unsigned long timeout, bool debug = false) {
    while(gsmSerial.available()) gsmSerial.read(); 
    gsmSerial.println(cmd);
    if(debug) { logPrint("CMD: "); logPrintln(cmd); }
    
    String resp = "";
    unsigned long start = millis();
    while (millis() - start < timeout) {
        while (gsmSerial.available()) {
            char c = gsmSerial.read();
            resp += c;
        }
    }
    if(debug) { logPrint("RESP: "); logPrintln(resp); }
    return resp;
}

void checkSignal() {
    markStep();
    String resp = sendAT("AT+CSQ", 2000);
    if (resp.indexOf("+CSQ:") != -1) {
        logPrint("[SIGNAL] "); logPrintln(resp.substring(resp.indexOf("+CSQ:")));
    }
    logStep("Signal Check");
}

// NEW: Super Nuclear Reset (Flight Mode Toggle)
void forceNetworkReset() {
    logPrintln("[GSM] ⚠️ Performing NETWORK RESET (Flight Mode Toggle)...");
    sendAT("AT+CFUN=0", 5000); // Flight Mode ON (Radio OFF)
    delay(2000);
    sendAT("AT+CFUN=1", 5000); // Flight Mode OFF (Radio ON)
    delay(5000); // Wait for network search
    
    // Wait for registration
    int retries = 0;
    while(retries < 20) {
        String creg = sendAT("AT+CREG?", 1000);
        if(creg.indexOf(",1") != -1 || creg.indexOf(",5") != -1) {
            logPrintln("[GSM] Re-registered to Network!");
            return;
        }
        logPrint(".");
        delay(1000);
        retries++;
    }
    logPrintln("[GSM] Warning: Registration timed out.");
}

bool initGPRS() {
    markStep();
    logPrintln("[GPRS] Resetting IP Stack...");
    sendAT("AT+CIPSHUT", 2000); 
    sendAT("AT+SAPBR=0,1", 2000); 
    logStep("IP Stack Reset");

    logPrintln("[GPRS] Configuring...");
    sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000);
    sendAT("AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"", 1000);
    sendAT("AT+CDNSCFG=\"8.8.8.8\",\"8.8.4.4\"", 1000); 
    logStep("APN Config");
    
    logPrintln("[GPRS] Opening bearer...");
    if(sendAT("AT+SAPBR=1,1", 15000).indexOf("OK") == -1) { 
        logStep("Open Bearer (FAILED)");
        logPrintln("[GPRS] ❌ Bearer Open Failed");
        forceNetworkReset();
        return false;
    }
    logStep("Open Bearer (SUCCESS)");
    
    String resp = sendAT("AT+SAPBR=2,1", 2000);
    if (resp.indexOf("\"0.0.0.0\"") == -1 && resp.indexOf("\"") != -1) {
        logPrintln("[GPRS] ✅ Connected! IP Obtained.");
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
    unsigned long cycleStart = millis();
    logPrintln("\n=== UPLOAD START ===");
    
    checkSignal();

    // Check GPRS status
    markStep();
    if (sendAT("AT+SAPBR=2,1", 2000).indexOf("\"0.0.0.0\"") != -1) {
        logStep("Check IP (Failed - Reconnecting)");
        logPrintln("[UPLOAD] GPRS dropped. Reconnecting...");
        if(!initGPRS()) return;
    } else {
        logStep("Check IP (Success - Reuse)");
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
    
    logPrintln("Payload: " + payload);

    // Clean HTTP session
    markStep();
    sendAT("AT+HTTPTERM", 1000); 
    delay(100);
    
    if (sendAT("AT+HTTPINIT", 2000).indexOf("OK") == -1) {
        logPrintln("HTTPINIT Failed - trying Hard Recover");
        sendAT("AT+CIPSHUT", 1000); // Soft reset IP
        return;
    }
    logStep("HTTP Init");
    
    markStep();
    sendAT("AT+HTTPPARA=\"CID\",1", 2000);
    sendAT("AT+HTTPPARA=\"URL\",\"" + String(API_URL) + "\"", 2000);
    sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 2000);
    logStep("HTTP Params");
    
    String cmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
    if (sendAT(cmd, 3000).indexOf("DOWNLOAD") != -1) {
        sendAT(payload, 3000);
        
        logPrintln("[UPLOAD] POSTing...");
        markStep();
        // Increased timeout for poor BSNL 2G
        String resp = sendAT("AT+HTTPACTION=1", 40000, true); 
        logStep("Server Wait (HTTPACTION)");
        
        if (resp.indexOf(",200") != -1 || resp.indexOf(",201") != -1) {
            logPrintln("✅ SUCCESS!");
        } else {
             logPrint("❌ FAIL. Full Resp: "); logPrintln(resp);
             // If DNS error (601), force a network reset next time
             if(resp.indexOf("601") != -1) {
                 logPrintln("[UPLOAD] DNS Error detected. Scheduling Network Reset.");
                 sendAT("AT+SAPBR=0,1", 1000);
             }
        }
    }
    sendAT("AT+HTTPTERM", 2000);
    
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
    
    // Check GPRS status
    markStep();
    if (sendAT("AT+SAPBR=2,1", 2000).indexOf("\"0.0.0.0\"") != -1) {
        logStep("Check IP (Failed - Reconnecting)");
        logPrintln("[SERIAL_LOG] GPRS dropped. Reconnecting...");
        if(!initGPRS()) return;
    } else {
        logStep("Check IP (Success - Reuse)");
    }

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

    // Clean HTTP session
    markStep();
    sendAT("AT+HTTPTERM", 1000); 
    delay(100);
    
    if (sendAT("AT+HTTPINIT", 2000).indexOf("OK") == -1) {
        logPrintln("HTTPINIT Failed - trying Hard Recover");
        sendAT("AT+CIPSHUT", 1000);
        return;
    }
    logStep("HTTP Init");
    
    markStep();
    sendAT("AT+HTTPPARA=\"CID\",1", 2000);
    sendAT("AT+HTTPPARA=\"URL\",\"" + String(DEBUG_API_URL) + "\"", 2000);
    sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 2000);
    logStep("HTTP Params");
    
    String cmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
    if (sendAT(cmd, 3000).indexOf("DOWNLOAD") != -1) {
        sendAT(payload, 3000);
        
        logPrintln("[SERIAL_LOG] POSTing...");
        markStep();
        String resp = sendAT("AT+HTTPACTION=1", 40000, true); 
        logStep("Server Wait (HTTPACTION)");
        
        if (resp.indexOf(",200") != -1 || resp.indexOf(",201") != -1) {
            logPrintln("✅ SERIAL LOG UPLOAD SUCCESS!");
            // Clear buffer after successful upload (keep last 1KB for continuity)
            if (serialBuffer.length() > 1024) {
                serialBuffer = serialBuffer.substring(serialBuffer.length() - 1024);
            } else {
                serialBuffer = "";
            }
        } else {
             logPrint("❌ SERIAL LOG UPLOAD FAIL. Full Resp: "); logPrintln(resp);
        }
    }
    sendAT("AT+HTTPTERM", 2000);
    
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
    logPrintln("=== GPS TRACKER TIMED (OPTIMIZED) ===");

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
        logPrintln("Waiting for GSM...");
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