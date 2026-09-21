(function(){
  "use strict";
  const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let client=null,fw=null,transport=null,loader=null,serialPort=null,busy=false;

  const log=s=>{const e=$("fwLog"),t=new Date().toLocaleTimeString();e.textContent+=`\n[${t}] ${s}`;e.scrollTop=e.scrollHeight;};
  function badge(id,text,kind=""){const e=$(id);e.textContent=text;e.className="badge "+(kind||"");}
  function stage(name,state=""){const e=document.querySelector(`[data-stage="${name}"]`);if(e)e.className=state;}
  function resetStages(){document.querySelectorAll("[data-stage]").forEach(e=>e.className="");}
  function progress(n,text){$("progressBar").style.width=Math.max(0,Math.min(100,n))+"%";$("progressText").textContent=text||"";}
  function pretty(n){if(!Number.isFinite(+n))return "--";return +n<1024?`${n} B`:+n<1048576?`${(+n/1024).toFixed(1)} KB`:`${(+n/1048576).toFixed(2)} MB`;}
  async function sha(bytes){const h=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");}

  async function loadFile(file){
    if(!file)return;
    const bytes=new Uint8Array(await file.arrayBuffer());
    fw={name:file.name,bytes};
    $("fileName").textContent=file.name;$("fileSize").textContent=pretty(bytes.byteLength);$("fileSha").textContent=await sha(bytes);
    badge("fwBadge","FIRMWARE READY");progress(0,"Firmware loaded. Ready to verify target.");log(`Loaded ${file.name} (${pretty(bytes.byteLength)})`);
  }

  function known(){return (window.ZebjusKit?.loadKnown?.()||[]).sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0));}
  function kitKey(x){const chip=String(x?.chipId||"").trim();return chip?`chip:${chip}`:`name:${window.ZebjusKit?.normalizeKitName?.(x?.name)||String(x?.name||"").trim().toLowerCase()}`;}
  function selectedKit(){const key=$("kitSelect").value;return known().find(x=>kitKey(x)===key)||null;}
  function settings(){try{const x=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");return x&&typeof x==="object"?x:{};}catch(_){return {};}}
  function tokenForKit(x){
    const s=settings(),kitName=window.ZebjusKit?.normalizeKitName?.(x?.name)||String(x?.name||"").trim().toLowerCase();
    const savedName=window.ZebjusKit?.normalizeKitName?.(s.kitName||s.kitId)||String(s.kitName||s.kitId||"").trim().toLowerCase();
    const chip=String(x?.chipId||""),savedChip=String(s.kitChipId||"");
    const sameKit=!!(chip&&savedChip&&chip===savedChip)||!!(kitName&&savedName&&kitName===savedName);
    return sameKit?String(s.kitToken||""):"";
  }
  function fillKits(){
    const list=known(),s=$("kitSelect"),before=s.value;s.innerHTML="";
    if(!list.length){const op=document.createElement("option");op.value="";op.textContent="No saved kits";s.appendChild(op);return;}
    for(const x of list){const op=document.createElement("option");op.value=kitKey(x);op.textContent=`${x.name} · ${x.ip||"IP unknown"}`;s.appendChild(op);}
    if([...s.options].some(op=>op.value===before))s.value=before;
  }

  async function detect(){
    const x=selectedKit();
    if(!x){badge("kitBadge","KIT OFFLINE","off");return null;}
    client=new ZebjusKit.KitClient();client.name=x.name;client.ipHint=x.ip||"";client.chipId=String(x.chipId||"");client.token=tokenForKit(x);
    badge("kitBadge","CONNECTING");$("kitTitle").textContent=x.name;
    try{
      const st=await client.connect(x.name,x.ip||""),info=await client.firmwareInfo();
      const connectedKey=kitKey({name:st.name||x.name,chipId:st.chipId||x.chipId});fillKits();if([...$("kitSelect").options].some(op=>op.value===connectedKey))$("kitSelect").value=connectedKey;
      badge("kitBadge","KIT CONNECTED");$("kitDetail").textContent=`${st.ssid||"Wi-Fi"} · RSSI ${st.rssi??"--"} dBm`;
      $("mName").textContent=st.name||x.name;$("mId").textContent=st.chipId||x.chipId||"--";$("mFw").textContent=info.firmware||st.version||"--";
      $("mBoard").textContent=info.boardName||info.boardId||"--";$("mIp").textContent=st.ip||x.ip||"--";$("mRun").textContent=info.runActive?"RUNNING — STOP FIRST":"STOPPED / SAFE";
      log(`Connected ${st.name} @ ${st.ip} · firmware ${info.firmware}`);return {st,info};
    }catch(e){badge("kitBadge","KIT OFFLINE","off");$("kitDetail").textContent=e.message;log("Detect failed: "+e.message);throw e;}
  }

  async function autoLoad(){
    try{
      const r=await fetch("./ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_5_0.bin",{cache:"no-store"});
      if(!r.ok)throw new Error("No bundled compiled .bin in this source package.");
      const b=await r.blob();await loadFile(new File([b],"ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_5_0.bin",{type:"application/octet-stream"}));
    }catch(e){log(e.message);progress(0,"Import a compiled .bin to continue.");}
  }

  async function wifiFlash(){
    if(busy)return;if(!fw)return log("Load a firmware .bin first.");busy=true;resetStages();
    try{
      const k=await detect();if(!k)throw new Error("Kit is not connected.");
      if(k.info.runActive)throw new Error("Stop the running Python program before firmware update.");
      if(k.info.freeSketchBytes&&fw.bytes.byteLength>Number(k.info.freeSketchBytes))throw new Error(`Firmware ${pretty(fw.bytes.byteLength)} is larger than free sketch space ${pretty(k.info.freeSketchBytes)}.`);
      if(!confirm(`Flash ${fw.name} to ${k.st.name}?\n\nKeep the kit powered until reconnect completes.`))return;
      stage("prepare","done");stage("flash","active");badge("fwBadge","UPDATING");progress(3,"Uploading firmware…");
      const url=client.base+"/api/firmware/update";
      const result=await new Promise((resolve,reject)=>{
        const x=new XMLHttpRequest();x.open("POST",url,true);x.timeout=120000;if(client.token)x.setRequestHeader("X-Zebjus-Token",client.token);
        x.upload.onprogress=e=>{if(e.lengthComputable)progress(5+(e.loaded/e.total)*78,`Uploading ${pretty(e.loaded)} / ${pretty(e.total)}`);};
        x.onerror=()=>reject(new Error("Firmware upload connection failed."));x.ontimeout=()=>reject(new Error("Firmware upload timed out."));
        x.onload=()=>{let r={};try{r=JSON.parse(x.responseText||"{}");}catch(_){}if(x.status>=200&&x.status<300&&r.ok!==false)resolve(r);else reject(new Error(r.message||`Kit returned HTTP ${x.status}`));};
        const f=new FormData();f.append("firmware",new Blob([fw.bytes],{type:"application/octet-stream"}),fw.name);x.send(f);
      });
      stage("flash","done");stage("verify","done");stage("reboot","active");progress(88,result.message||"Firmware verified. Kit rebooting…");log(result.message||"Firmware uploaded.");
      await sleep(1800);stage("reboot","done");stage("reconnect","active");
      for(let i=1;i<=22;i++){progress(90+i/22*9,`Waiting for kit… ${i}/22`);await sleep(i<5?900:1400);try{const k2=await detect();if(k2){stage("reconnect","done");progress(100,"Update complete. Kit reconnected.");badge("fwBadge","COMPLETE");return;}}catch(_){}}
      throw new Error("Flash completed, but automatic reconnect timed out.");
    }catch(e){badge("fwBadge","FAILED","off");progress(0,e.message);log("Update failed: "+e.message);const a=document.querySelector(".stages .active");if(a)a.className="error";}
    finally{busy=false;}
  }

  async function reboot(){
    try{const k=await detect();if(k.info.runActive)throw new Error("Stop the running Python program before reboot.");await client.reboot();badge("fwBadge","REBOOTING");log("Reboot command accepted.");await sleep(1500);for(let i=0;i<15;i++){await sleep(1000);try{if(await detect()){badge("fwBadge","ONLINE");return;}}catch(_){}}}
    catch(e){log(e.message);}
  }
  async function reconnect(){try{await detect();badge("fwBadge","ONLINE");}catch(e){log(e.message);}}
  async function loadUsb(){let last;for(const u of ["https://cdn.jsdelivr.net/npm/esptool-js@0.6.1/lib/index.js","https://unpkg.com/esptool-js@0.6.1/lib/index.js"]){try{return await import(u);}catch(e){last=e;}}throw new Error("Could not load USB flasher engine. "+(last?.message||""));}
  async function usbConnect(){
    if(!("serial" in navigator))return log("Web Serial unavailable. Use desktop Chrome/Edge on HTTPS or localhost.");
    try{serialPort=await navigator.serial.requestPort();const mod=await loadUsb();transport=new mod.Transport(serialPort,true);loader=new mod.ESPLoader({transport,baudrate:460800,terminal:{clean(){},writeLine(d){if(String(d).trim())log("[USB] "+d);},write(){}}});const sig=await loader.main();$("usbInfo").textContent=String(sig||"Bootloader connected");badge("usbBadge","USB CONNECTED");log("USB bootloader connected.");}
    catch(e){badge("usbBadge","USB FAILED","off");log("USB connect failed: "+e.message);}
  }
  async function usbFlash(){
    if(!fw)return log("Load firmware .bin first.");if(!loader)return log("Connect USB bootloader first.");if(!confirm(`USB flash ${fw.name} at application address 0x10000?`))return;
    try{badge("usbBadge","FLASHING");await loader.writeFlash({fileArray:[{data:fw.bytes,address:0x10000}],flashMode:"dio",flashFreq:"80m",flashSize:"4MB",eraseAll:false,compress:true,reportProgress:(i,w,t)=>progress(5+(w/t)*90,`USB flash ${pretty(w)} / ${pretty(t)}`)});await loader.after("hard_reset");badge("usbBadge","FLASHED");progress(100,"USB flash complete.");log("USB application flash complete.");}
    catch(e){badge("usbBadge","USB FAILED","off");log("USB flash failed: "+e.message);}
  }
  async function usbDisconnect(){try{if(transport)await transport.disconnect();}catch(_){}transport=loader=serialPort=null;badge("usbBadge","USB OFFLINE","off");$("usbInfo").textContent="Not connected";}

  fillKits();
  $("detectBtn").onclick=detect;$("fileInput").onchange=e=>loadFile(e.target.files?.[0]);$("autoLoadBtn").onclick=autoLoad;
  $("clearFileBtn").onclick=()=>{fw=null;$("fileName").textContent="No firmware loaded";$("fileSize").textContent=$("fileSha").textContent="--";};
  $("wifiFlashBtn").onclick=wifiFlash;$("rebootBtn").onclick=reboot;$("reconnectBtn").onclick=reconnect;
  $("usbConnectBtn").onclick=usbConnect;$("usbFlashBtn").onclick=usbFlash;$("usbDisconnectBtn").onclick=usbDisconnect;
  const dz=$("dropZone");["dragenter","dragover"].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add("drag");}));["dragleave","drop"].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove("drag");}));
  dz.addEventListener("drop",e=>loadFile(e.dataTransfer.files?.[0]));if(known().length)detect().catch(()=>{});window.addEventListener("beforeunload",()=>{try{transport?.disconnect();}catch(_){}});
})();
