# ZEBJUS Python Lab v6.4.4 Connection Stability Test

1. Connect a kit and run a continuous TM1637/LCD clock project.
2. Confirm the UI remains **Kit connected** through isolated local HTTP misses; it must not blink `KIT ↔ SIMULATION`.
3. `kit-client.refresh()` must retain cached base/status on a transient timeout.
4. Only the 5th consecutive health/heartbeat failure may hard-disconnect the client and enter Simulation.
5. Reconnect success must reset the failure counter and resume the latest pending display frame automatically.
6. A transient display send failure must pause the physical queue without dropping its latest state.
7. Firmware remains v2.4.0; active hardware commands and `/api/run/ping` refresh the ESP run heartbeat.
