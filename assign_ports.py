#!/usr/bin/env python3
"""
Detect serial ports and update platformio.ini files using MAC address mapping.

Logic:
- Run `pio device list` to find serial ports
- Connect to each ESP32/ESP8266 device and read MAC address
- Map MAC addresses to project roles:
  - Gateway Hub (ESP32)
  - Door Knock (ESP8266)
  - Bike GPS (ESP32)
- Update upload_port and monitor_port in each project's platformio.ini
"""
import os
import re
import subprocess
import sys
from typing import Dict, Optional, List

# Absolute paths per user's environment
PROJECT_ROOT = "/home/mirza/Documents/PlatformIO/Projects"
PIO_BIN = "/home/mirza/.platformio/penv/bin/pio"
ESPTOOL_PATH = "/home/mirza/.platformio/packages/tool-esptoolpy@1.40500.0/esptool.py"

GATEWAY_INI = os.path.join(PROJECT_ROOT, "Gateway Hub", "platformio.ini")
DOOR_INI = os.path.join(PROJECT_ROOT, "Door knock", "platformio.ini")
BIKE_INI = os.path.join(PROJECT_ROOT, "Bike GPS", "platformio.ini")

# MAC address to project mapping (edit as needed)
# Format: "XX:XX:XX:XX:XX:XX" -> "PROJECT_NAME"
MAC_TO_PROJECT = {
    "00:4B:12:23:2A:54": "GATEWAY",  # Gateway Hub device
    "38:18:2B:8C:09:10": "BIKE",     # Bike GPS device
    "48:3F:DA:8B:22:CD": "DOOR",     # Door Knock device
}

# Regex to extract blocks from `pio device list`
BLOCK_SPLIT_RE = re.compile(r"\n(?=/dev/tty)")
PORT_RE = re.compile(r"^(/dev/tty(?:USB|ACM)\d+)\s*$", re.MULTILINE)


def run_pio_device_list() -> str:
    try:
        out = subprocess.check_output([PIO_BIN, "device", "list"], text=True)
        return out
    except Exception as exc:
        print(f"Error: failed to run '{PIO_BIN} device list': {exc}", file=sys.stderr)
        sys.exit(1)


def parse_ports(pio_output: str) -> List[str]:
    """
    Extract serial port paths from `pio device list` output.
    Returns list of port paths (e.g., ['/dev/ttyUSB0', '/dev/ttyUSB1'])
    """
    ports = []
    blocks = BLOCK_SPLIT_RE.split(pio_output.strip())
    for block in blocks:
        port_match = PORT_RE.search(block)
        if port_match:
            ports.append(port_match.group(1).strip())
    return ports


def get_mac_address(port: str) -> Optional[str]:
    """
    Connect to ESP32/ESP8266 device and extract MAC address using esptool.
    Returns MAC address in format "XX:XX:XX:XX:XX:XX" (uppercase) or None if failed.
    """
    try:
        result = subprocess.run(
            ["python3", ESPTOOL_PATH, "--port", port, "chip_id"],
            capture_output=True,
            text=True,
            timeout=5
        )
        # Parse MAC from output (format: "MAC: XX:XX:XX:XX:XX:XX")
        mac_match = re.search(
            r"MAC:\s*([0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2})",
            result.stdout + result.stderr,
            re.IGNORECASE
        )
        if mac_match:
            return mac_match.group(1).upper()
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        pass
    return None


def decide_roles(ports: List[str]) -> Dict[str, str]:
    """
    Determine which port belongs to which project using MAC address mapping.
    Returns dict: project_name -> port
    """
    result = {}
    for port in ports:
        mac = get_mac_address(port)
        if mac:
            print(f"  {port} -> MAC: {mac}")
            project = MAC_TO_PROJECT.get(mac)
            if project:
                result[project] = port
        else:
            print(f"  {port} -> Could not read MAC address (may not be ESP32/ESP8266)")
    return result


def replace_ini_ports(ini_path: str, new_port: str) -> None:
    """
    Replace upload_port and monitor_port lines with the given port.
    If not present, append them under the environment section.
    """
    if not os.path.isfile(ini_path):
        print(f"Warning: ini file not found: {ini_path}", file=sys.stderr)
        return

    with open(ini_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace if lines exist
    new_content = re.sub(r"(?m)^(upload_port\s*=\s*).*$", rf"\1{new_port}", content)
    new_content = re.sub(r"(?m)^(monitor_port\s*=\s*).*$", rf"\1{new_port}", new_content)

    # If missing, insert after framework line within the first env section
    if "upload_port" not in new_content:
        new_content = re.sub(r"(?m)^(framework\s*=\s*.+)$", rf"\1\nupload_port = {new_port}", new_content, count=1)
    if "monitor_port" not in new_content:
        new_content = re.sub(r"(?m)^(framework\s*=\s*.+)$", rf"\1\nmonitor_port = {new_port}", new_content, count=1)

    if new_content != content:
        with open(ini_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated ports in: {ini_path} -> {new_port}")
    else:
        print(f"No changes needed: {ini_path}")


def main() -> None:
    pio_out = run_pio_device_list()
    ports = parse_ports(pio_out)

    if not ports:
        print("Error: No serial devices found.", file=sys.stderr)
        sys.exit(2)

    print("Detected devices:")
    project_to_port = decide_roles(ports)

    if not project_to_port:
        print("Error: No matching MAC addresses found in mapping.", file=sys.stderr)
        sys.exit(3)

    # Update platformio.ini files for each identified project
    if "GATEWAY" in project_to_port:
        replace_ini_ports(GATEWAY_INI, project_to_port["GATEWAY"])
    else:
        print("Warning: Gateway Hub port not identified.", file=sys.stderr)

    if "DOOR" in project_to_port:
        replace_ini_ports(DOOR_INI, project_to_port["DOOR"])
    else:
        print("Warning: Door Knock port not identified.", file=sys.stderr)

    if "BIKE" in project_to_port:
        replace_ini_ports(BIKE_INI, project_to_port["BIKE"])
    else:
        print("Warning: Bike GPS port not identified.", file=sys.stderr)

    print("Done.")


if __name__ == "__main__":
    main()


