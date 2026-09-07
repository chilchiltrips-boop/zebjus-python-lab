# v6.2 Offline Simulation + Sensor Studio Regression Test

1. Disconnect the kit and run an RGB/servo/motor `while True` example. Python must continue and the matching Kit Output / Sensors animation must move.
2. Reconnect the saved kit while the live program is still running. The physical kit should begin receiving subsequent commands without restarting Python.
3. Run GPS and MPU6050 examples. GPS should show fix/satellites/coordinates; MPU6050 should show the orientation card.
4. Run a custom `dashboard("Test", Value=123)` call. A custom card should appear.
5. Run OLED + MPU6050 on I²C bus 0 with SDA21/SCL22. No InterfaceConflictError should occur. Explicitly change the second device to different pins on bus 0; a conflict should occur.
6. Start/stop an OpenCV live example repeatedly. `_close_cv_windows` NameError must not occur.
7. Reload the page/worker. Python initialization must not report an unterminated string literal.
8. In Settings, enable Secure Mode with a generated token. Kit control should work in that browser. Requests without the token should be rejected while Setup AP/recovery remains available.
