# ZEBJUS Python Lab v6.4.3 Runtime Bootstrap Test

This release specifically guards two startup/recovery failures:

1. JavaScript template-literal escaping is decoded before generated Python is compiled. This catches the LCD1602 spinner backslash default before release.
2. `runtimeReady` becomes true only after the full Pyodide bootstrap completes. Failed bootstrap attempts clear `readyPromise`, and the run-session prepared flag is set only after `_zebjus_reset_student_namespace()` succeeds.

Run:

```bash
python VERIFY_RELEASE.py
```

Expected: `ZEBJUS v6.4.3 release verification PASS`.
