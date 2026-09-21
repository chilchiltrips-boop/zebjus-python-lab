from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parent
result=subprocess.run(['node',str(ROOT/'TEST_CIRCUIT_UI_BROWSER.js')],cwd=ROOT)
raise SystemExit(result.returncode)
