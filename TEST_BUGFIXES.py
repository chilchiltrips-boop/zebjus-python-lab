from pathlib import Path

ROOT=Path(__file__).resolve().parent
app=(ROOT/'app.js').read_text()
circuit=(ROOT/'circuit-sync.js').read_text()
updater=(ROOT/'firmware-updater.js').read_text()
verifier=(ROOT/'VERIFY_RELEASE.py').read_text()

# Display queues paused by a lost transport must be tagged so reconnect resumes them.
assert 'if(q.pauseReason!=="device"){q.paused=true;q.pauseReason="transport";}' in app
assert 'if(q.pauseReason==="transport"){q.paused=false;q.pauseReason="";' in app

# Circuit sync received during a run must be queued and applied on every stop/completion path.
assert 'pendingCircuitCode' in app
assert 'Circuit update queued. It will be applied after the program stops.' in app
assert app.count('applyPendingCircuitCode')>=7

# Exact board-edge coordinates are valid values, not missing-data fallbacks.
assert 'Number.isFinite(bx)?bx:940' in circuit
assert 'Number.isFinite(by)?by:420' in circuit

# Firmware Center targets a stable identity, loads the matched Settings token, and gives esptool Uint8Array data.
assert 'function kitKey(' in updater and 'function selectedKit(' in updater
assert 'known().find(x=>kitKey(x)===key)' in updater
assert 'localStorage.getItem("zebjus.lab.settings")' in updater
assert 'return sameKit?String(s.kitToken||""):""' in updater
assert 'const bytes=new Uint8Array(await file.arrayBuffer())' in updater
assert 'fileArray:[{data:fw.bytes,address:0x10000}]' in updater

# Full release verification now includes the browser/UI regression.
assert "'TEST_CIRCUIT_UI_BROWSER.py'" in verifier
print('v6.8.0 retained bugfix regression PASS: reconnect queues, stable kit identity, secure token, USB bytes, board edge, queued circuit sync, browser QA')
