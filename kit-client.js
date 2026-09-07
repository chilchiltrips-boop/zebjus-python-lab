(function(global){
  "use strict";

  const KNOWN_KEY="zebjus.lab.knownKits";
  const SAFE_RGB_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33];
  const SAFE_ADC_PINS=[32,33,34,35,36,39];
  const SAFE_DIGITAL_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39];
  const SAFE_ULTRASONIC_ECHO_PINS=[...SAFE_DIGITAL_PINS,12];
  const SAFE_COUNTER_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33,34,35];

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
    const chip=String(status.chipId||"");
    const old=loadKnown().filter(x=>normalizeKitName(x.name)!==normalizeKitName(status.name) && (!chip || String(x.chipId||"")!==chip));
    old.unshift({name:status.name,ip:status.ip||"",base:base||baseFromName(status.name),lastSeen:now,chipId:chip,ssid:status.ssid||""});
    localStorage.setItem(KNOWN_KEY,JSON.stringify(old.slice(0,30)));
  }

  function formBody(data){
    const p=new URLSearchParams();
    Object.entries(data||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null)p.set(k,String(v));});
    return p.toString();
  }

  function queryString(data){
    const q=formBody(data);return q?"?"+q:"";
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

  async function requestBase(base,path,{method="GET",data=null,timeout=2200,token=""}={}){
    const headers={"Accept":"application/json"};
    if(token)headers["X-Zebjus-Token"]=String(token);
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

  async function connect(name,ipHint="",expectedChipId=""){
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
        const actualChip=String(status.chipId||"");
        const expectedChip=String(expectedChipId||"");
        if(expectedChip&&actualChip!==expectedChip)throw new Error("Kit ID mismatch: cached address belongs to a different kit.");
        if(!expectedChip&&normalizeKitName(status.name)!==clean)throw new Error("Kit name mismatch: cached address belongs to another kit.");
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
    constructor(){
      this.base="";this.status=null;this.name="";this.ipHint="";this.chipId="";this.token="";
      this._commandChain=Promise.resolve();this._commandEpoch=0;this._reconnectPromise=null;
      this._lastRgb={rPin:25,gPin:26,bPin:27,commonAnode:false};this._oledInitialized=false;this._oledConfig="";this._dhtCache=new Map();
    }
    get connected(){return !!this.base&&!!this.status;}
    _accept(status,base){
      this.base=base;this.status=status;this.name=status?.name||this.name;this.ipHint=status?.ip||this.ipHint;this.chipId=String(status?.chipId||this.chipId||"");
      if(status?.rgb)this._lastRgb={rPin:status.rgb.rPin??25,gPin:status.rgb.gPin??26,bPin:status.rgb.bPin??27,commonAnode:!!status.rgb.commonAnode};
      return status;
    }
    async connect(name,ipHint=""){
      const requested=normalizeKitName(name||this.name);
      const r=await connect(requested,ipHint||this.ipHint,this.chipId);
      return this._accept(r.status,r.base);
    }
    disconnect({forgetIdentity=false}={}){
      this._commandEpoch++;this._commandChain=Promise.resolve();this.base="";this.status=null;
      if(forgetIdentity){this.name="";this.ipHint="";this.chipId="";}
    }
    async refresh(){
      if(!this.base)throw new Error("Kit not connected.");
      try{
        const st=await requestBase(this.base,"/api/status",{timeout:1400});
        if(this.chipId&&String(st?.chipId||"")!==String(this.chipId))throw new Error("Connected device identity changed.");
        rememberKit(st,this.base);return this._accept(st,this.base);
      }catch(e){this.base="";this.status=null;throw e;}
    }
    async reconnect(retries=4){
      if(this._reconnectPromise)return this._reconnectPromise;
      const name=normalizeKitName(this.name||this.status?.name||"");
      const ip=this.ipHint||this.status?.ip||"";
      if(!name)throw new Error("No kit name saved for reconnect.");
      this._reconnectPromise=(async()=>{
        let last=null;const waits=[0,350,800,1500,2500];
        for(let i=0;i<Math.max(1,retries);i++){
          if(waits[i])await new Promise(r=>setTimeout(r,waits[i]));
          try{
            const r=await connect(name,ip,this.chipId);
            return this._accept(r.status,r.base);
          }catch(e){last=e;}
        }
        throw last||new Error("Kit reconnect failed.");
      })();
      try{return await this._reconnectPromise;}finally{this._reconnectPromise=null;}
    }
    async ensureLive(){
      if(this.connected){try{return await this.refresh();}catch(_){/* reconnect below */}}
      return this.reconnect(4);
    }
    async flushCommands(){try{return await this._commandChain;}catch(_){return null;}}
    async _request(path,opts={},retry=true){
      if(!this.base)await this.reconnect(4);
      try{return await requestBase(this.base,path,{...opts,token:this.token});}
      catch(e){
        if(!retry||e?.status&&e.status<500)throw e;
        this.base="";this.status=null;await this.reconnect(4);return requestBase(this.base,path,{...opts,token:this.token});
      }
    }
    async beginRun(){
      await this.ensureLive();this._commandEpoch++;this._commandChain=Promise.resolve();this._oledInitialized=false;this._dhtCache.clear();
      return this._request("/api/run/start",{method:"POST",data:{start:1},timeout:1800});
    }
    async pingRun(){if(!this.base)throw new Error("Kit not connected.");return requestBase(this.base,"/api/run/ping",{method:"POST",data:{ping:1},timeout:900,token:this.token});}
    async endRun(){
      if(!this.base)return {ok:true};
      this._commandEpoch++;this._commandChain=Promise.resolve();
      try{return await this._request("/api/run/end",{method:"POST",data:{end:1},timeout:1800},false);}
      catch(e){
        const d={r:0,g:0,b:0,...this._lastRgb};
        try{return await this._request("/api/rgb/off",{method:"POST",data:d,timeout:1200},false);}catch(_){throw e;}
      }
    }
    async led(p={}){
      const data={pin:Number(p.pin),value:Math.max(0,Math.min(255,Number(p.value??0))),id:p.id??1,activeHigh:p.activeHigh===false?0:1};
      const epoch=this._commandEpoch;const task=async()=>{if(epoch!==this._commandEpoch)return {ok:true,skipped:true};const r=await this._request("/api/output/led",{method:"POST",data,timeout:1600});if(epoch!==this._commandEpoch)return {ok:true,skipped:true};return r;};
      this._commandChain=this._commandChain.then(task,task);return this._commandChain;
    }
    async rgb(p={}){
      const data={r:p.r??0,g:p.g??0,b:p.b??0,id:p.id??1};
      if(p.rPin!==undefined){data.rPin=p.rPin;data.gPin=p.gPin;data.bPin=p.bPin;}
      if(p.commonAnode!==undefined)data.commonAnode=p.commonAnode?1:0;
      this._lastRgb={rPin:data.rPin??this._lastRgb.rPin,gPin:data.gPin??this._lastRgb.gPin,bPin:data.bPin??this._lastRgb.bPin,commonAnode:data.commonAnode!==undefined?!!data.commonAnode:this._lastRgb.commonAnode};
      const epoch=this._commandEpoch;
      const task=async()=>{
        if(epoch!==this._commandEpoch)return {ok:true,skipped:true};
        const r=await this._request("/api/rgb",{method:"POST",data,timeout:1600});
        if(epoch!==this._commandEpoch)return {ok:true,skipped:true};
        return r;
      };
      this._commandChain=this._commandChain.then(task,task);return this._commandChain;
    }
    async analog(pin=34){
      pin=Number(pin);if(!SAFE_ADC_PINS.includes(pin))throw new Error("Analog input pin must be one of: "+SAFE_ADC_PINS.join(", "));
      return this._request(`/api/input/analog?pin=${encodeURIComponent(pin)}`,{timeout:1400});
    }
    async digital(pin=32,{pullup=true,activeLow=true}={}){
      pin=Number(pin);if(!SAFE_DIGITAL_PINS.includes(pin))throw new Error("Digital input pin must be one of: "+SAFE_DIGITAL_PINS.join(", "));
      const q=`pin=${encodeURIComponent(pin)}&pullup=${pullup?1:0}&activeLow=${activeLow?1:0}`;
      return this._request(`/api/input/digital?${q}`,{timeout:1400});
    }
    async rotary(clk=32,dt=33,sw=-1,{pullup=true}={}){
      clk=Number(clk);dt=Number(dt);sw=sw===null||sw===undefined?-1:Number(sw);
      if(!SAFE_DIGITAL_PINS.includes(clk)||!SAFE_DIGITAL_PINS.includes(dt)||clk===dt)throw new Error("Invalid rotary CLK/DT pins.");
      if(sw>=0&&(!SAFE_DIGITAL_PINS.includes(sw)||sw===clk||sw===dt))throw new Error("Invalid rotary switch pin.");
      const q=`clk=${encodeURIComponent(clk)}&dt=${encodeURIComponent(dt)}&sw=${encodeURIComponent(sw)}&pullup=${pullup?1:0}`;
      return this._request(`/api/input/rotary?${q}`,{timeout:1400});
    }
    async resetRotary(clk=32,dt=33,sw=-1){
      const data={clk:Number(clk),dt:Number(dt),sw:sw===null||sw===undefined?-1:Number(sw)};
      return this._request("/api/input/rotary/reset",{method:"POST",data,timeout:1400});
    }
    async ultrasonic(trig=18,echo=19,{maxCm=400}={}){
      trig=Number(trig);echo=Number(echo);maxCm=Math.max(2,Math.min(600,Number(maxCm)||400));
      if(!SAFE_RGB_PINS.includes(trig))throw new Error("Ultrasonic TRIG must use an output-capable pin: "+SAFE_RGB_PINS.join(", "));
      if(!SAFE_ULTRASONIC_ECHO_PINS.includes(echo)||trig===echo)throw new Error("Invalid ultrasonic ECHO pin.");
      const q=`trig=${encodeURIComponent(trig)}&echo=${encodeURIComponent(echo)}&maxCm=${encodeURIComponent(maxCm)}`;
      return this._request(`/api/input/ultrasonic?${q}`,{timeout:1800});
    }
    async dht11(pin=13){
      pin=Number(pin);if(!SAFE_RGB_PINS.includes(pin))throw new Error("DHT11 DATA must use an output-capable pin: "+SAFE_RGB_PINS.join(", "));
      const now=Date.now(),cached=this._dhtCache.get(pin);
      if(cached&&now-cached.at<1000)return {...cached.data,cached:true};
      const data=await this._request(`/api/input/dht11?pin=${encodeURIComponent(pin)}`,{timeout:1800});
      if(data?.valid!==false)this._dhtCache.set(pin,{at:Date.now(),data});
      else if(cached)return {...cached.data,valid:false,stale:true,message:data?.message||"DHT11 read missed; using previous value."};
      return data;
    }
    async oled(p={}){
      const action=String(p.action||p.command||"").replace(/^OLED_/,"").toLowerCase();
      if(!action)throw new Error("OLED action is required.");
      const data={...p,action};delete data.command;
      const cfg=`${Number(data.sda??21)},${Number(data.scl??22)},${Number(data.address??60)}`;
      if(action==="init"&&this._oledInitialized&&this._oledConfig===cfg)return {ok:true,skipped:true,cached:true};
      if(data.sda!==undefined&&(!SAFE_RGB_PINS.includes(Number(data.sda))||!SAFE_RGB_PINS.includes(Number(data.scl))))throw new Error("OLED SDA/SCL must use output-capable GPIO pins.");
      const epoch=this._commandEpoch;
      const task=async()=>{
        if(epoch!==this._commandEpoch)return {ok:true,skipped:true};
        const r=await this._request("/api/oled",{method:"POST",data,timeout:2200});
        if(action==="init"){this._oledInitialized=true;this._oledConfig=cfg;}
        if(epoch!==this._commandEpoch)return {ok:true,skipped:true};
        return r;
      };
      this._commandChain=this._commandChain.then(task,task);return this._commandChain;
    }
    // Universal Hardware Bridge v2.1. These methods are interface-level, not sensor-specific.
    async bridgeInfo(){return this._request("/api/bridge/info",{timeout:1800});}
    async gpioRead(pin,{mode="input"}={}){
      pin=Number(pin);return this._request("/api/bridge/gpio"+queryString({op:"read",pin,mode}),{timeout:1400});
    }
    async gpioWrite(pin,value,{safeValue=0}={}){
      pin=Number(pin);if(!SAFE_RGB_PINS.includes(pin))throw new Error("GPIO output pin must be one of: "+SAFE_RGB_PINS.join(", "));
      return this._request("/api/bridge/gpio",{method:"POST",data:{op:"write",pin,value:value?1:0,safeValue:safeValue?1:0},timeout:1400});
    }
    async adc(pin){return this._request("/api/bridge/adc"+queryString({pin:Number(pin)}),{timeout:1400});}
    async pwm(pin,duty,{frequency=1000,resolution=8,safeDuty=0}={}){
      pin=Number(pin);if(!SAFE_RGB_PINS.includes(pin))throw new Error("PWM pin must be one of: "+SAFE_RGB_PINS.join(", "));
      return this._request("/api/bridge/pwm",{method:"POST",data:{pin,duty:Number(duty),frequency:Number(frequency),resolution:Number(resolution),safeDuty:Number(safeDuty)},timeout:1600});
    }
    async i2c({op="scan",bus=0,sda=21,scl=22,frequency=400000,address=null,reg=null,regWidth=1,length=null,data=null,stop=true}={}){
      const payload={op,bus,sda,scl,frequency,address,reg,regWidth,length,stop:stop?1:0};
      if(data!==null)payload.data=Array.isArray(data)?data.join(","):String(data);
      const isRead=["scan","read","readreg"].includes(String(op).toLowerCase());
      return isRead?this._request("/api/bridge/i2c"+queryString(payload),{timeout:2200}):this._request("/api/bridge/i2c",{method:"POST",data:payload,timeout:2200});
    }
    async uart({op="read",port=1,rx=16,tx=17,baud=9600,max=128,waitMs=0,data=null,text=null}={}){
      const payload={op,port,rx,tx,baud,max,waitMs};if(data!==null)payload.data=Array.isArray(data)?data.join(","):String(data);if(text!==null)payload.text=String(text);
      const read=["read","readline"].includes(String(op).toLowerCase());return read?this._request("/api/bridge/uart"+queryString(payload),{timeout:1800}):this._request("/api/bridge/uart",{method:"POST",data:payload,timeout:1800});
    }
    async spi({bus=1,sck=18,miso=19,mosi=23,cs=4,frequency=1000000,mode=0,lsbFirst=false,activeLow=true,data=[]}={}){
      return this._request("/api/bridge/spi",{method:"POST",data:{bus,sck,miso,mosi,cs,frequency,mode,lsbFirst:lsbFirst?1:0,activeLow:activeLow?1:0,data:Array.from(data||[]).join(",")},timeout:2200});
    }
    async pulse({op="in",pin,state=1,timeoutUs=100000,widthUs=10,safeValue=null}={}){
      const payload={op,pin:Number(pin),state:state?1:0,timeoutUs:Number(timeoutUs),widthUs:Number(widthUs)};if(safeValue!==null&&safeValue!==undefined)payload.safeValue=safeValue?1:0;const isRead=["in","frequency"].includes(String(op).toLowerCase());return isRead?this._request("/api/bridge/pulse"+queryString(payload),{timeout:2200}):this._request("/api/bridge/pulse",{method:"POST",data:payload,timeout:2200});
    }
    async counter({op="read",pin,edge="rising",pullup=false}={}){
      pin=Number(pin);if(!SAFE_COUNTER_PINS.includes(pin))throw new Error("Counter pin must be one of: "+SAFE_COUNTER_PINS.join(", "));
      const payload={op,pin,edge:String(edge||"rising"),pullup:pullup?1:0};const read=String(op).toLowerCase()!=="reset";return read?this._request("/api/bridge/counter"+queryString(payload),{timeout:1600}):this._request("/api/bridge/counter",{method:"POST",data:payload,timeout:1600});
    }
    async transaction(ops){return this._request("/api/bridge/transaction",{method:"POST",data:{ops:String(ops||"")},timeout:3500});}

    async securityStatus(){if(!this.base)await this.reconnect(4);return requestBase(this.base,"/api/security",{timeout:1800});}
    async enableSecurity(token){token=String(token||"").trim();if(token.length<16)throw new Error("Secure Mode token must be at least 16 characters.");return this._request("/api/security",{method:"POST",data:{action:"enable",token},timeout:2200},false);}
    async rotateSecurity(token){token=String(token||"").trim();if(token.length<16)throw new Error("Secure Mode token must be at least 16 characters.");return this._request("/api/security",{method:"POST",data:{action:"rotate",token},timeout:2200},false);}
    async disableSecurity(){return this._request("/api/security",{method:"POST",data:{action:"disable"},timeout:2200},false);}

    async rename(name){
      if(!this.base)await this.reconnect(4);const clean=normalizeKitName(name);if(clean.length<3)throw new Error("Kit name must be 3–32 characters.");
      return this._request("/api/name",{method:"POST",data:{name:clean},timeout:4500},false);
    }
    async resetName(){if(!this.base)await this.reconnect(4);return this._request("/api/name/reset",{method:"POST",data:{reset:1},timeout:4500},false);}
    async scanWifi(){return this._request("/api/wifi/scan",{timeout:12000});}
    async savedWifi(){return this._request("/api/wifi/saved",{timeout:2500});}
    async setWifi(ssid,password){return this._request("/api/wifi",{method:"POST",data:{ssid,password},timeout:4500},false);}
    async useWifi(ssid){return this._request("/api/wifi/use",{method:"POST",data:{ssid},timeout:3500},false);}
    async forgetWifi(ssid){return this._request("/api/wifi/remove",{method:"POST",data:{ssid},timeout:2500});}
    async resetWifi(){return this._request("/api/wifi/reset",{method:"POST",data:{reset:1},timeout:4500},false);}
  }

  global.ZebjusKit={
    KitClient,normalizeKitName,hostFromName,baseFromName,scanDefaultKits,loadKnown,rememberKit,SAFE_RGB_PINS,SAFE_ADC_PINS,SAFE_DIGITAL_PINS,SAFE_ULTRASONIC_ECHO_PINS,SAFE_COUNTER_PINS
  };
})(window);
