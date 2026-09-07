# GitHub upload guide — ZEBJUS Python Lab v6.3

Upload the **contents of this extracted folder** to the repository root (not the parent ZIP folder). Keep `tools/`, `esp32_firmware/`, assets, JS/HTML files and documentation.

## If `.github` is not visible on macOS
Folders beginning with a dot are hidden in Finder. Press **Command + Shift + .** to show hidden files, then upload `.github/workflows/esp32-firmware-compile.yml`.

If the GitHub web uploader does not accept the hidden folder conveniently, this package also contains:

`GITHUB_ACTIONS_WORKFLOW_VISIBLE/esp32-firmware-compile.yml`

Create `.github/workflows/esp32-firmware-compile.yml` inside GitHub and copy/upload that visible file there.

## If `tools/` is difficult to upload
`tools/` is a normal GitHub folder and is recommended, but it is **not required for the website**. Standalone root copies are included:

- `VERIFY_RELEASE.py`
- `COMPILE_ESP32_FIRMWARE.sh`

The root copies work independently; `tools/` can therefore be omitted from a simple GitHub Pages upload if necessary.

After upload, GitHub Actions automatically compiles firmware when files under `esp32_firmware/` change.
