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
assert 'One local HTTP miss must not erase a healthy cached connection.' in client
assert 'await new Promise(r=>setTimeout(r,80))' in client
assert 'this._lastGoodAt=Date.now()' in client
assert 'localAddressSpaceMode' in client
print('Connection stability regression PASS')
