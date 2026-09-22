# GitHub Upload — ZEBJUS Python Lab v6.8.0

GitHub’s browser uploader asks for fewer than 100 files at a time. The companion upload package is therefore split into safe batches:

1. Open `01_UPLOAD_FIRST_99_FILES` and upload its **99 contents** to the repository root.
2. Open `02_UPLOAD_REMAINING_ROOT_FILES` and upload all of its contents to the same repository root.
3. Create/open the repository folder `esp32_firmware`, then upload the one file from `03_UPLOAD_FIRMWARE/esp32_firmware` there.

Do not upload the numbered wrapper folders themselves. Select their contents so the website files remain at repository root.

After upload, `index.html`, `circuit.html`, `schematic.html`, all JS/CSS/SVG/docs/tests should be at root. The only project subfolder should be `esp32_firmware/`.

The full release contains 164 root-level files plus one firmware file. The first batch uses 99, safely below the uploader limit.
