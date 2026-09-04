# ZEBJUS Python Lab v5.16 — ESP32 Kit + RGB LED Guide

## 1. Firmware

Upload:

`esp32_firmware/ZEBJUS_Kit_RGB_WiFi_v1_1.ino`

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

while True:
    rgb.color("red")
    sleep(1)
    rgb.color("green")
    sleep(1)
    rgb.color("blue")
    sleep(1)
    rgb.write(255, 120, 0)
    sleep(1)
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


## 11. v5.16 Run-only output safety and timing sync

Physical RGB output is now controlled by a run session:

- Press **Run** -> web software starts a kit run session.
- While the program is running -> a heartbeat is sent to the ESP32 every second.
- RGB screen preview updates only after the ESP32 acknowledges the hardware command, so the software LED and real LED change together.
- Normal program finish -> RGB OFF.
- Python error -> RGB OFF.
- **End** -> RGB OFF.
- Browser/page disappears or connection breaks -> after about 3.5 seconds without heartbeat, ESP32 automatically forces RGB OFF.
- `/api/rgb` rejects ON/color commands when no run session is active.

This means a student LED should not remain ON after the program has ended.

## 12. Kit ID + Wi-Fi profiles are kept separate

Every physical ESP32 has an immutable 6-digit Kit ID from its chip MAC (for example `D6CDC0`). The browser remembers the kit name/IP/Kit ID as a device profile.

SSID/password profiles are stored in that **specific ESP32 kit's NVS**, up to five networks. Passwords are intentionally not sent back to the browser. Settings can:

- view saved SSID names,
- see which one is current/preferred,
- select a previously saved network without re-entering its password,
- forget one saved network,
- forget all networks,
- scan/add another SSID + password.

Changing or resetting the kit's unique name does not erase its saved Wi-Fi profiles. Forgetting Wi-Fi does not erase the kit name.
