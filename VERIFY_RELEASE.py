from pathlib import Path
from html.parser import HTMLParser
import subprocess, sys, re, json, xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent
VERSION='6.8.0'; FW_VERSION='2.5.0'

class P(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.refs=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])
        for k in ('src','href'):
            v=d.get(k,'')
            if v and not v.startswith(('http://','https://','data:','#','mailto:','javascript:')):
                self.refs.append(v.split('?')[0].split('#')[0])

# Flat GitHub package rule: only firmware is allowed in a subfolder.
allowed_dirs={'esp32_firmware'}
extra=[p.name for p in ROOT.iterdir() if p.is_dir() and p.name not in allowed_dirs and p.name!='__pycache__']
if extra: raise SystemExit('Unexpected folders in flat GitHub package: '+', '.join(sorted(extra)))

# JS syntax.
js_files=sorted(ROOT.glob('*.js'))
for js in js_files:
    subprocess.check_call(['node','--check',str(js)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
required_js={'app.js','kit-client.js','py-worker.js','settings.js','ai.js','camera-bridge.js','component-library.js','circuit-sync.js','circuit-simulator.js','circuit.js','schematic.js','firmware-updater.js'}
missing=required_js-{x.name for x in js_files}
if missing: raise SystemExit('Missing JS: '+', '.join(sorted(missing)))

# HTML ids/refs/cache version.
htmls=sorted(ROOT.glob('*.html'))
required_html={'index.html','settings.html','camera-bridge.html','diagnostics.html','circuit.html','schematic.html','firmware.html'}
if required_html-{x.name for x in htmls}: raise SystemExit('Required HTML page missing')
for h in htmls:
    text=h.read_text(errors='ignore'); p=P();p.feed(text)
    if len(p.ids)!=len(set(p.ids)): raise SystemExit(f'Duplicate HTML id: {h.name}')
    for r in p.refs:
        target=(ROOT/r).resolve()
        if r and not target.exists(): raise SystemExit(f'Missing local ref in {h.name}: {r}')
    for ref in re.findall(r'(?:src|href)="(\./[^\"]+\.(?:js|css)(?:\?[^\"]*)?)"',text):
        if f'?v={VERSION}' not in ref: raise SystemExit(f'Runtime asset cache key is not {VERSION} in {h.name}: {ref}')
    if './assets/circuit/' in text: raise SystemExit(f'Nested circuit asset ref remains: {h.name}')

# Pyodide templates + 46 examples.
worker=(ROOT/'py-worker.js').read_text(); blocks=re.findall(r'runPythonAsync\(`([\s\S]*?)`\)',worker)
if len(blocks)<7: raise SystemExit('Expected Pyodide Python blocks missing')
for i,b in enumerate(blocks,1):
    if '${' not in b: compile(b,f'<pyodide-{i}>','exec')
app=(ROOT/'app.js').read_text(); start=app.find('const examples={'); end=app.find('\n  };',start); block=app[start:end]
examples=re.findall(r'\n\s*([A-Za-z0-9_]+):`([\s\S]*?)`(?:,|\s*$)',block)
if len(examples)!=46: raise SystemExit(f'Expected 46 examples, found {len(examples)}')
for name,code in examples: compile(code,f'<example:{name}>','exec')
for ex in ('tm1637Display','lcd1602Display','diagnosticClock'):
    if ex not in dict(examples): raise SystemExit('Missing example: '+ex)

# Retained stable-link/runtime/device isolation markers.
client=(ROOT/'kit-client.js').read_text(); styles=(ROOT/'styles.css').read_text()
for m in ('HTTP 4xx/5xx is an application/device response, not a lost kit.','localAddressSpaceMode','this._lastGoodAt=Date.now()','async firmwareInfo()','async reboot()'):
    if m not in client: raise SystemExit('Missing kit-client marker: '+m)
for m in ('kitClient.disconnect({forgetIdentity:false})','q.paused=true','q.paused=false','copyDebugBtn','buildDebugReport','Display device fault isolated from kit connection'):
    if m not in app: raise SystemExit('Missing app/runtime marker: '+m)
for m in ('q.pauseReason!=="device"','pendingCircuitCode','Circuit update queued','applyPendingCircuitCode'):
    if m not in app: raise SystemExit('Missing retained runtime fix: '+m)
if 'SYNCING' in app: raise SystemExit('User-facing SYNCING label remains')
for m in ('.tm1637-card','.lcd1602-screen','zebjusDisplayPulse'):
    if m not in styles: raise SystemExit('Display CSS missing: '+m)

# Student workspace / 2D Circuit Designer.
cl=(ROOT/'component-library.js').read_text(); cs=(ROOT/'circuit-sync.js').read_text(); cj=(ROOT/'circuit.js').read_text(); cc=(ROOT/'circuit.css').read_text(); sj=(ROOT/'schematic.js').read_text()
for m in ('VERSION:"6.8.0"','FIRMWARE:"2.5.0"','COMPONENTS=','BOARD_PINS=','PHYSICAL_PIN_COUNT:38','BOARD_NAME:"ZEBJUS Custom Board 38-Pin Expansion"','c.asset2d=`./${c.slug}-2d.svg`'):
    if m not in cl: raise SystemExit('Component library marker missing: '+m)
if 'asset3d' in cl: raise SystemExit('3D component metadata remains in component-library.js')
for m in ('flipX','flipY','rotation:0','applyGeneratedBlock','allocateUARTPorts','allocateSPIBuses'):
    if m not in cs: raise SystemExit('Circuit sync marker missing: '+m)
for m in ('BroadcastChannel','zebjus-circuit-design-v2','onDesignChange','publishDesign'):
    if m not in cs: raise SystemExit('Cross-page circuit sync marker missing: '+m)
if 'Number.isFinite(bx)?bx:940' not in cs or 'Number.isFinite(by)?by:420' not in cs: raise SystemExit('Circuit board zero-position fix missing')
for m in ('stagePoint(el)','componentTransform(c)','data-orient','Flip H','Flip V','wirePath(a,b,i)','pin-hotspot','startCanvasPan','addEventListener(\'wheel\'','canvasWorld','m.asset2d'):
    if m not in cj: raise SystemExit('Circuit interaction marker missing: '+m)
for m in ('startPan','addEventListener("wheel"','schWorld','syncIfValid','startBoardDrag'):
    if m not in sj: raise SystemExit('Schematic interaction marker missing: '+m)
for m in ('component-visual-shell','component-visual','pin-hotspot','orientation-tools','wire-under'):
    if m not in cc: raise SystemExit('Circuit visual marker missing: '+m)
if './zebjus-custom-board-38pin-2d.svg' not in (ROOT/'circuit.html').read_text(): raise SystemExit('ZEBJUS custom board asset is not flat/root-level')
if (ROOT/'esp32-devkit-2d.svg').exists(): raise SystemExit('Obsolete board artwork remains')
for page in ('index.html','circuit.html','schematic.html','settings.html'):
    text=(ROOT/page).read_text()
    for label in ('Python Lab','Circuit Design','Schematic'):
        if label not in text: raise SystemExit(f'{page} missing workspace tab: {label}')
if 'view3dBtn' in (ROOT/'circuit.html').read_text() or '3D Components' in (ROOT/'circuit.html').read_text(): raise SystemExit('Circuit UI still exposes a 3D mode')
for page in ('index.html','circuit.html','schematic.html'):
    text=(ROOT/page).read_text()
    if ('workspaceRunBtn' if page=='index.html' else 'runSimulationBtn') not in text: raise SystemExit(f'{page} missing top Run button')
sim=(ROOT/'circuit-simulator.js').read_text()
for m in ('ZebjusCircuitSimulator','StepperMotor','BME280','valueFor','setInterval'):
    if m not in sim: raise SystemExit('Working circuit simulation marker missing: '+m)
for m in ('.wire-layer{z-index:40;', 'simulation-running .wire-main'):
    if m not in cc: raise SystemExit('Front-wire/simulation CSS marker missing: '+m)
settings=(ROOT/'settings.html').read_text()
if 'settings-advanced' not in settings or 'Advanced kit settings' not in settings: raise SystemExit('Simplified student settings disclosure missing')

# 81 root-level 2D SVG assets and readable pin labels.
svg=sorted(ROOT.glob('*.svg'))
if len(svg)!=81: raise SystemExit(f'Expected 81 root 2D SVG assets, found {len(svg)}')
if any('-3d.svg' in f.name for f in svg): raise SystemExit('3D SVG asset remains in the 2D-only release')
if any(not f.name.endswith('-2d.svg') for f in svg): raise SystemExit('Unexpected non-2D SVG asset in release')
for f in svg:
    try: r=ET.parse(f).getroot()
    except Exception as e: raise SystemExit(f'Invalid SVG {f.name}: {e}')
    if not r.tag.endswith('svg'): raise SystemExit('Not SVG: '+f.name)
    if r.attrib.get('data-realistic')!='top-view': raise SystemExit('Realistic top-view marker missing: '+f.name)
generator=ROOT/'GENERATE_REALISTIC_2D_PARTS.py'
if not generator.exists(): raise SystemExit('Reproducible 2D part generator missing')
compile(generator.read_text(),str(generator),'exec')
for name in ('tm1637-2d.svg','lcd1602-2d.svg','ultrasonic-2d.svg','dht11-2d.svg','zebjus-custom-board-38pin-2d.svg','dcmotor-2d.svg','stepper-motor-2d.svg'):
    t=(ROOT/name).read_text()
    if '<text' not in t: raise SystemExit('Preview labels missing: '+name)

# Firmware Center page.
fwhtml=(ROOT/'firmware.html').read_text(); fwjs=(ROOT/'firmware-updater.js').read_text(); fwcss=(ROOT/'firmware.css').read_text()
for m in ('Detect controller','Firmware source','Flash over Wi-Fi','USB recovery','Update monitor'):
    if m not in fwhtml: raise SystemExit('Firmware Center UI missing: '+m)
for m in ('/api/firmware/update','firmwareInfo','upload.onprogress','USB flash','0x10000','reconnect'):
    if m not in fwjs: raise SystemExit('Firmware updater marker missing: '+m)
for m in ('function kitKey(','function selectedKit(','function tokenForKit(','new Uint8Array(await file.arrayBuffer())'):
    if m not in fwjs: raise SystemExit('Firmware Center retained fix missing: '+m)
if '.stages' not in fwcss or '.progress' not in fwcss: raise SystemExit('Firmware progress UI CSS missing')

# Firmware v2.5.0: only one firmware file, OTA + reboot endpoints, safety block.
fwdir=ROOT/'esp32_firmware'; fwfiles=list(fwdir.glob('*.ino')) if fwdir.exists() else []
if len(fwfiles)!=1 or fwfiles[0].name!='ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_5_0.ino':
    raise SystemExit('esp32_firmware must contain only the v2.5.0 sketch')
fw=fwfiles[0].read_text()
for m in ('#include <Update.h>','FIRMWARE_VERSION = "2.5.0"','/api/firmware/info','/api/firmware/update','/api/reboot','web_firmware_update','Stop the running Python program before firmware update','Update.begin(UPDATE_SIZE_UNKNOWN)','Update.end(true)'):
    if m not in fw: raise SystemExit('Firmware v2.5.0 marker missing: '+m)
for m in ('tm1637Api','lcd1602Api','transactionBidirectionalMode','DHT11_MIN_READ_MS=1200UL'):
    if m not in fw: raise SystemExit('Retained bridge marker missing: '+m)

# Regressions.
for test in ('TEST_SENSOR_RUNTIME.py','TEST_RUNTIME_NAMESPACE.py','TEST_CONNECTION_STABILITY.py','TEST_CIRCUIT_DESIGNER.py','TEST_BUGFIXES.py'):
    subprocess.check_call([sys.executable,str(ROOT/test)])
browser=subprocess.run([sys.executable,str(ROOT/'TEST_CIRCUIT_UI_BROWSER.py')])
if browser.returncode not in (0,77): raise SystemExit('Circuit browser UI regression FAILED')
browser_state='PASS' if browser.returncode==0 else 'SKIPPED (Chromium unavailable)'

# Build metadata.
bc=json.loads((ROOT/'BUILD_CHECK.json').read_text())
if bc.get('ui_version')!=VERSION or bc.get('firmware')!=FW_VERSION or bc.get('examples_count')!=46 or bc.get('circuit_components')!=80 or bc.get('circuit_svg_assets')!=81: raise SystemExit('BUILD_CHECK version/count mismatch')
if not bc.get('features',{}).get('reference_ui_adoption') or not bc['features'].get('web_firmware_update') or not bc['features'].get('pin_hotspot_wiring'):
    raise SystemExit('BUILD_CHECK missing retained features')
for feature in ('display_transport_resume_fix','stable_firmware_kit_identity','secure_firmware_token_injection','usb_uint8array_flash','circuit_zero_position_fix','queued_circuit_main_sync','browser_ui_release_regression'):
    if not bc.get('features',{}).get(feature): raise SystemExit('BUILD_CHECK missing bugfix feature: '+feature)
for feature in ('student_workspace_tabs','two_dimensional_only','realistic_top_view_parts','mouse_wheel_zoom','canvas_drag_pan','live_wire_follow','broadcast_design_sync','simplified_student_settings'):
    if not bc.get('features',{}).get(feature): raise SystemExit('BUILD_CHECK missing student-workspace feature: '+feature)
print(f'ZEBJUS v{VERSION} release verification PASS ({len(js_files)} JS, {len(examples)} examples, 80 circuit components, 38-pin custom board, {len(svg)} 2D SVG assets, firmware v{FW_VERSION}; browser UI {browser_state})')
