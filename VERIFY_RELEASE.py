from pathlib import Path
from html.parser import HTMLParser
import subprocess, sys, re, json, shutil
ROOT=Path(__file__).resolve().parent

class P(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.refs=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])
        for k in ('src','href'):
            v=d.get(k,'')
            if v and not v.startswith(('http://','https://','data:','#','mailto:','javascript:')): self.refs.append(v.split('?')[0].split('#')[0])

# JS parse
js_files=list(ROOT.glob('*.js'))
for js in js_files:
    if subprocess.call(['node','--check',str(js)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL): raise SystemExit(f'JS syntax failed: {js.name}')

# HTML ids and local refs
for h in ROOT.glob('*.html'):
    p=P();p.feed(h.read_text(errors='ignore'))
    if len(p.ids)!=len(set(p.ids)): raise SystemExit(f'Duplicate HTML id: {h.name}')
    for r in p.refs:
        if r and not (ROOT/r).exists(): raise SystemExit(f'Missing local ref in {h.name}: {r}')
for h in ('index.html','settings.html','camera-bridge.html'):
    text=(ROOT/h).read_text(errors='ignore')
    if '?v=6.2.2' in text or '?v=6.1' in text or '?v=6.3.0' in text: raise SystemExit(f'Stale cache-buster remains in {h}')

# Generated Pyodide Python blocks
s=(ROOT/'py-worker.js').read_text();blocks=re.findall(r'runPythonAsync\(`([\s\S]*?)`\)',s)
if len(blocks)<7: raise SystemExit('Expected Pyodide Python blocks missing')
for i,b in enumerate(blocks,1):
    if '${' not in b: compile(b,f'<pyodide-block-{i}>','exec')

app=(ROOT/'app.js').read_text();settings=(ROOT/'settings.js').read_text();client=(ROOT/'kit-client.js').read_text();styles=(ROOT/'styles.css').read_text()
start=app.find('const examples={');end=app.find('\n  };',start);example_block=app[start:end]
examples=re.findall(r'\n\s*([A-Za-z0-9_]+):`([\s\S]*?)`(?:,|\s*$)',example_block)
if len(examples)!=40: raise SystemExit(f'Expected 40 Python examples, found {len(examples)}')
for name,code in examples: compile(code,f'<example:{name}>','exec')
for ex in ('tm1637Display','lcd1602Display'):
    if ex not in dict(examples): raise SystemExit('Missing display example: '+ex)

# Retained real-sensor / offline rules
for marker in ('demoMode:false','hasFiniteValue','clearSimulatedSensorState','Prefetch direct Universal Bridge sensor classes'):
    if marker not in app: raise SystemExit('Missing app sensor-sync marker: '+marker)
if 'demoMode:false' not in settings: raise SystemExit('Settings still default Demo Mode ON')
for forbidden in ('_sensor_state={"ultrasonic_cm":45.0','"dht_temperature":28.0,"dht_humidity":65.0'):
    if forbidden in s: raise SystemExit('Hard-coded online sensor fallback remains: '+forbidden)

# New UI/client/worker support
for marker in ('displayHardwareQueues','queueDisplayHardware','runDisplayHardwareQueue','flushDisplayHardwareQueues','isLatestDisplayVisual','__displaySeq','pending:true'):
    if marker not in app: raise SystemExit('Missing display sync/queue marker: '+marker)
for marker in ('TM1637','LCD1602','tm1637Display','lcd1602Display','paintTM1637','paintLCD1602'):
    if marker not in app: raise SystemExit('Missing app display marker: '+marker)
for marker in ('class TM1637:','class LCD1602:','TM1637_SET','LCD1602_SET'):
    if marker not in s: raise SystemExit('Missing Python display marker: '+marker)
for marker in ('async tm1637(','async lcd1602(','/api/tm1637','/api/lcd1602'):
    if marker not in client: raise SystemExit('Missing kit-client display marker: '+marker)
for marker in ('.tm1637-card','.tm-digit','.lcd1602-screen'):
    if marker not in styles: raise SystemExit('Missing display CSS marker: '+marker)

# Firmware support
fwpath=ROOT/'esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_3_1.ino'
if not fwpath.exists(): raise SystemExit('Firmware v2.3 sketch missing')
fw=fwpath.read_text()
sketchdir=ROOT/'esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_3_1/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_3_1.ino'
if not sketchdir.exists() or sketchdir.read_text()!=fw: raise SystemExit('Arduino sketch-folder copy missing or differs from convenience firmware copy')
for marker in ('struct CounterSlot;','struct RotarySlot;','struct TM1637Slot;','struct LCD1602Slot;','X-Zebjus-Token','ver", "2.3.1"','No ultrasonic echo received','DHT11_MIN_READ_MS=1200UL','modeReady','controlReady','tmWriteByte','tm1637Api','lcd1602Api','/api/tm1637','/api/lcd1602','transactionBidirectionalMode'):
    if marker not in fw: raise SystemExit('Missing firmware marker: '+marker)
if 'MODE input pin conflict: active output' in fw and 'releaseOutputPin(pin,false)' not in fw:
    raise SystemExit('Transaction bidirectional mode-switch fix missing')

# Workflow/helper paths
workflow=(ROOT/'.github/workflows/esp32-firmware-compile.yml').read_text()
if 'esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_3_1' not in workflow: raise SystemExit('GitHub Action targets stale firmware')
if not (ROOT/'GITHUB_ACTIONS_WORKFLOW_VISIBLE/esp32-firmware-compile.yml').exists(): raise SystemExit('Visible workflow copy missing')
if not (ROOT/'VERIFY_RELEASE.py').exists() or not (ROOT/'COMPILE_ESP32_FIRMWARE.sh').exists(): raise SystemExit('Visible tool wrappers missing')

subprocess.check_call([sys.executable,str(ROOT/'TEST_SENSOR_RUNTIME.py')])
bc=json.loads((ROOT/'BUILD_CHECK.json').read_text())
assert bc['ui_version']=='6.3.1' and bc['firmware']=='2.3.1' and bc['examples_count']==40
print(f'ZEBJUS v6.3.1 release verification PASS ({len(js_files)} JS, {len(examples)} examples)')
