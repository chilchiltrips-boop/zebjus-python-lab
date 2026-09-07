# v6.4.6 Device Fault Isolation

- HTTP responses, including 5xx module errors, prove the ESP32 local link is reachable.
- LCD1602 NACK/502 no longer triggers kit reconnect or repeated run/start.
- Display queues distinguish `device` faults from `transport` failures.
- Device faults use a 5-second circuit-breaker retry and keep browser preview live.
- Healthy status/heartbeat resumes only transport-paused queues, not faulty-device queues.
- TM1637 remains independent when LCD1602 is missing, miswired, or on the wrong address.
