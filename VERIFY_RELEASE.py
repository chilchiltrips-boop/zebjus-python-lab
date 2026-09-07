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
    for stale in ('?v=6.1','?v=6.2.2','?v=6.3.0','?v=6.3.1','?v=6.4.0','?v=6.4.1'):
        if stale in text: raise SystemExit(f'Stale cache-buster remains in {h}: {stale}')
    if '?v=6.4.2' not in text: raise SystemExit(f'Current cache-buster missing in {h}')

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
for marker in ('displayHardwareQueues','queueDisplayHardware','runDisplayHardwareQueue','flushDisplayHardwareQueues','isLatestDisplayVisual','__displaySeq','pending:true','displayCardsByPins','data-tm-clk','data-lcd-bus','ordered'):
    if marker not in app: raise SystemExit('Missing display sync/queue marker: '+marker)
for marker in ('TM1637','LCD1602','tm1637Display','lcd1602Display','paintTM1637','paintLCD1602'):
    if marker not in app: raise SystemExit('Missing app display marker: '+marker)
for marker in ('class TM1637:','class LCD1602:','TM1637_SET','LCD1602_SET','def scroll(self,text','def decimal(self,value','def align(self,row,text','def bounce(self,row,text','def typewriter(self,row,text','def progress(self,row,percent','def cursor(self,visible'):
    if marker not in s: raise SystemExit('Missing Python display marker: '+marker)
for marker in ('async tm1637(','async lcd1602(','/api/tm1637','/api/lcd1602'):
    if marker not in client: raise SystemExit('Missing kit-client display marker: '+marker)
for marker in ('.tm1637-card','.tm-digit','.lcd1602-screen','.lcd-cursor','zebjusDisplayPulse'):
    if marker not in styles: raise SystemExit('Missing display CSS marker: '+marker)

# Firmware support
fwpath=ROOT/'esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_4_0.ino'
if not fwpath.exists(): raise SystemExit('Firmware v2.3 sketch missing')
fw=fwpath.read_text()
sketchdir=ROOT/'esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_4_0/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_4_0.ino'
if not sketchdir.exists() or sketchdir.read_text()!=fw: raise SystemExit('Arduino sketch-folder copy missing or differs from convenience firmware copy')
for marker in ('struct CounterSlot;','struct RotarySlot;','struct TM1637Slot;','struct LCD1602Slot;','X-Zebjus-Token','ver", "2.4.0"','No ultrasonic echo received','DHT11_MIN_READ_MS=1200UL','modeReady','controlReady','tmWriteByte','tm1637Api','lcd1602Api','/api/tm1637','/api/lcd1602','transactionBidirectionalMode','cursor_mode','lcdApplyDisplayControl'):
    if marker not in fw: raise SystemExit('Missing firmware marker: '+marker)
if 'MODE input pin conflict: active output' in fw and 'releaseOutputPin(pin,false)' not in fw:
    raise SystemExit('Transaction bidirectional mode-switch fix missing')

# Workflow/helper paths
workflow=(ROOT/'.github/workflows/esp32-firmware-compile.yml').read_text()
if 'esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_4_0' not in workflow: raise SystemExit('GitHub Action targets stale firmware')
if not (ROOT/'GITHUB_ACTIONS_WORKFLOW_VISIBLE/esp32-firmware-compile.yml').exists(): raise SystemExit('Visible workflow copy missing')
if not (ROOT/'VERIFY_RELEASE.py').exists() or not (ROOT/'COMPILE_ESP32_FIRMWARE.sh').exists(): raise SystemExit('Visible tool wrappers missing')


# v6.4 output/display helper coverage
for marker in ('def fade(self,r=0,g=0,b=0','def rainbow(self,cycles=1','def sweep(self,start=0,end=180','def ramp(self,target=100','def beep(self,frequency=1000'):
    if marker not in s: raise SystemExit('Missing output FX helper: '+marker)
for marker in ('cursor_mode','visible=(size_t)(16-col)','display-effects-v2'):
    if marker not in fw: raise SystemExit('Missing firmware display-FX marker: '+marker)

subprocess.check_call([sys.executable,str(ROOT/'TEST_SENSOR_RUNTIME.py')])
subprocess.check_call([sys.executable,str(ROOT/'TEST_RUNTIME_NAMESPACE.py')])
worker_text=(ROOT/'py-worker.js').read_text()
if 'import sys, io, json' not in worker_text: raise SystemExit('Per-cycle io import hotfix missing')
for marker in ('def _zebjus_new_student_namespace():','def _zebjus_ensure_terminal_streams():','_zebjus_student_globals, _zebjus_student_globals'):
    if marker not in worker_text: raise SystemExit('Protected runtime marker missing: '+marker)
if 'globals(), globals())' in worker_text: raise SystemExit('Student code still executes in runtime globals')
bc=json.loads((ROOT/'BUILD_CHECK.json').read_text())
assert bc['ui_version']=='6.4.2' and bc['firmware']=='2.4.0' and bc['examples_count']==40
print(f'ZEBJUS v6.4.2 release verification PASS ({len(js_files)} JS, {len(examples)} examples)')
