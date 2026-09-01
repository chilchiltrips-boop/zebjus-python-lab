(function(){
  const $=id=>document.getElementById(id);
  const defaults={autoCamera:true,demoMode:true,kitId:"ZB-000123",wsUrl:"",cameraIndex:0,fontSize:14,autoSave:true,stdin:""};

  function getSettings(){let s={};try{s=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");}catch(e){}return {...defaults,...s};}
  let current=getSettings(),cameras=[];

  function fill(){
    $("autoCamera").checked=!!current.autoCamera;
    $("demoMode").checked=!!current.demoMode;
    $("kitId").value=current.kitId||"ZB-000123";
    $("wsUrl").value=current.wsUrl||"";
    $("fontSize").value=String(current.fontSize||14);
    $("autoSave").checked=current.autoSave!==false;
    $("stdinBox").value=current.stdin||"";
  }

  async function listCameras(){
    try{
      const ds=await navigator.mediaDevices?.enumerateDevices?.()||[];
      cameras=ds.filter(d=>d.kind==="videoinput");
      const s=$("cameraSelect");s.innerHTML="";
      if(!cameras.length){
        const o=document.createElement("option");o.value="0";o.textContent="Camera 0 (default)";s.appendChild(o);
      }else{
        cameras.forEach((d,i)=>{
          const o=document.createElement("option");
          o.value=String(i);
          o.textContent=`Camera ${i}${d.label?" — "+d.label:""}`;
          s.appendChild(o);
        });
      }
      s.value=String(Math.min(Number(current.cameraIndex)||0,Math.max(0,cameras.length-1)));
    }catch(e){$("settingsSaved").textContent="Camera list unavailable: "+e.message;}
  }

  async function allowCamera(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      stream.getTracks().forEach(t=>t.stop());
      $("settingsSaved").textContent="Camera permission allowed.";
      await listCameras();
    }catch(e){$("settingsSaved").textContent="Camera permission error: "+e.message;}
  }

  function save(){
    current={
      autoCamera:$("autoCamera").checked,
      demoMode:$("demoMode").checked,
      kitId:$("kitId").value.trim()||"ZB-000123",
      wsUrl:$("wsUrl").value.trim(),
      cameraIndex:Number($("cameraSelect").value)||0,
      fontSize:Number($("fontSize").value)||14,
      autoSave:$("autoSave").checked,
      stdin:$("stdinBox").value||""
    };
    localStorage.setItem("zebjus.lab.settings",JSON.stringify(current));
    $("settingsSaved").textContent="Settings saved.";
  }

  $("allowCameraBtn").onclick=allowCamera;
  $("refreshCameraBtn").onclick=listCameras;
  $("saveSettingsBtn").onclick=save;
  $("resetSettingsBtn").onclick=()=>{
    current={...defaults};
    fill();
    listCameras();
    localStorage.setItem("zebjus.lab.settings",JSON.stringify(current));
    $("settingsSaved").textContent="Defaults restored.";
  };

  fill();
  listCameras();
})();