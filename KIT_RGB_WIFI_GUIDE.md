# ZEBJUS Python Lab v5.15 — ESP32 Kit + RGB LED Guide

## 1. Firmware

Upload:

`esp32_firmware/ZEBJUS_Kit_RGB_WiFi_v1.ino`

Target: classic ESP32 DevKit / ESP32-WROOM-32 / ESP32-WROOM-DA.

Recommended Arduino-ESP32 core: 3.x.

## 2. First Wi-Fi setup

If no saved Wi-Fi works, the ESP32 creates:

`ZEBJUS-SETUP-<6-digit Kit ID>`

Password:

`zebjus123`

Open `http://192.168.4.1`, choose Wi-Fi, enter the password, and save.

After connecting to the router, the kit queries other ZEBJUS kits on the same LAN and chooses the first free name:

- `zebjus_kit_1`
- `zebjus_kit_2`
- `zebjus_kit_3`
- ...

The matching local host is, for example:

`http://zebjus-kit-1.local`

## 3. RGB LED wiring

Default common-cathode wiring:

- Red channel -> 220–330 ohm resistor -> GPIO25
- Green channel -> 220–330 ohm resistor -> GPIO26
- Blue channel -> 220–330 ohm resistor -> GPIO27
- Common cathode -> GND

Do not connect LED channels without current-limiting resistors.

Student-safe RGB output pins in this firmware:

`4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33`

GPIO34–39 are input-only on classic ESP32 and are intentionally rejected for RGB output.

## 4. Python RGB code

Direct physical pins:

```python
from zebjus import RGBLED, sleep

rgb = RGBLED(25, 26, 27)
rgb.color("red")
sleep(1)
rgb.color("green")
sleep(1)
rgb.color("blue")
sleep(1)
rgb.write(255, 120, 0)
sleep(1)
rgb.off()
```

Named-pin form:

```python
rgb = RGBLED(red=25, green=26, blue=27)
rgb.color("purple")
```

Common-anode LED:

```python
rgb = RGBLED(25, 26, 27, common_anode=True)
rgb.color("cyan")
```

Old projects remain compatible:

```python
rgb = RGBLED(1)
rgb.write(255, 0, 0)
```

In physical mode, `RGBLED(1)` uses the firmware default pins 25/26/27.

## 5. Web software connection

Open `Settings -> Kit Connection`.

1. Turn Demo mode OFF.
2. Click `Scan Default Kits` or enter a known kit name.
3. Choose `zebjus_kit_N` from the list.
4. Click `Connect Kit`.
5. The card should show name, IP, Wi-Fi, signal, Kit ID, and RGB pins.
6. Return to the Lab and Run the Python RGB example.

The Lab remembers the selected kit name and last IP in browser local storage.

## 6. Rename a kit

In `Settings -> Kit Connection -> Change unique kit name`:

1. Enter a name such as `class_a_kit_3`.
2. Click `Check & Save Name`.
3. The ESP32 queries ZEBJUS kits on the current Wi-Fi.
4. If another kit already has the name, the page shows:

`Another person is using this name on this Wi-Fi network.`

5. If free, the name is stored and the kit restarts.

Allowed name characters: lowercase letters, numbers, `_`, `-`. The web page normalizes spaces to `_`.

## 7. Reset name

`Reset Auto Name` clears the custom name. After reboot the ESP32 selects the next free `zebjus_kit_N` name.

## 8. Change Wi-Fi from the web software

While the kit is connected:

1. Click `Scan Wi-Fi`.
2. Select the new SSID.
3. Enter its password.
4. Click `Save & Connect to This Wi-Fi`.
5. The new network is stored as preferred and the ESP32 restarts.
6. Move the laptop/phone to the same new Wi-Fi if required, then connect to the kit again by name.

Up to five Wi-Fi profiles are retained. If the preferred network is unavailable the firmware tries other saved networks. If none are reachable it opens its Setup AP automatically.

## 9. Forget all Wi-Fi

`Forget All Wi-Fi` clears all saved Wi-Fi profiles and restarts the kit in Setup AP mode.

## 10. Browser note

The Lab is an HTTPS web app while the ESP32 serves local HTTP. A modern browser can request local-network permission. Allow local-network access when prompted. If a Wix iframe blocks local access, test the GitHub Pages app directly first.
