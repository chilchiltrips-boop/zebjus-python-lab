# ZEBJUS Python Lab v5.4 — VISION AI Z Test Guide

## Goal
Students should type the project code themselves. The built-in VISION AI Z examples are reference/test programs for the instructor while validating the lab.

## Test order

1. **Test 01 — OpenCV Image**
   Run. `Resources/lena.png` should display in OpenCV Image output.
2. **Test 02 — OpenCV Camera**
   Allow camera. One current frame should display. The terminal should say the desktop `while True` loop was adapted to one browser cycle.
3. **Test 03 — RGB LED**
   In Demo Mode, RGB graphic should change as commands execute.
4. **Test 04 — Potentiometer**
   Set Demo Pot in Settings, run, and confirm a 0–1023 compatibility value is printed.
5. **Test 05 — Potentiometer Graphics**
   The included Potentiometer image should render with the value and arc.
6. **Project 1 — Face Detection**
   Face the camera and Run. Bounding box / face count should appear.
7. **Project 1B — Face → LED**
   With a detected face, the demo RGB LED should turn on.
8. **Project 1C — Face → RGB**
   Face detected → red; no face → green.
9. **Project 2 — Hand Gripper**
   Show thumb + index finger to camera and Run. Landmark distance maps to Servo 0–90°.
10. **Project 2B — Wi-Fi Gripper**
   Same hand test using `WifiBridge`; in compatibility mode the first sent value controls Servo 1.

## Student lesson mode
Use **Blank Student Project**. Do not load the completed project example for the learner; let the student type each line from the course lesson.

## Browser behavior
Legacy desktop `while True` loops execute one iteration per Run. This is intentional for current browser test mode and prevents the Pyodide worker from freezing. Repeated live execution should be implemented later using a cooperative browser scheduler.
