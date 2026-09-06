# v5.23 DHT11 + Serial Plotter + Layout Test

## Firmware

1. Install Adafruit SSD1306, Adafruit GFX and Adafruit BusIO.
2. Upload `esp32_firmware/ZEBJUS_Kit_RGB_Input_OLED_Ultrasonic_DHT11_WiFi_v1_6.ino`.
3. DHT11: VCC 3.3V, GND GND, DATA GPIO13.
4. Current ultrasonic setup is supported as TRIG GPIO14 / ECHO GPIO12. Keep the HC-SR04 ECHO voltage divider/level shifter.

## DHT11 test

Load **DHT11 Temperature + Humidity** and Run. The Terminal and DHT11 sensor card should update approximately once per second.

## Plotter test

Load **DHT11 Live Serial Plotter**. The Serial Plotter below the OpenCV output should show Temperature and Humidity traces. Press **Clear Plot** to reset it.

## Legacy compatibility

`DHT11.get_values()` returns scaled values. Example: 65.3% and 28.7°C are returned as `[653, 287]`, so old `/10.0` code remains valid.

## Layout order

Editor → Kit Output/Sensors → Camera/MediaPipe → Terminal → OpenCV/imshow → Serial Plotter → Image Upload.
