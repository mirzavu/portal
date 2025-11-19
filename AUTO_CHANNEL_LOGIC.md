# Auto-Channel Discovery Logic (ESP-NOW)

This document explains how to implement a "Self-Healing" or "Plug-and-Play" communication channel mechanism for ESP-NOW devices (like the Door Knock sensor).

## The Problem
ESP-NOW requires both the Sender (Door Knock) and Receiver (Gateway) to be on the **same Wi-Fi Channel**.
- If the Gateway connects to a router, the router dictates the channel (e.g., 1, 6, 11).
- If the router changes the channel (auto-optimization), the hardcoded Door Knock sensor stops working.

## The Solution: Auto-Discovery
Instead of hardcoding the channel, the Sender can "find" the Gateway and store the correct channel permanently.

### Logic Flow

1.  **Wake Up**: The Sender wakes up (e.g., from a knock).
2.  **Load Config**: Read the last known channel from **EEPROM** (flash memory).
3.  **Optimistic Try**: Attempt to send the message on the saved channel.
    *   *If ACK received (Success)*: Great! Go back to sleep.
    *   *If No ACK (Fail)*: The Gateway has moved. Start **Discovery Mode**.
4.  **Discovery Mode**:
    *   Loop through Channels 1 to 13.
    *   For each channel:
        *   Set WiFi Channel.
        *   Send a "Ping" packet.
        *   Wait 10-50ms for an ACK.
    *   *If ACK received*:
        *   **Found it!**
        *   Save this new channel to **EEPROM**.
        *   Send the actual data.
        *   Break the loop.
5.  **Sleep**: Go to Deep Sleep.

## Implementation Guide (Pseudo-Code)

### 1. Memory Storage (EEPROM)
Use the `EEPROM` library to store the channel byte.

```cpp
#include <EEPROM.h>

// Address 0 in EEPROM will store the channel (1 byte)
const int EEPROM_ADDR_CHANNEL = 0;

void setupEEPROM() {
  EEPROM.begin(512);
}

uint8_t loadChannel() {
  uint8_t ch = EEPROM.read(EEPROM_ADDR_CHANNEL);
  if (ch < 1 || ch > 13) return 11; // Default default
  return ch;
}

void saveChannel(uint8_t ch) {
  EEPROM.write(EEPROM_ADDR_CHANNEL, ch);
  EEPROM.commit(); // Important!
}
```

### 2. The Scanning Function
This function tries to find the gateway if the initial send fails.

```cpp
bool findAndSend(uint8_t *data, size_t len) {
  for (int ch = 1; ch <= 13; ch++) {
    wifi_set_channel(ch); 
    // Send data...
    // Check ACK...
    if (sendSuccess) {
      saveChannel(ch); // Found it! Save for next time.
      return true;
    }
    delay(10);
  }
  return false;
}
```

### 3. Main Loop Integration
Integration into the main `setup()` logic.

```cpp
void setup() {
  // ... init ...
  setupEEPROM();
  uint8_t currentChannel = loadChannel();

  // Try saved channel
  wifi_set_channel(currentChannel);
  if (!sendData()) {
    // Failed? Scan for it.
    Serial.println("Gateway lost. Scanning...");
    findAndSend(data, len);
  }
  // ... sleep ...
}
```

## Benefits
*   **Robustness**: The system fixes itself if the router changes channels.
*   **Maintenance Free**: No need to reprogram devices when network variables change.
*   **Battery Efficient**: It only scans when necessary. 99% of the time it hits the cached channel instantly.

