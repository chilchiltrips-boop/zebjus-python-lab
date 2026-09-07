# v6.2.1 Real Sensor Sync Regression Test

1. Connect `zebjus_kit_1`, keep **Demo mode OFF**, flash firmware 2.2.1.
2. Run `DHT11(13)` with DATA physically disconnected. Expected: `READ ERROR`/no fake 28 °C, 65 %RH.
3. Connect DHT11 DATA to GPIO13 with common GND and pull-up. Expected: terminal and DHT card show the same changing real values.
4. Move DHT11 DATA to a different GPIO and update code. Expected: only that GPIO is read; wrong/unwired pin does not keep showing a valid-looking fixed sample.
5. Run `Ultrasonic(18,19)` with ECHO disconnected. Expected: `READ ERROR`, not a fixed 400 cm value.
6. Connect HC-SR04 correctly with ECHO level shifting and move a target. Expected: terminal and animation change together.
7. Test AnalogInput/Potentiometer, Switch/DigitalInput, RotaryEncoder. Expected: real hardware state when connected.
8. Test ADC sensor aliases (LDR/soil/gas/voltage/sound/rain/water/thermistor), PIR/reed/touch/flame, joystick, flow/RPM/pulse. Expected: first live cycle is prefetched when possible and one failing sensor does not freeze the rest.
9. Disconnect kit and run the same programs. Expected: program continues with cards marked `SIM`/`SIMULATION`; output animations still run.
10. Reconnect kit while program is running. Expected: simulated snapshots clear and real hardware values take over without restarting the Python program.
11. GPS/MPU6050 offline: animated cards explicitly show SIM. Online MPU6050 with no/short I²C response: no valid zero-padded IMU sample.
12. Servo/Motor: `PWMServo` and `MotorDriver` animate and mirror to physical GPIO/PWM when connected; legacy `Servo`/`Motor` remain simulator/WebSocket compatibility APIs.
