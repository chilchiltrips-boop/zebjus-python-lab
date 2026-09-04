(function(global){
  "use strict";

  const KNOWN_KEY="zebjus.lab.knownKits";
  const SAFE_RGB_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33];

  function normalizeKitName(value){
    let s=String(value||"").trim().toLowerCase();
    s=s.replace(/\s+/g,"_").replace(/[^a-z0-9_-]/g,"").replace(/_+/g,"_").replace(/-+/g,"-");
    s=s.replace(/^[_-]+|[_-]+$/g,"");
    return s.slice(0,32);
  }

  function hostFromName(name){
    const n=normalizeKitName(name);
    return n.replace(/_/g,"-");
  }

  function baseFromName(name){
    return `http://${hostFromName(name)}.local`;
  }

  function loadKnown(){
    try{
      const list=JSON.parse(localStorage.getItem(KNOWN_KEY)||"[]");
      return Array.isArray(list)?list.filter(x=>x&&x.name):[];
    }catch(_){return [];}
  }

  function rememberKit(status,base){
    if(!status?.name)return;
    const now=Date.now();
    const old=loadKnown().filter(x=>normalizeKitName(x.name)!==normalizeKitName(status.name));
    old.unshift({name:status.name,ip:status.ip||"",base:base||baseFromName(status.name),lastSeen:now,chipId:status.chipId||""});
    localStorage.setItem(KNOWN_KEY,JSON.stringify(old.slice(0,30)));
  }

  function formBody(data){
    const p=new URLSearchParams();
    Object.entries(data||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null)p.set(k,String(v));});
    return p.toString();
  }

  async function fetchLocal(url,options={},timeoutMs=2200){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    const base={cache:"no-store",...options,signal:ctrl.signal};
    try{
      try{
        return await fetch(url,{...base,targetAddressSpace:"local"});
      }catch(first){
        if(first?.name==="AbortError")throw first;
        return await fetch(url,base);
      }
    }finally{clearTimeout(timer);}
  }

  async function requestBase(base,path,{method="GET",data=null,timeout=2200}={}){
    const headers={"Accept":"application/json"};
    const opts={method,headers};
    if(data!==null){
      headers["Content-Type"]="application/x-www-form-urlencoded;charset=UTF-8";
      opts.body=formBody(data);
    }
    const res=await fetchLocal(base+path,opts,timeout);
    let payload=null;
    const text=await res.text();
    try{payload=text?JSON.parse(text):{};}catch(_){payload={ok:res.ok,message:text};}
    if(!res.ok){
      const err=new Error(payload?.message||`Kit HTTP ${res.status}`);
      err.status=res.status;err.payload=payload;throw err;
    }
    return payload||{};
  }

  async function connect(name,ipHint=""){
    const clean=normalizeKitName(name);
    if(clean.length<3)throw new Error("Enter a valid kit name (minimum 3 characters).");
    const bases=[];
    if(ipHint&&/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ipHint))bases.push(`http://${ipHint}`);
    bases.push(baseFromName(clean));
    const known=loadKnown().find(x=>normalizeKitName(x.name)===clean);
    if(known?.ip)bases.push(`http://${known.ip}`);

    let lastErr=null;
    for(const base of [...new Set(bases)]){
      try{
        const status=await requestBase(base,"/api/status",{timeout:1800});
        if(status.kit!=="ZEBJUS")throw new Error("This device is not a ZEBJUS kit.");
        if(normalizeKitName(status.name)!==clean && !base.includes(status.ip||"__none__")){
          // The requested host may have been renamed. Accept verified ZEBJUS response and use returned name.
        }
        rememberKit(status,base);
        return {status,base};
      }catch(e){lastErr=e;}
    }
    const e=new Error(lastErr?.name==="AbortError"?"Kit connection timed out.":(lastErr?.message||"Kit not found."));
    e.cause=lastErr;throw e;
  }

  async function scanDefaultKits(max=30,onProgress=null){
    max=Math.max(1,Math.min(80,Number(max)||30));
    const candidates=[];
    for(let i=1;i<=max;i++)candidates.push(`zebjus_kit_${i}`);
    loadKnown().forEach(k=>candidates.push(normalizeKitName(k.name)));
    const names=[...new Set(candidates.filter(Boolean))];
    const found=[];
    let cursor=0,done=0;

    async function worker(){
      while(cursor<names.length){
        const index=cursor++,name=names[index];
        try{
          const result=await connect(name);
          if(!found.some(x=>normalizeKitName(x.status.name)===normalizeKitName(result.status.name)))found.push(result);
        }catch(_){/* expected for unused names */}
        done++;if(onProgress)onProgress(done,names.length,found.length);
      }
    }
    await Promise.all(Array.from({length:Math.min(8,names.length)},worker));
    return found.sort((a,b)=>String(a.status.name).localeCompare(String(b.status.name),undefined,{numeric:true}));
  }

  class KitClient{
    constructor(){this.base="";this.status=null;this._commandChain=Promise.resolve();}
    get connected(){return !!this.base&&!!this.status;}
    async connect(name,ipHint=""){
      const r=await connect(name,ipHint);this.base=r.base;this.status=r.status;return r.status;
    }
    disconnect(){this.base="";this.status=null;}
    async refresh(){if(!this.base)throw new Error("Kit not connected.");this.status=await requestBase(this.base,"/api/status");rememberKit(this.status,this.base);return this.status;}
    async rgb(p={}){
      if(!this.base)throw new Error("Kit not connected.");
      const data={r:p.r??0,g:p.g??0,b:p.b??0,id:p.id??1};
      if(p.rPin!==undefined){data.rPin=p.rPin;data.gPin=p.gPin;data.bPin=p.bPin;}
      if(p.commonAnode!==undefined)data.commonAnode=p.commonAnode?1:0;
      const task=()=>requestBase(this.base,"/api/rgb",{method:"POST",data,timeout:1600});
      this._commandChain=this._commandChain.then(task,task);
      return this._commandChain;
    }
    async rename(name){
      if(!this.base)throw new Error("Kit not connected.");
      const clean=normalizeKitName(name);
      if(clean.length<3)throw new Error("Kit name must be 3–32 characters.");
      return requestBase(this.base,"/api/name",{method:"POST",data:{name:clean},timeout:4500});
    }
    async resetName(){if(!this.base)throw new Error("Kit not connected.");return requestBase(this.base,"/api/name/reset",{method:"POST",data:{reset:1},timeout:4500});}
    async scanWifi(){if(!this.base)throw new Error("Kit not connected.");return requestBase(this.base,"/api/wifi/scan",{timeout:12000});}
    async setWifi(ssid,password){if(!this.base)throw new Error("Kit not connected.");return requestBase(this.base,"/api/wifi",{method:"POST",data:{ssid,password},timeout:4500});}
    async resetWifi(){if(!this.base)throw new Error("Kit not connected.");return requestBase(this.base,"/api/wifi/reset",{method:"POST",data:{reset:1},timeout:4500});}
  }

  global.ZebjusKit={
    KitClient,normalizeKitName,hostFromName,baseFromName,scanDefaultKits,loadKnown,rememberKit,SAFE_RGB_PINS
  };
})(window);
