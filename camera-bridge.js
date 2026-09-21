(function(){
  const $=id=>document.getElementById(id),cfg=window.ZEBJUS_CONFIG||{};
  const params=new URLSearchParams(location.search);
  const channelName=params.get("channel")||"zebjus-camera-bridge";
  const channel=new BroadcastChannel(channelName);
  const video=$("bridgeVideo"),overlay=$("bridgeOverlay");
  let cameraRunning=false,cameras=[],currentIndex=0;

  function message(t){$("bridgeMessage").textContent=t;}

  async function listCameras(){
    try{
      const ds=await navigator.mediaDevices?.enumerateDevices?.()||[];
      cameras=ds.filter(d=>d.kind==="videoinput");
    }catch(e){}
  }

  async function startCamera(index=0){
    currentIndex=Math.max(0,Number(index)||0);
    await listCameras();
    const deviceId=cameras[currentIndex]?.deviceId||"";
    try{
      message("Requesting camera permission…");
      await window.ZebjusAI.start(video,overlay,deviceId);
      cameraRunning=true;
      await listCameras();
      message("Camera ready. Keep this window open while using camera lessons.");
      channel.postMessage({type:"bridge-ready",cameraIndex:currentIndex});
      return true;
    }catch(e){
      cameraRunning=false;
      message("Camera error: "+(e?.message||e));
      channel.postMessage({type:"bridge-error",message:String(e?.message||e)});
      return false;
    }
  }

  function captureFrame(){
    if(!cameraRunning||video.readyState<2)return null;
    const c=document.createElement("canvas"),w=cfg.cameraCaptureWidth||320,h=cfg.cameraCaptureHeight||240;
    c.width=w;c.height=h;
    const x=c.getContext("2d",{willReadFrequently:true});
    x.drawImage(video,0,0,w,h);
    return{width:w,height:h,data:Array.from(x.getImageData(0,0,w,h).data)};
  }

  async function sendSnapshot(requestId="",needsFace=false){
    if(!cameraRunning){
      const ok=await startCamera(currentIndex);
      if(!ok)return;
    }
    if(needsFace)await window.ZebjusAI.enableFaceDetection();
    const stable=needsFace?await window.ZebjusAI.waitForFaces(1200):await window.ZebjusAI.waitForStable(1200);
    channel.postMessage({
      type:"camera-snapshot",
      requestId,
      aiState:{
        detected:!!stable.detected,
        fingers:Number(stable.fingers)||0,
        side:stable.side||"",
        faces:Array.isArray(stable.faces)?stable.faces:[],
        landmarks:Array.isArray(stable.landmarks)?stable.landmarks:[]
      },
      frame:captureFrame()
    });
    message(`Snapshot sent • hand=${!!stable.detected} • fingers=${Number(stable.fingers)||0} • faces=${Number(stable.faceCount)||0}`);
  }

  channel.onmessage=async e=>{
    const m=e.data||{};
    if(m.type==="hello"){
      channel.postMessage({type:"bridge-alive",cameraRunning});
    }else if(m.type==="request-snapshot"){
      const idx=Math.max(0,Number(m.cameraIndex)||0);
      if(!cameraRunning||idx!==currentIndex){
        if(cameraRunning)window.ZebjusAI.stop(video,overlay);
        cameraRunning=false;
        await startCamera(idx);
      }
      await sendSnapshot(m.requestId||"",!!m.needsFace);
    }
  };

  window.addEventListener("zebjus-ai-state",e=>{
    const d=e.detail||{};
    $("bHand").textContent=d.detected?"Yes":"No";
    $("bFingers").textContent=Number(d.fingers)||0;
    $("bSide").textContent=d.side||"—";
    if($("bFaces"))$("bFaces").textContent=Number(d.faceCount)||0;
  });

  $("startBridgeBtn").onclick=()=>startCamera(currentIndex);
  $("sendSnapshotBtn").onclick=()=>sendSnapshot("");
  $("closeBridgeBtn").onclick=()=>window.close();

  channel.postMessage({type:"bridge-open"});
  startCamera(Number(params.get("camera")||0));
})();