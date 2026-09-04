(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const Kit=window.ZebjusKit;
  const client=Kit?new Kit.KitClient():null;

  const defaults={
    autoCamera:true,demoMode:true,kitName:"",kitId:"",kitIp:"",wsUrl:"",
    cameraIndex:0,fontSize:14,autoSave:true,stdin:"",demoUltrasonic:45,demoPot:128
  };

  function getSettings(){
    let s={};try{s=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");}catch(_){s={};}
    const out={...defaults,...s};
    if(!out.kitName&&out.kitId&&!/^ZB-/i.test(out.kitId))out.kitName=out.kitId;
    return out;
  }

  let current=getSettings(),cameras=[];

  function setMessage(id,text,kind=""){
    const el=$(id);if(!el)return;el.textContent=text||"";el.className="muted"+(kind?" "+kind:"");
  }
  function setConnBadge(text,ok=false){const el=$("kitConnBadge");el.textContent=text;el.className="badge"+(ok?" ok":"");}
  function persist(){localStorage.setItem("zebjus.lab.settings",JSON.stringify(current));}

  function updateDemoLabels(){
    $("demoUltrasonicLabel").textContent=$("demoUltrasonic").value+" cm";
    $("demoPotLabel").textContent=$("demoPot").value+" / 255";
  }

  function fill(){
    $("autoCamera").checked=!!current.autoCamera;
    $("demoMode").checked=!!current.demoMode;
    $("kitName").value=current.kitName||"";
    $("kitIp").value=current.kitIp||"";
    $("wsUrl").value=current.wsUrl||"";
    $("fontSize").value=String(current.fontSize||14);
    $("autoSave").checked=current.autoSave!==false;
    $("stdinBox").value=current.stdin||"";
    $("demoUltrasonic").value=String(current.demoUltrasonic??45);
    $("demoPot").value=String(current.demoPot??128);
    updateDemoLabels();
  }

  async function listCameras(){
    try{
      const ds=await navigator.mediaDevices?.enumerateDevices?.()||[];
      cameras=ds.filter(d=>d.kind==="videoinput");
      const s=$("cameraSelect");s.innerHTML="";
      if(!cameras.length){const o=document.createElement("option");o.value="0";o.textContent="Camera 0 (default)";s.appendChild(o);}
      else cameras.forEach((d,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=`Camera ${i}${d.label?" — "+d.label:""}`;s.appendChild(o);});
      s.value=String(Math.min(Number(current.cameraIndex)||0,Math.max(0,cameras.length-1)));
    }catch(e){setMessage("settingsSaved","Camera list unavailable: "+e.message);}
  }

  async function allowCamera(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      stream.getTracks().forEach(t=>t.stop());setMessage("settingsSaved","Camera permission allowed.","ok-text");await listCameras();
    }catch(e){setMessage("settingsSaved","Camera permission error: "+e.message,"error-text");}
  }

  function save(){
    const entered=Kit?Kit.normalizeKitName($("kitName").value):$("kitName").value.trim();
    current={
      ...current,
      autoCamera:$("autoCamera").checked,demoMode:$("demoMode").checked,
      kitName:entered,kitId:entered,kitIp:$("kitIp").value.trim(),wsUrl:$("wsUrl").value.trim(),
      cameraIndex:Number($("cameraSelect").value)||0,fontSize:Number($("fontSize").value)||14,
      autoSave:$("autoSave").checked,stdin:$("stdinBox").value||"",
      demoUltrasonic:Number($("demoUltrasonic").value)||45,demoPot:Number($("demoPot").value)||0
    };
    persist();setMessage("settingsSaved","Settings saved.","ok-text");
  }

  function renderKitInfo(status){
    const box=$("kitInfo");box.innerHTML="";
    if(!status){box.textContent="Select or enter a kit name, then connect.";return;}
    const rows=[
      ["Name",status.name||"—"],["IP",status.ip||"—"],["Wi-Fi",status.ssid||"—"],
      ["Signal",status.rssi!==undefined?status.rssi+" dBm":"—"],["Kit ID",status.chipId||status.id||"—"],
      ["RGB",status.rgb?`R${status.rgb.rPin} G${status.rgb.gPin} B${status.rgb.bPin}`:"R25 G26 B27"]
    ];
    rows.forEach(([k,v])=>{const row=document.createElement("div");const a=document.createElement("span"),b=document.createElement("strong");a.textContent=k;b.textContent=v;row.append(a,b);box.appendChild(row);});
  }

  async function connectKit(nameOverride=""){
    if(!client)throw new Error("Kit client did not load.");
    const name=Kit.normalizeKitName(nameOverride||$("kitName").value);
    if(name.length<3)throw new Error("Enter the kit name, for example zebjus_kit_1.");
    setConnBadge("Connecting…");setMessage("kitNameMessage","");
    const status=await client.connect(name,$("kitIp").value.trim());
    $("kitName").value=status.name||name;$("kitIp").value=status.ip||"";$("newKitName").value=status.name||name;
    current.kitName=status.name||name;current.kitId=current.kitName;current.kitIp=status.ip||"";current.demoMode=false;$("demoMode").checked=false;persist();
    setConnBadge("Connected",true);renderKitInfo(status);return status;
  }

  async function scanKits(){
    if(!Kit)throw new Error("Kit client did not load.");
    const btn=$("scanKitsBtn");btn.disabled=true;const sel=$("kitSelect");sel.innerHTML="";
    const o=document.createElement("option");o.value="";o.textContent="Scanning…";sel.appendChild(o);
    try{
      const found=await Kit.scanDefaultKits(30,(done,total,count)=>{o.textContent=`Scanning ${done}/${total} — ${count} found`;});
      sel.innerHTML="";
      if(!found.length){const none=document.createElement("option");none.value="";none.textContent="No default kits found";sel.appendChild(none);setMessage("kitNameMessage","No kit found. You can still enter a custom kit name manually.");return;}
      found.forEach(({status})=>{const op=document.createElement("option");op.value=status.name;op.dataset.ip=status.ip||"";op.textContent=`${status.name} — ${status.ip||"local"}`;sel.appendChild(op);});
      sel.dispatchEvent(new Event("change"));setMessage("kitNameMessage",`${found.length} kit(s) found on this Wi-Fi.`,"ok-text");
    }finally{btn.disabled=false;}
  }

  async function renameKit(){
    const name=Kit.normalizeKitName($("newKitName").value);
    if(name.length<3){setMessage("kitNameMessage","Use 3–32 letters, numbers, _ or -.","error-text");return;}
    try{
      setMessage("kitNameMessage","Checking name on this Wi-Fi…");
      const r=await client.rename(name);
      current.kitName=name;current.kitId=name;current.kitIp="";persist();$("kitName").value=name;$("kitIp").value="";
      setMessage("kitNameMessage",r.message||`Name saved as ${name}. Kit is restarting.`,"ok-text");client.disconnect();setConnBadge("Restarting…");
    }catch(e){
      if(e.status===409)setMessage("kitNameMessage","Another person is using this name on this Wi-Fi network.","error-text");
      else setMessage("kitNameMessage","Name change failed: "+e.message,"error-text");
    }
  }

  async function resetKitName(){
    try{
      const r=await client.resetName();current.kitName="";current.kitId="";current.kitIp="";persist();$("kitName").value="";$("newKitName").value="";
      setMessage("kitNameMessage",r.message||"Auto name reset. Kit will choose the next free zebjus_kit_N name after restart.","ok-text");client.disconnect();setConnBadge("Restarting…");
    }catch(e){setMessage("kitNameMessage","Reset failed: "+e.message,"error-text");}
  }

  async function scanWifi(){
    const sel=$("wifiSelect");sel.innerHTML="<option value=''>Scanning…</option>";setMessage("wifiMessage","Scanning networks…");
    try{
      const r=await client.scanWifi();sel.innerHTML="";
      (r.networks||[]).forEach(n=>{const op=document.createElement("option");op.value=n.ssid;op.textContent=`${n.ssid} (${n.rssi} dBm)${n.secure?" 🔒":""}`;sel.appendChild(op);});
      if(!sel.options.length)sel.innerHTML="<option value=''>No networks found</option>";
      setMessage("wifiMessage",`${(r.networks||[]).length} network(s) found.`,"ok-text");
    }catch(e){sel.innerHTML="<option value=''>Scan failed</option>";setMessage("wifiMessage","Wi-Fi scan failed: "+e.message,"error-text");}
  }

  async function saveWifi(){
    const ssid=$("wifiSelect").value,password=$("wifiPassword").value;
    if(!ssid){setMessage("wifiMessage","Select a Wi-Fi network first.","error-text");return;}
    try{
      const r=await client.setWifi(ssid,password);setMessage("wifiMessage",r.message||`Saved ${ssid}. Kit is restarting and will try this network first.`,"ok-text");
      client.disconnect();setConnBadge("Switching Wi-Fi…");
    }catch(e){setMessage("wifiMessage","Wi-Fi change failed: "+e.message,"error-text");}
  }

  async function resetWifi(){
    try{
      const r=await client.resetWifi();setMessage("wifiMessage",r.message||"Saved Wi-Fi networks cleared. Connect to the kit setup hotspot after restart.","ok-text");
      client.disconnect();setConnBadge("Wi-Fi reset…");
    }catch(e){setMessage("wifiMessage","Wi-Fi reset failed: "+e.message,"error-text");}
  }

  $("allowCameraBtn").onclick=allowCamera;$("refreshCameraBtn").onclick=listCameras;
  $("demoUltrasonic").oninput=updateDemoLabels;$("demoPot").oninput=updateDemoLabels;
  $("saveSettingsBtn").onclick=save;
  $("connectKitBtn").onclick=()=>connectKit().catch(e=>{setConnBadge("Not connected");setMessage("kitNameMessage","Connection failed: "+e.message,"error-text");});
  $("scanKitsBtn").onclick=()=>scanKits().catch(e=>setMessage("kitNameMessage","Scan failed: "+e.message,"error-text"));
  $("disconnectKitBtn").onclick=()=>{client?.disconnect();setConnBadge("Not connected");renderKitInfo(null);};
  $("kitSelect").onchange=e=>{const op=e.target.selectedOptions[0];if(!op?.value)return;$("kitName").value=op.value;$("kitIp").value=op.dataset.ip||"";connectKit(op.value).catch(err=>setMessage("kitNameMessage","Connection failed: "+err.message,"error-text"));};
  $("renameKitBtn").onclick=renameKit;$("resetKitNameBtn").onclick=resetKitName;$("scanWifiBtn").onclick=scanWifi;$("saveWifiBtn").onclick=saveWifi;$("resetWifiBtn").onclick=resetWifi;

  $("resetSettingsBtn").onclick=()=>{current={...defaults};fill();listCameras();persist();setMessage("settingsSaved","Defaults restored.");};

  fill();listCameras();renderKitInfo(null);
  if(!current.demoMode&&current.kitName)connectKit(current.kitName).catch(()=>setConnBadge("Not connected"));
})();
