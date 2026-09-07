from pathlib import Path
ROOT=Path(__file__).resolve().parent
app=(ROOT/'app.js').read_text()
client=(ROOT/'kit-client.js').read_text()
assert 'const KIT_FAILURE_LIMIT=5' in app
assert 'kitFailureCount<KIT_FAILURE_LIMIT' in app
assert 'if(kitFailureCount>=KIT_FAILURE_LIMIT)' in app
assert 'kitClient.disconnect({forgetIdentity:false})' in app
assert 'q.paused=true' in app and 'q.paused=false' in app
assert 'if(!newer)q.pending.unshift(next)' in app
assert 'if(!q.latest)q.latest=next' in app
assert 'this.base="";this.status=null;throw e;' not in client
assert 'HTTP 4xx/5xx is an application/device response, not a lost kit.' in client
assert 'await new Promise(r=>setTimeout(r,80))' in client
assert 'this._lastGoodAt=Date.now()' in client
assert 'localAddressSpaceMode' in client
print('Connection stability regression PASS')

assert 'state.pending?"SYNCING":"KIT"' not in app
assert 'state.pending?"SYNCING":"KIT"' not in app
assert 'buildDebugReport' in app and 'copyDebugReport' in app
assert 'zebjus-kit-diagnostic' in client and 'latencyMs' in client
print('No-blink + debug trace regression PASS')


assert 'err.reachable=true;err.transport=false' in client
assert 'if(e?.status){this._lastGoodAt=Date.now();throw e;}' in client
assert 'q.pauseReason="device"' in app
assert 'q.pauseReason="transport"' in app
assert 'if(q.pauseReason==="transport")' in app
assert 'Display device fault isolated from kit connection' in app
assert 'if(e?.status){markKitSuccess(kitClient.status);warnHardwareCommand' in app
print('Device fault isolation regression PASS')
