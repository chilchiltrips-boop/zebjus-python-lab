# GitHub Upload — v6.7.0

Upload the contents of the final folder directly to the GitHub Pages repository root.

If GitHub reports **“Try uploading fewer than 100 at a time”**, use the supplied upload-batch ZIP. Upload every file from `01_UPLOAD_FIRST` first, then every file from `02_UPLOAD_NEXT`, always targeting the same repository root. The two folders are upload batches only; do not upload the batch-folder names themselves.

## Folder rule
- Website HTML/JS/CSS/SVG/docs/tests: **root level**
- Only subfolder: `esp32_firmware/`
- `esp32_firmware/` contains only `ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_5_0.ino`

Do not create `assets/`, `tools/`, or nested website folders. Component preview SVGs are root-level so GitHub Pages path resolution is simple and reliable.

After upload, open `index.html`; use the top **Circuit Design** tab for 2D wiring and **Firmware** for update/recovery.
