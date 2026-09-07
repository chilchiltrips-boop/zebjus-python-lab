# ZEBJUS Python Lab v6.4.5 Debug Trace Test

1. Load **Clock + Connection Stability Test** and run for several minutes.
2. TM1637/LCD card mode must remain `KIT` while connected. It must not flash `SYNCING` for each command.
3. A transient local request miss (1-4 consecutive failures) must not change the card to Simulation.
4. Click **🐞 Copy Debug** while any issue is visible.
5. Paste the copied JSON into ChatGPT. It includes ISO timestamps, HTTP/heartbeat latency, failure count, display queues, terminal tail and current main.py.
6. Secure token/password values are intentionally not included.
