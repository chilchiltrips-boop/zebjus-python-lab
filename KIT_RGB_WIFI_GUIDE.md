# ZEBJUS Kit v1.2 — Wi-Fi, RGB and Potentiometer

## Kit identity
Each ESP32 has a permanent chip ID, for example `D6CDC0`, and a network-unique user name such as `zebjus_kit_1`.

## Wi-Fi profiles
Up to five SSID/password profiles are stored in the ESP32 NVS. Passwords are not returned to the browser. A preferred saved network can be selected from Settings.

## Reconnect
The browser stores kit name, last IP and chip ID. Before Run it verifies the kit. Temporary resets/power interruptions trigger retry/reconnect instead of immediately requiring a manual power cycle or Settings reconnect.

## RGB
Default output pins: R=25, G=26, B=27.

## Potentiometer
Recommended input: GPIO34. Supported ADC1 inputs: 32,33,34,35,36,39.

API used by the Lab:

`GET /api/analog?pin=34`

The response contains raw 12-bit ADC, 0–255 scaled value, percentage and millivolts.
