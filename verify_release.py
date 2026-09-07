from pathlib import Path
from html.parser import HTMLParser
import subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
class P(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.refs=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])
        for k in ('src','href'):
            v=d.get(k,'')
            if v and not v.startswith(('http://','https://','data:','#','mailto:','javascript:')):
                self.refs.append(v.split('?')[0].split('#')[0])
for js in ROOT.glob('*.js'):
    if subprocess.call(['node','--check',str(js)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL): raise SystemExit(f'JS syntax failed: {js.name}')
for h in ROOT.glob('*.html'):
    p=P();p.feed(h.read_text(errors='ignore'))
    if len(p.ids)!=len(set(p.ids)): raise SystemExit(f'Duplicate HTML id: {h.name}')
    for r in p.refs:
        if r and not (ROOT/r).exists(): raise SystemExit(f'Missing local ref in {h.name}: {r}')
s=(ROOT/'py-worker.js').read_text(); needle='await pyodide.runPythonAsync(`'; a=s.index(needle)+len(needle); b=s.index('`);',a); compile(s[a:b],'<pyodide-init>','exec')
fw=(ROOT/'esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_2.ino').read_text()
for marker in ('struct CounterSlot;','struct RotarySlot;','X-Zebjus-Token','ver", "2.2"'):
    if marker not in fw: raise SystemExit('Missing firmware marker: '+marker)
print('ZEBJUS v6.2 release verification PASS')
