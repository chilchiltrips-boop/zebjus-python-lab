from pathlib import Path
from html.parser import HTMLParser
import subprocess, sys, re, json
ROOT=Path(__file__).resolve().parents[1]
class P(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.refs=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])
        for k in ('src','href'):
            v=d.get(k,'')
            if v and not v.startswith(('http://','https://','data:','#','mailto:','javascript:')): self.refs.append(v.split('?')[0].split('#')[0])
for js in ROOT.glob('*.js'):
    if subprocess.call(['node','--check',str(js)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL): raise SystemExit(f'JS syntax failed: {js.name}')
for h in ROOT.glob('*.html'):
    p=P();p.feed(h.read_text(errors='ignore'))
    if len(p.ids)!=len(set(p.ids)): raise SystemExit(f'Duplicate HTML id: {h.name}')
    for r in p.refs:
        if r and not (ROOT/r).exists(): raise SystemExit(f'Missing local ref in {h.name}: {r}')
for h in ('index.html','settings.html','camera-bridge.html'):
    text=(ROOT/h).read_text(errors='ignore')
    if '?v=6.1' in text: raise SystemExit(f'Stale cache-buster remains in {h}')
s=(ROOT/'py-worker.js').read_text();blocks=re.findall(r'runPythonAsync\(`([\s\S]*?)`\)',s)
if len(blocks)<7: raise SystemExit('Expected Pyodide Python blocks missing')
for i,b in enumerate(blocks,1):
    if '${' not in b: compile(b,f'<pyodide-block-{i}>','exec')
app=(ROOT/'app.js').read_text();settings=(ROOT/'settings.js').read_text()
# Compile all bundled Python examples so an editor example cannot ship with a Python syntax error.
start=app.find('const examples={');end=app.find('\n  };',start);example_block=app[start:end]
examples=re.findall(r'\n\s*([A-Za-z0-9_]+):`([\s\S]*?)`(?:,|\s*$)',example_block)
if len(examples)!=38: raise SystemExit(f'Expected 38 Python examples, found {len(examples)}')
for name,code in examples: compile(code,f'<example:{name}>','exec')
for marker in ('demoMode:false','hasFiniteValue','clearSimulatedSensorState','Prefetch direct Universal Bridge sensor classes'):
    if marker not in app: raise SystemExit('Missing app sensor-sync marker: '+marker)
if 'demoMode:false' not in settings: raise SystemExit('Settings still default Demo Mode ON')
for forbidden in ('_sensor_state={"ultrasonic_cm":45.0','"dht_temperature":28.0,"dht_humidity":65.0'):
    if forbidden in s: raise SystemExit('Hard-coded online sensor fallback remains: '+forbidden)
fw=(ROOT/'esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_2.ino').read_text()
for marker in ('struct CounterSlot;','struct RotarySlot;','X-Zebjus-Token','ver", "2.2.2"','No ultrasonic echo received','No valid DHT11 response','enum Dht11ReadStatus : uint8_t;','DHT11_MIN_READ_MS=1200UL','dht11StatusText'):
    if marker not in fw: raise SystemExit('Missing firmware marker: '+marker)
subprocess.check_call([sys.executable,str(ROOT/'tools/test_sensor_runtime.py')])
bc=json.loads((ROOT/'BUILD_CHECK.json').read_text());assert bc['ui_version']=='6.2.2' and bc['firmware']=='2.2.2'
print('ZEBJUS v6.2.2 release verification PASS')
